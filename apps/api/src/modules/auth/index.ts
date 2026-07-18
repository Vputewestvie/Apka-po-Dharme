import { createHmac } from "node:crypto";

export type HeadersLike = Record<string, string | string[] | undefined>;

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

/**
 * Единая функция авторизации запроса.
 *
 * Приоритет:
 * 1. Если передан `x-user-id` — использовать его (для локальной разработки).
 * 2. Если передан `x-telegram-init-data` — валидировать подпись и извлечь userId.
 *
 * Для production рекомендуется использовать только вариант 2.
 */
export function authenticateRequest(
  headers: HeadersLike,
  botToken: string,
): AuthResult {
  // Режим локальной разработки: x-user-id
  const devUserId = extractHeader(headers, "x-user-id");
  if (devUserId) {
    return { ok: true, userId: devUserId };
  }

  // Основной режим: Telegram init data
  const initDataRaw = extractHeader(headers, "x-telegram-init-data");
  if (!initDataRaw) {
    return { ok: false, reason: "Missing authentication" };
  }

  // Декодируем URL-encoded init data
  const initData = decodeURIComponent(initDataRaw);

  // Валидируем подпись
  if (!validateTelegramInitData(initData, botToken)) {
    return { ok: false, reason: "Invalid Telegram init data signature" };
  }

  // Извлекаем userId из init data
  const userId = extractUserIdFromInitData(initData);
  if (!userId) {
    return { ok: false, reason: "Cannot extract user from init data" };
  }

  return { ok: true, userId };
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
 * Валидация Telegram init data.
 *
 * Проверяет подпись по алгоритму HMAC-SHA256:
 * 1. Берём bot token -> HMAC-SHA256 с ключом "WebAppData" -> получаем secret_key
 * 2. Сортируем все поля initData (кроме hash) по алфавиту
 * 3. Склеиваем в строку key=value\nkey=value...
 * 4. Считаем HMAC-SHA256 от этой строки с secret_key
 * 5. Сравниваем с переданным hash (case-insensitive)
 */
export function validateTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    // Удаляем hash из параметров
    params.delete("hash");

    // Сортируем оставшиеся ключи по алфавиту
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n");

    // Создаём secret_key из bot token
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Считаем HMAC от dataCheckString
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Сравниваем (case-insensitive)
    return computedHash.toLowerCase() === hash.toLowerCase();
  } catch {
    return false;
  }
}
