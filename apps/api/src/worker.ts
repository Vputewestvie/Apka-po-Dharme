/**
 * Точка входа для Cloudflare Workers.
 *
 * Здесь только транспорт: разбор HTTP-запроса, аутентификация и отдача
 * статики. Вся бизнес-логика живёт в `handleRequest` и не знает, кто её
 * вызвал — Node-сервер (`http.ts`) или Workers.
 *
 * Отличия от Node-версии:
 *  - база приходит биндингом D1, файла на диске нет;
 *  - миграции накатываются заранее через `wrangler d1 migrations apply`;
 *  - бот работает не на long polling, а через webhook + cron;
 *  - статику отдаётWorkers Assets, а не чтение с диска.
 */

import { D1Client, type D1DatabaseLike } from "../../../packages/database/src/d1-client";
import { createBotApp } from "../../bot/src/main";
import { readBotConfig } from "../../bot/src/config";
import { createApp } from "./main";
import { authenticateRequest } from "./modules/auth";
import type { ApiRequest, JsonValue } from "./types";

/** Биндинги, которые Workers передаёт в обработчик. */
export interface WorkerEnv {
  DB: D1DatabaseLike;
  ASSETS: { fetch(request: Request): Promise<Response> };
  TELEGRAM_BOT_TOKEN: string;
  MINI_APP_URL?: string;
  INTERNAL_API_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  [key: string]: unknown;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,x-telegram-init-data,x-internal-token",
};

function json(status: number, body: JsonValue | null): Response {
  if (body === null) return new Response(null, { status, headers: JSON_HEADERS });
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function toHeadersLike(headers: Headers): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of headers.entries()) result[key] = value;
  return result;
}

/** Пути, которые обслуживает API (без точки — значит не статический файл). */
function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/health")
    || pathname.startsWith("/practices")
    || pathname.startsWith("/materials")
    || pathname.startsWith("/schedule")
    || pathname.startsWith("/timer")
    || pathname.startsWith("/diary")
    || pathname.startsWith("/statistics")
    || pathname.startsWith("/notifications")
    || pathname.startsWith("/bot");
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json(204, null);
    }

    // Проверка живости — без авторизации.
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, data: { status: "ok", service: "api" } });
    }

    // --- Webhook Telegram: бот получает обновления вместо long polling ---
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, env);
    }

    // Статика (собранная мини-апка) отдаётся биндингом Assets.
    if (!isApiPath(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const app = await createApp(new D1Client(env.DB));

    let body: JsonValue | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text) as JsonValue;
        } catch {
          return json(400, { ok: false, error: "Invalid JSON body" });
        }
      }
    }

    const auth = authenticateRequest(toHeadersLike(request.headers), env.TELEGRAM_BOT_TOKEN ?? "");
    if (!auth.ok && !auth.anonymous) {
      return json(401, { ok: false, error: auth.reason });
    }

    const apiRequest: ApiRequest = {
      method: request.method as ApiRequest["method"],
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      context: {
        requestId: crypto.randomUUID(),
        userId: auth.ok ? auth.userId : undefined,
        service: auth.ok ? (auth.service ?? false) : false,
        telegramUser: auth.ok ? auth.telegramUser : undefined,
      },
    };

    const result = await app.handleRequest(apiRequest);
    return json(result.ok ? 200 : result.status ?? 500, result);
  },

  /**
   * Cron: доставка отложенных уведомлений.
   *
   * В Node-версии этим занимался бесконечный цикл бота; в Workers постоянно
   * живущего процесса нет, поэтому очередь разгребается по расписанию.
   */
  async scheduled(_event: ScheduledEvent, env: WorkerEnv): Promise<void> {
    await flushNotifications(env);
  },
};

/**
 * Приём обновлений от Telegram.
 *
 * Обязательно проверяем секретный заголовок: иначе любой, узнав URL, сможет
 * слать боту поддельные сообщения от имени пользователей.
 */
async function handleTelegramWebhook(request: Request, env: WorkerEnv): Promise<Response> {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== expected) {
      return json(401, { ok: false, error: "Invalid webhook secret" });
    }
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  try {
    const bot = createBotApp(botConfig(env, new URL(request.url).origin), await createInProcessBotBackend(env));
    await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0]);
  } catch (error) {
    console.error("[worker] webhook failed", error);
    // Telegram повторит отправку при любой ошибке, поэтому лучше «проглотить»:
    // иначе он будет долбить мёртвый эндпоинт и заспамит логи.
  }

  return json(200, { ok: true });
}

/** Собирает конфиг бота из биндингов Workers. */
function botConfig(env: WorkerEnv, apiBaseUrl: string) {
  return readBotConfig({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    MINI_APP_URL: env.MINI_APP_URL ?? "",
    API_BASE_URL: apiBaseUrl,
    INTERNAL_API_TOKEN: env.INTERNAL_API_TOKEN ?? "",
  });
}

/**
 * In-process бэкенд «бот → данные».
 *
 * В Workers мини-апка и API живут в одном воркере. HTTP-подзапрос на
 * собственный workers.dev URL запрещён Cloudflare (error 1042), поэтому
 * и вебхук, и cron работают с данными напрямую через контейнер сервисов.
 */
async function createInProcessBotBackend(env: WorkerEnv) {
  const app = await createApp(new D1Client(env.DB));
  return {
    listPendingNotifications: (now: string) => app.container.notificationService.listPending(now),
    markNotificationSent: (jobId: string, sentAt: string) => app.container.notificationService.markSent(jobId, sentAt),
    inspire: async (kind: string, subject?: Record<string, string>) => {
      const inspiration = await app.container.aiService.generateInspiration(
        kind as "koan" | "koan-commentary" | "monk-lesson",
        subject,
      );
      return { text: inspiration.text };
    },
    listUserPractices: async (telegramId: number | string) => {
      const user = await app.container.userRepository.getByTelegramId(Number(telegramId));
      if (!user) return [];
      const practices = await app.container.practiceRepository.listByUserId(user.id);
      return practices
        .filter((practice) => !practice.archived)
        .map((practice) => ({
          id: practice.id,
          title: practice.title,
          minutes: practice.defaultDurationMinutes,
        }));
    },
  };
}

async function flushNotifications(env: WorkerEnv): Promise<void> {
  const inProcessBackend = await createInProcessBotBackend(env);
  const apiBaseUrl = env.MINI_APP_URL ? new URL(env.MINI_APP_URL).origin : "";
  const bot = createBotApp(botConfig(env, apiBaseUrl), inProcessBackend);
  await bot.flushNotifications();
}

// Описание типа события cron. Объявлен локально, чтобы не тащить
// @cloudflare/workers-types в проект, который собирается и под обычный Node.
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}
