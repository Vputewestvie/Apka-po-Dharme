import { createHmac, timingSafeEqual } from "node:crypto";
import type { TelegramUser } from "../../types";

export type HeadersLike = Record<string, string | string[] | undefined>;

export type AuthResult =
  | { ok: true; userId: string; service?: boolean; telegramUser?: TelegramUser }
  | { ok: false; reason: string; anonymous?: boolean };

/** Сравнение строк без утечки по времени. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Служебный токен для вызовов «бот → API».
 * Бот действует не от имени пользователя, а как доверенный сервис
 * (рассылка уведомлений), поэтому отдельный контур аутентификации.
 */
export function authenticateService(headers: HeadersLike): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) return false;
  const provided = extractHeader(headers, "x-internal-token");
  if (!provided) return false;
  return constantTimeEquals(provided, expected);
}

/** Допустимый возраст Telegram init data по умолчанию — 24 часа. */
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Небольшой допуск на расхождение часов между клиентом и сервером. */
const CLOCK_SKEW_SECONDS = 60;

/**
 * Dev-режим (заголовок `x-user-id`) разрешён только вне production
 * и только при явно выставленном `ALLOW_DEV_AUTH=1`.
 */
export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "1";
}

/**
 * Единая функция авторизации запроса.
 *
 * Приоритет:
 * 1. Если передан `x-user-id` — использовать его, но ТОЛЬКО в dev-режиме
 *    (`NODE_ENV !== "production"` и `ALLOW_DEV_AUTH=1`). В любом другом случае
 *    заголовок отвергается: иначе любой клиент может выдать себя за любого
 *    пользователя, просто подставив чужой идентификатор.
 * 2. Если передан `x-telegram-init-data` — валидировать подпись, свежесть
 *    `auth_date` и извлечь userId.
 *
 * Для production доступен только вариант 2.
 */
export function authenticateRequest(
  headers: HeadersLike,
  botToken: string,
): AuthResult {
  // Service-to-service: бот → API по служебному токену (имеет приоритет над всеми,
  // чтобы бот мог доставлять уведомления независимо от режима окружения).
  if (authenticateService(headers)) {
    return { ok: true, userId: "", service: true };
  }

  // Режим локальной разработки: x-user-id (отключён в production)
  const devUserId = extractHeader(headers, "x-user-id");
  if (devUserId) {
    if (!isDevAuthEnabled()) {
      return { ok: false, reason: "Dev authentication is disabled" };
    }
    return { ok: true, userId: devUserId };
  }

  // Основной режим: Telegram init data
  const initData = extractHeader(headers, "x-telegram-init-data");
  if (!initData) {
    // Без заголовков аутентификации — анонимный результат.
    // Отдельные служебные маршруты (уведомления) сами решат, допустим ли
    // анонимный доступ через requiredService, иначе вернётся 401.
    return { ok: false, reason: "Missing authentication", anonymous: true };
  }

  // ВАЖНО: initData обрабатывается в сыром виде — URL-закодированная строка
  // запроса, ровно как её отдал Telegram. decodeURIComponent здесь ломает
  // проверку подписи: Telegram подписывает сырые значения полей (симптом был
  // такой: в настоящем Telegram всё падало в 401, а локальная заглушка,
  // подписанная тем же неверным алгоритмом, работала).

  // Валидируем подпись
  if (!validateTelegramInitData(initData, botToken)) {
    return { ok: false, reason: "Invalid Telegram init data signature" };
  }

  // Извлекаем userId из init data
  const userId = extractUserIdFromInitData(initData);
  if (!userId) {
    return { ok: false, reason: "Cannot extract user from init data" };
  }

  // Профиль нужен, чтобы гарантированно создать строку пользователя в БД
  // (на D1 внешние ключи включены, поэтому запись users должна существовать
  // до любой записи practices/schedules и т.п.).
  const telegramUser = extractTelegramUser(initData);

  return { ok: true, userId, telegramUser };
}

function extractHeader(headers: HeadersLike, key: string): string | undefined {
  const raw = headers[key];
  if (!raw) return undefined;
  return Array.isArray(raw) ? String(raw[0]) : String(raw);
}

/**
 * Извлечение userId из init data (URL-encoded строка вида `user=%7B%22id%22%3A123%7D&...`).
 */
function extractUserIdFromInitData(initData: string): string | undefined {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return undefined;

    const user = JSON.parse(userRaw) as Record<string, unknown> | null;
    if (!user) return undefined;

    const id = user.id ?? user.user_id ?? user.userId;
    if (id === undefined || id === null) return undefined;

    return String(id);
  } catch {
    return undefined;
  }
}

/**
 * Извлечение профиля пользователя из init data.
 * Возвращает undefined, если поле `user` отсутствует или некорректно.
 */
function extractTelegramUser(initData: string): TelegramUser | undefined {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return undefined;

    const user = JSON.parse(userRaw) as Record<string, unknown> | null;
    if (!user) return undefined;

    const id = user.id ?? user.user_id ?? user.userId;
    if (id === undefined || id === null) return undefined;

    return {
      id: Number(id),
      username: (user.username as string | undefined) ?? null,
      first_name: (user.first_name as string | undefined) ?? null,
      last_name: (user.last_name as string | undefined) ?? null,
      language_code: (user.language_code as string | undefined) ?? null,
    };
  } catch {
    return undefined;
  }
}

/**
 * Варианты строки проверки. Telegram исторически подписывает init data
 * по-разному на разных клиентах/версиях API:
 *
 *  raw:hash-excluded      — сырое поле=value, из набора исключён только hash
 *                           (действующая схема из документации ботов);
 *  raw:hash+sig-excluded  — то же, но исключены hash и signature (в части
 *                           клиентов signature не входит в строку проверки);
 *  decoded:hash-excluded  — значения раскодированы (встречается в старых
 *                           примерах кода);
 *  raw:hash-excluded:raw-secret — secret = bot token без обёртки WebAppData
 *                           (самый старый вариант).
 *
 * Любой совпавший вариант одинаково доказывает, что данные подписаны токеном
 * нашего бота, поэтому принимаем первый совпавший.
 */
export type InitDataDiagnosis = {
  ok: boolean;
  matchedVariant?: string;
  variants: Array<{ variant: string; matched: boolean }>;
  hashPresent: boolean;
  authDate?: number;
  freshnessOk: boolean;
  user?: { id?: number | string; username?: string | null; first_name?: string | null };
};

function extractRawPairs(initData: string): { pairs: string[]; hash: string; authDateRaw: string } {
  const pairs: string[] = [];
  let hash = "";
  let authDateRaw = "";
  for (const pair of initData.split("&")) {
    const eq = pair.indexOf("=");
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? "" : pair.slice(eq + 1);
    if (key === "hash") {
      hash = value;
      continue;
    }
    if (key === "auth_date") authDateRaw = value;
    pairs.push(`${key}=${value}`);
  }
  return { pairs, hash, authDateRaw };
}

function constantTimeHexEquals(computedHex: string, providedHex: string): boolean {
  const computed = Buffer.from(computedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (computed.length === 0 || computed.length !== provided.length) return false;
  return timingSafeEqual(computed, provided);
}

/**
 * Диагностика + валидация Telegram init data: пробует известные варианты
 * строки проверки и возвращает подробности (какой вариант совпал и т.п.).
 */
export function diagnoseTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS) || DEFAULT_MAX_AGE_SECONDS,
): InitDataDiagnosis {
  const empty: InitDataDiagnosis = { ok: false, variants: [], hashPresent: false, freshnessOk: false };
  if (!initData || !botToken) return empty;

  try {
    const { pairs, hash, authDateRaw } = extractRawPairs(initData);
    const params = new URLSearchParams(initData);
    const authDate = Number(authDateRaw);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const freshnessOk =
      Boolean(authDateRaw) &&
      Number.isFinite(authDate) &&
      authDate <= nowSeconds + CLOCK_SKEW_SECONDS &&
      nowSeconds - authDate <= maxAgeSeconds;

    let user: InitDataDiagnosis["user"];
    try {
      const userRaw = params.get("user");
      if (userRaw) {
        const parsed = JSON.parse(userRaw) as Record<string, unknown>;
        user = {
          id: typeof parsed.id === "number" || typeof parsed.id === "string" ? parsed.id : undefined,
          username: (parsed.username as string | undefined) ?? null,
          first_name: (parsed.first_name as string | undefined) ?? null,
        };
      }
    } catch {
      // user — не JSON или отсутствует; не мешает проверке подписи
    }

    const base: InitDataDiagnosis = { ...empty, hashPresent: Boolean(hash), authDate: Number.isFinite(authDate) ? authDate : undefined, freshnessOk, user };
    if (!hash || !freshnessOk) return base;

    const webAppSecret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const candidates: Array<{ variant: string; check: string; secret: Buffer }> = [
      {
        variant: "raw:hash-excluded",
        check: [...pairs].sort().join("\n"),
        secret: webAppSecret,
      },
      {
        variant: "raw:hash+sig-excluded",
        check: pairs.filter((pair) => !pair.startsWith("signature=")).sort().join("\n"),
        secret: webAppSecret,
      },
      {
        variant: "decoded:hash-excluded",
        check: Array.from(params.keys())
          .filter((key) => key !== "hash")
          .sort()
          .map((key) => `${key}=${params.get(key)}`)
          .join("\n"),
        secret: webAppSecret,
      },
      {
        variant: "raw:hash-excluded:raw-secret",
        check: [...pairs].sort().join("\n"),
        secret: Buffer.from(botToken, "utf8"),
      },
    ];

    const variants = candidates.map(({ variant, check, secret }) => ({
      variant,
      matched: constantTimeHexEquals(createHmac("sha256", secret).update(check).digest("hex"), hash),
    }));

    const matched = variants.find((item) => item.matched);
    return { ...base, ok: Boolean(matched), matchedVariant: matched?.variant, variants };
  } catch {
    return empty;
  }
}

/**
 * Валидация Telegram init data.
 *
 * Дополнительно проверяется `auth_date`: без него перехваченная один раз
 * init data оставалась бы валидной навсегда.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS) || DEFAULT_MAX_AGE_SECONDS,
): boolean {
  if (!initData || !botToken) return false;
  return diagnoseTelegramInitData(initData, botToken, maxAgeSeconds).ok;
}
