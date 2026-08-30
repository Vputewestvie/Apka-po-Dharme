import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/main";
import { authenticateRequest, validateTelegramInitData } from "../../src/modules/auth";

type Failure = { ok: false; error: string; status?: number };

function asFailure(response: unknown): Failure {
  return response as Failure;
}

function practiceBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Цигун",
    description: "",
    category: "Тело",
    defaultDurationMinutes: 30,
    color: "#688b76",
    icon: "leaf",
    image: { kind: "builtin", ref: "/images/qigong.jpg" },
    notes: "",
    ...overrides,
  };
}

/**
 * Подписывает init data ровно так, как это делает Telegram: строка проверки
 * собирается из СЫРЫХ пар «key=value» (значения остаются URL-закодированными,
 * как в исходной строке запроса). Подпись по раскодированным значениям —
 * это прошлый баг: настоящие init data Telegram отвергались с 401.
 */
function buildInitData(token: string, authDate: number, userId = 42): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify({ id: userId, first_name: "Demo" }),
  });
  const dataCheckString = params
    .toString()
    .split("&")
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("Авторизация: изоляция данных пользователей", () => {
  it("POST /practices игнорирует чужой userId из тела запроса", async () => {
    const app = await createApp(":memory:");

    // Алиса авторизована, но в теле пытается указать userId Боба
    const response = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: practiceBody({ userId: "bob" }),
      context: { requestId: "req-1", userId: "alice" },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect((response.data as { userId: string }).userId).toBe("alice");
    }

    // Практика не должна появиться у Боба
    const bobList = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      context: { requestId: "req-2", userId: "bob" },
    });
    expect(bobList.ok).toBe(true);
    if (bobList.ok) expect(bobList.data).toHaveLength(0);
  });

  it("PATCH /practices не даёт изменить чужую практику (403)", async () => {
    const app = await createApp(":memory:");

    const created = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: practiceBody({ userId: "alice", title: "Оригинал" }),
      context: { requestId: "req-1", userId: "alice" },
    });
    expect(created.ok).toBe(true);
    const practiceId = (created as { ok: true; data: { id: string } }).data.id;

    // Боб пытается переименовать практику Алисы по известному id
    const attack = await app.handleRequest({
      method: "PATCH",
      pathname: "/practices",
      body: { practiceId, title: "ВЗЛОМАНО" },
      context: { requestId: "req-2", userId: "bob" },
    });

    expect(attack.ok).toBe(false);
    expect(asFailure(attack).status).toBe(403);

    // Данные Алисы не изменились
    const aliceList = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      context: { requestId: "req-3", userId: "alice" },
    });
    if (aliceList.ok) {
      expect((aliceList.data as Array<{ title: string }>)[0].title).toBe("Оригинал");
    }
  });

  it("PATCH /practices владельцем работает", async () => {
    const app = await createApp(":memory:");

    const created = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: practiceBody({ userId: "alice", title: "Оригинал" }),
      context: { requestId: "req-1", userId: "alice" },
    });
    const practiceId = (created as { ok: true; data: { id: string } }).data.id;

    const updated = await app.handleRequest({
      method: "PATCH",
      pathname: "/practices",
      body: { practiceId, title: "Обновлено" },
      context: { requestId: "req-2", userId: "alice" },
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect((updated.data as { title: string }).title).toBe("Обновлено");
    }
  });

  it("операция над несуществующей практикой даёт 404, а не 500", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "PATCH",
      pathname: "/practices",
      body: { practiceId: "нет-такой-практики", title: "x" },
      context: { requestId: "req-1", userId: "alice" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(404);
  });

  it("неизвестный маршрут даёт 404, а не 500", async () => {
    const app = await createApp(":memory:");
    const response = await app.handleRequest({
      method: "GET",
      pathname: "/нет-такого-маршрута",
      context: { requestId: "req-1", userId: "alice" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(404);
  });

  it("эндпоинты уведомлений доступны только внутреннему сервису", async () => {
    const app = await createApp(":memory:");

    // Обычный пользователь — отказать
    const asUser = await app.handleRequest({
      method: "GET",
      pathname: "/notifications/pending",
      context: { requestId: "req-1", userId: "alice" },
    });
    expect(asUser.ok).toBe(false);
    expect(asFailure(asUser).status).toBe(403);

    // Внутренний сервис — пропустить
    const asService = await app.handleRequest({
      method: "GET",
      pathname: "/notifications/pending",
      context: { requestId: "req-2", service: true },
    });
    expect(asService.ok).toBe(true);
  });
});

describe("Авторизация: dev-режим и production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowDevAuth = process.env.ALLOW_DEV_AUTH;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowDevAuth === undefined) {
      delete process.env.ALLOW_DEV_AUTH;
    } else {
      process.env.ALLOW_DEV_AUTH = originalAllowDevAuth;
    }
  });

  it("x-user-id отвергается в production без явного флага", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_AUTH;

    const result = authenticateRequest({ "x-user-id": "кто-угодно" }, "token");
    expect(result.ok).toBe(false);
  });

  it("x-user-id работает вне production при ALLOW_DEV_AUTH=1", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_AUTH = "1";

    const result = authenticateRequest({ "x-user-id": "dev-user" }, "token");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe("dev-user");
  });

  it("x-user-id отвергается вне production без ALLOW_DEV_AUTH", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DEV_AUTH;

    const result = authenticateRequest({ "x-user-id": "dev-user" }, "token");
    expect(result.ok).toBe(false);
  });
});

describe("Регрессии: таймер, материалы и коды ответа", () => {
  /** Создаёт практику, расписание и запущенную сессию таймера. */
  async function setupTimer(userId = "alice") {
    const app = await createApp(":memory:");

    const practice = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: practiceBody({ userId }),
      context: { requestId: "p", userId },
    });
    expect(practice.ok).toBe(true);
    const practiceId = (practice as { ok: true; data: { id: string } }).data.id;

    const schedule = await app.handleRequest({
      method: "POST",
      pathname: "/schedule",
      body: {
        userId,
        date: "2026-01-01",
        title: "Утренний ритм",
        source: "manual",
        practices: [
          { practiceId, plannedStartTime: "07:00", plannedDurationMinutes: 30, order: 0 },
        ],
      },
      context: { requestId: "s", userId },
    });
    expect(schedule.ok).toBe(true);
    const scheduledPracticeId = (schedule as { ok: true; data: { items: Array<{ id: string }> } })
      .data.items[0].id;

    const started = await app.handleRequest({
      method: "POST",
      pathname: "/timer/start",
      body: { userId, scheduledPracticeId, practiceId, plannedDurationMinutes: 30 },
      context: { requestId: "t", userId },
    });
    expect(started.ok).toBe(true);

    return { app, practiceId, scheduledPracticeId };
  }

  it("POST /timer/add-time с minutes=5 добавляет ровно 300 секунд", async () => {
    const { app, scheduledPracticeId } = await setupTimer();

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/timer/add-time",
      body: { scheduledPracticeId, timestamp: new Date().toISOString(), minutes: 5 },
      context: { requestId: "a", userId: "alice" },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect((response.data as { actualDurationSeconds: number }).actualDurationSeconds).toBe(300);
    }
  });

  it("POST /timer/add-time с seconds добавляет указанные секунды", async () => {
    const { app, scheduledPracticeId } = await setupTimer();

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/timer/add-time",
      body: { scheduledPracticeId, timestamp: new Date().toISOString(), seconds: 90 },
      context: { requestId: "a", userId: "alice" },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect((response.data as { actualDurationSeconds: number }).actualDurationSeconds).toBe(90);
    }
  });

  it("POST /timer/add-time без minutes/seconds даёт 400, а не 500", async () => {
    const { app, scheduledPracticeId } = await setupTimer();

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/timer/add-time",
      body: { scheduledPracticeId, timestamp: new Date().toISOString() },
      context: { requestId: "a", userId: "alice" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(400);
  });

  it("запрос без авторизации даёт 401, а не 400", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      context: { requestId: "req-1" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(401);
  });

  it("материал к чужой практике даёт 403 даже с разрешённым доменом", async () => {
    const { app, practiceId } = await setupTimer();

    // Домен из белого списка, но практика принадлежит Алисе, а добавляет Боб.
    const response = await app.handleRequest({
      method: "POST",
      pathname: "/materials",
      body: {
        practiceId,
        title: "чужой материал",
        url: "https://advayta.org/x",
        type: "article",
        sourceDomain: "advayta.org",
      },
      context: { requestId: "m", userId: "bob" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(403);
  });

  it("материал к своей практике с разрешённым доменом создаётся", async () => {
    const { app, practiceId } = await setupTimer();

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/materials",
      body: {
        practiceId,
        title: "Статья о дыхании",
        url: "https://advayta.org/breath",
        type: "article",
        sourceDomain: "advayta.org",
      },
      context: { requestId: "m", userId: "alice" },
    });

    expect(response.ok).toBe(true);
  });
});

describe("Авторизация: Telegram init data", () => {
  it("принимает корректную подпись", () => {
    const token = "123456:AA-test-token";
    const initData = buildInitData(token, Math.floor(Date.now() / 1000));

    expect(validateTelegramInitData(initData, token)).toBe(true);

    const auth = authenticateRequest({ "x-telegram-init-data": initData }, token);
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.userId).toBe("42");
  });

  it("отвергает подпись, сделанную другим токеном", () => {
    const initData = buildInitData("123456:AA-настоящий", Math.floor(Date.now() / 1000));
    expect(validateTelegramInitData(initData, "123456:AA-чужой")).toBe(false);
  });

  it("отвергает устаревшую подпись (старше 24 часов)", () => {
    const token = "123456:AA-test-token";
    const stale = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const initData = buildInitData(token, stale);
    expect(validateTelegramInitData(initData, token)).toBe(false);
  });

  it("отвергает подпись без auth_date", () => {
    const params = new URLSearchParams({ user: JSON.stringify({ id: 1 }) });
    expect(validateTelegramInitData(params.toString(), "token")).toBe(false);
  });

  it("принимает init data в формате настоящего Telegram: кодированные значения, query_id с padding, поле signature", () => {
    const token = "123456:AA-real-telegram-shape";
    // Поля в том виде, в каком их присылает клиент Telegram: user закодирован,
    // у query_id есть «=»-padding, закодированный как %3D, есть ECDSA signature.
    const raw =
      "user=%7B%22id%22%3A987654321%2C%22first_name%22%3A%22%D0%98%D0%B2%D0%B0%D0%BD%22%2C%22username%22%3A%22ivan_test%22%7D" +
      "&query_id=AAH%2BdF6IQ%3D%3DAAAAAN0XohDhrOrc" +
      "&auth_date=" + Math.floor(Date.now() / 1000) +
      "&signature=abc123signature" +
      "&hash=PLACEHOLDER";
    const withoutHash = raw.replace(/&hash=PLACEHOLDER$/, "");
    const dataCheckString = withoutHash.split("&").sort().join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    const initData = `${withoutHash}&hash=${hash}`;

    expect(validateTelegramInitData(initData, token)).toBe(true);

    const auth = authenticateRequest({ "x-telegram-init-data": initData }, token);
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.userId).toBe("987654321");
      expect(auth.telegramUser?.first_name).toBe("Иван");
    }
  });

  it("принимает подпись, посчитанную по раскодированным значениям (вариант старых клиентов)", () => {
    const token = "123456:AA-test-token";
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42, first_name: "Demo" }),
    });
    // Раскодированные значения — так подписывают некоторые нестандартные клиенты.
    const decoded = Array.from(params.keys())
      .sort()
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secretKey).update(decoded).digest("hex");
    params.set("hash", hash);

    // Валидация мульти-вариантная: любой совпавший вариант одинаково
    // доказывает владение токеном бота.
    expect(validateTelegramInitData(params.toString(), token)).toBe(true);
  });

  it("принимает вариант без signature в строке проверки", () => {
    const token = "123456:AA-test-token";
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42, first_name: "Demo" }),
      signature: "c2lnbmF0dXJlLXNhbXBsZQ==",
    });
    // Часть клиентов не включает signature в строку проверки.
    const withoutSig = params
      .toString()
      .split("&")
      .filter((pair) => !pair.startsWith("signature="))
      .sort()
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secretKey).update(withoutSig).digest("hex");
    params.set("hash", hash);

    expect(validateTelegramInitData(params.toString(), token)).toBe(true);
  });
});

describe("Регрессия безопасности: защита от подделки Telegram init data", () => {
  const token = "123456:AA-security-token";

  it("отвергает валидную подпись с дописанным символом в конец hash", () => {
    const valid = buildInitData(token, Math.floor(Date.now() / 1000));
    const forged = valid.replace(/hash=[0-9a-fA-F]+/, (m) => `${m}0`);
    expect(forged).not.toBe(valid);
    expect(validateTelegramInitData(forged, token)).toBe(false);
  });

  it("отвергает валидную подпись с «мусором» (не-hex) в конце hash", () => {
    const valid = buildInitData(token, Math.floor(Date.now() / 1000));
    const forged = valid.replace(/hash=[0-9a-fA-F]+/, (m) => `${m}xx`);
    expect(validateTelegramInitData(forged, token)).toBe(false);
  });

  it("отвергает hash с перевёрнутым одним символом", () => {
    const valid = buildInitData(token, Math.floor(Date.now() / 1000));
    const corrupted = valid.replace(/(hash=[0-9a-fA-F]{63})([0-9a-fA-F])/, (_m, p1, p2) =>
      `${p1}${p2 === "0" ? "1" : "0"}`,
    );
    expect(validateTelegramInitData(corrupted, token)).toBe(false);
  });

  it("отвергает полностью подменённый hash", () => {
    const valid = buildInitData(token, Math.floor(Date.now() / 1000));
    const replaced = valid.replace(/hash=[0-9a-fA-F]+/, `hash=${"a".repeat(64)}`);
    expect(validateTelegramInitData(replaced, token)).toBe(false);
  });

  it("отвергает пустой hash (при свежем auth_date — отказ именно по формату)", () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42 }),
    });
    params.set("hash", "");
    expect(validateTelegramInitData(params.toString(), token)).toBe(false);
  });

  it("отвергает короткий (32 hex) hash (при свежем auth_date — отказ именно по формату)", () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42 }),
    });
    params.set("hash", "a".repeat(32));
    expect(validateTelegramInitData(params.toString(), token)).toBe(false);
  });
});
