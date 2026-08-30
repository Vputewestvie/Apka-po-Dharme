import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBotApp } from "../../../bot/src/main";
import type { BotConfig } from "../../../bot/src/config";
import type { TelegramUpdate } from "../../../bot/src/telegram-api";

/**
 * Регрессия: кнопка «Джапа» в главном меню.
 *
 * Кнопка шлёт callback_data «japa:0». Обработчик знал только «japa:tap:<n>»
 * и «japa:reset», поэтому «japa:0» проваливался в default-ветку, и казалось,
 * что кнопка не работает вовсе. Тест фиксирует, что любой «japa:<число>»
 * открывает счётчик.
 *
 * Сеть подменяется: нас интересует только маршрутизация колбэка и то, что
 * бот реально вызывает editMessageText, а не молча проглатывает нажатие.
 */

type RecordedCall = { url: string; body: Record<string, unknown> };

const config: BotConfig = {
  telegramBotToken: "123456:AA-test-token",
  miniAppUrl: "https://example.test",
  apiBaseUrl: "http://localhost:1",
  pollingTimeoutSeconds: 1,
  internalToken: "internal-test-token",
};

const backend = {
  listPendingNotifications: async () => [],
  markNotificationSent: async () => true,
  inspire: async () => ({ text: "тест", generated: false }),
  listUserPractices: async () => [],
};

let calls: RecordedCall[] = [];
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function callbackUpdate(data: string): TelegramUpdate {
  return {
    update_id: 1,
    callback_query: {
      id: "cb-1",
      from: { id: 555, first_name: "Тест" },
      data,
      message: { message_id: 42, chat: { id: 555 } },
    },
  };
}

function edits() {
  return calls.filter((c) => c.url.includes("/editMessageText"));
}

function answerToasts() {
  return calls.filter((c) => c.url.includes("/answerCallbackQuery"));
}

describe("Бот: счётчик джапы", () => {
  it("«japa:0» из главного меню открывает счётчик (кнопка работала вхолостую)", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:0"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("0 / 108");
    // Нажатие обязано быть подтверждено, иначе Telegram крутит индикатор.
    expect(answerToasts()).toHaveLength(1);
  });

  it("«japa:41» открывает счётчик на переданном числе", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:41"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("41 / 108");
  });

  it("«japa:tap:0» увеличивает счёт на единицу", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:tap:0"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("1 / 108");
  });

  it("«japa:tap:107» упирается в 108 и не уходит дальше", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:tap:107"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("108 / 108");
  });

  it("«japa:reset» обнуляет счёт", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:reset"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("0 / 108");
  });

  it("число выше 108 не пробивает потолок малы", async () => {
    const bot = createBotApp(config, backend);
    await bot.handleUpdate(callbackUpdate("japa:500"));

    const edited = edits();
    expect(edited).toHaveLength(1);
    expect(String(edited[0].body.text)).toContain("108 / 108");
  });

  it("неизвестный колбэк не роняет бота", async () => {
    const bot = createBotApp(config, backend);
    await expect(bot.handleUpdate(callbackUpdate("что-то-неизвестное"))).resolves.toBeUndefined();
  });
});
