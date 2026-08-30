import { z } from "zod";
import type { ApiContainer } from "./container";
import type { ApiRequest, ApiResponse, JsonValue } from "./types";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  autoCompleteTimerSchema,
  cancelNotificationSchema,
  changeScheduledPracticeTimeSchema,
  createDiarySchema,
  diaryAiAnalyzeSchema,
  createScheduleSchema,
  markSentNotificationSchema,
  materialInputSchema,
  practiceIdSchema,
  practiceInputSchema,
  practiceUpdateSchema,
  removeScheduledPracticeSchema,
  repeatYesterdaySchema,
  replacePracticesSchema,
  scheduleAiTextSchema,
  scheduleAiVoiceSchema,
  scheduleNotificationSchema,
  startTimerSchema,
  timerActionSchema,
  userIdSchema,
} from "./validation";

type RouteHandler = (request: ApiRequest, container: ApiContainer) => Promise<ApiResponse<JsonValue>> | ApiResponse<JsonValue>;

type RouteDefinition = {
  method: ApiRequest["method"];
  pathname: string;
  handler: RouteHandler;
};

const ok = <T extends JsonValue>(data: T): ApiResponse<T> => ({ ok: true, data });

/**
 * Парсит и валидирует тело запроса по Zod-схеме.
 * Выбрасывает ValidationError при несоответствии.
 */
function validateWith<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data as z.infer<T>;
}

/**
 * Валидирует тело запроса и принудительно подставляет идентификатор
 * АВТОРИЗОВАННОГО пользователя.
 *
 * Любой `userId`, присланный в теле запроса, отбрасывается: иначе клиент мог бы
 * указать чужой идентификатор и читать или изменять данные в чужом аккаунте.
 */
function validateOwned<T extends z.ZodType>(schema: T, request: ApiRequest): z.infer<T> {
  const userId = requiredUserId(request);
  const raw = (typeof request.body === "object" && request.body !== null
    ? request.body
    : {}) as Record<string, unknown>;
  return validateWith(schema, { ...raw, userId });
}

/**
 * Требует, чтобы вызов пришёл от доверенного внутреннего сервиса (бота).
 * Эндпоинты уведомлений обслуживают всех пользователей, поэтому обычной
 * пользовательской авторизации здесь недостаточно.
 */
function requiredService(request: ApiRequest): void {
  if (request.context?.service !== true) {
    throw new ForbiddenError("Internal service token required");
  }
}

function requiredQuery(request: ApiRequest, key: string): string {
  const value = request.query?.[key];
  if (!value) {
    throw new ValidationError(`Missing query parameter: ${key}`);
  }
  return value;
}

function requiredUserId(request: ApiRequest): string {
  const userId = request.context?.userId;
  if (!userId) {
    // 401, а не 400: отсутствие авторизации — это не ошибка в теле запроса.
    throw new UnauthorizedError("Not authenticated");
  }
  return userId;
}

function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

const routeDefinitions: RouteDefinition[] = [
  // --- Health ---
  {
    method: "GET",
    pathname: "/health",
    handler: () =>
      ok({
        status: "ok",
        service: "api",
      }),
  },

  // --- Practices ---
  {
    method: "GET",
    pathname: "/practices",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      return ok(toJson(await container.practiceLibraryService.list(userId)));
    },
  },
  {
    method: "POST",
    pathname: "/practices",
    handler: async (request, container) => {
      const body = validateOwned(practiceInputSchema, request);
      return ok(toJson(await container.practiceLibraryService.create(body)));
    },
  },
  {
    method: "PATCH",
    pathname: "/practices",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(practiceUpdateSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.update(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/practices/archive",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const { practiceId } = validateWith(practiceIdSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.archive(practiceId, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/practices/restore",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const { practiceId } = validateWith(practiceIdSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.restore(practiceId, userId)));
    },
  },
  {
    method: "DELETE",
    pathname: "/practices",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const { practiceId } = validateWith(practiceIdSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.delete(practiceId, userId)));
    },
  },

  // --- Materials ---
  {
    method: "GET",
    pathname: "/materials",
    handler: async (request, container) => {
      const practiceId = requiredQuery(request, "practiceId");
      return ok(toJson(await container.practiceLibraryService.listMaterials(practiceId)));
    },
  },
  {
    method: "POST",
    pathname: "/materials",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(materialInputSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.addMaterial(body, userId)));
    },
  },

  // --- Schedule ---
  {
    method: "GET",
    pathname: "/schedule",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const date = requiredQuery(request, "date");
      return ok(toJson(await container.scheduleService.getByDate(userId, date)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule",
    handler: async (request, container) => {
      const body = validateOwned(createScheduleSchema, request);
      return ok(toJson(await container.scheduleService.create(body)));
    },
  },
  {
    method: "PUT",
    pathname: "/schedule/practices",
    handler: async (request, container) => {
      const body = validateOwned(replacePracticesSchema, request);
      return ok(toJson(await container.scheduleService.replacePractices(body.userId, body.date, body.practices, body.title)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/repeat-yesterday",
    handler: async (request, container) => {
      const body = validateOwned(repeatYesterdaySchema, request);
      return ok(toJson(await container.scheduleService.repeatYesterday(body)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/remove-practice",
    handler: async (request, container) => {
      const body = validateOwned(removeScheduledPracticeSchema, request);
      return ok(toJson(await container.scheduleService.removePractice(body)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/change-time",
    handler: async (request, container) => {
      const body = validateOwned(changeScheduledPracticeTimeSchema, request);
      return ok(toJson(await container.scheduleService.changeTime(body)));
    },
  },

  // --- Schedule AI ---
  {
    method: "POST",
    pathname: "/schedule/ai/text",
    handler: async (request, container) => {
      const body = validateOwned(scheduleAiTextSchema, request);
      return ok(toJson(await container.scheduleAiService.createFromText(body.userId, body.text, body.practiceNameToId)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/ai/voice",
    handler: async (request, container) => {
      const body = validateOwned(scheduleAiVoiceSchema, request);
      return ok(toJson(await container.scheduleAiService.createFromVoice(body.userId, body.fileId, body.practiceNameToId)));
    },
  },

  // --- Timer ---
  {
    method: "POST",
    pathname: "/timer/start",
    handler: async (request, container) => {
      const body = validateOwned(startTimerSchema, request);
      return ok(toJson(await container.timerService.start(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/pause",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.pause(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/resume",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.resume(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/add-time",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.addTime(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/complete",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.complete(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/auto-complete",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateOwned(autoCompleteTimerSchema, request);
      return ok(toJson(await container.timerService.autoComplete(body, userId)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/skip",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.skip(body, userId)));
    },
  },

  // --- Diary ---
  {
    method: "GET",
    pathname: "/diary",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      return ok(toJson(await container.diaryService.list(userId)));
    },
  },
  {
    method: "POST",
    pathname: "/diary",
    handler: async (request, container) => {
      const body = validateOwned(createDiarySchema, request);
      return ok(toJson(await container.diaryService.create(body)));
    },
  },
  {
    method: "POST",
    pathname: "/diary/ai/analyze",
    handler: async (request, container) => {
      const body = validateOwned(diaryAiAnalyzeSchema, request);
      const analysis = await container.diaryAiService.analyze(body.userId, body.question);
      return ok({ analysis });
    },
  },

  // --- Statistics ---
  {
    method: "GET",
    pathname: "/statistics",
    handler: async (request, container) => {
      const userId = requiredUserId(request);
      const period = (request.query?.period as "today" | "week" | "month" | "year" | "all" | undefined) ?? "all";
      return ok(toJson(await container.statisticsService.get({ userId, period })));
    },
  },
  {
    method: "POST",
    pathname: "/statistics/refresh",
    handler: async (request, container) => {
      const { userId } = validateOwned(userIdSchema, request);
      return ok(toJson(await container.statisticsService.refresh(userId)));
    },
  },

  // --- Notifications ---
  // Service-to-service: доступны только боту по служебному токену.
  {
    method: "GET",
    pathname: "/notifications/pending",
    handler: async (request, container) => {
      requiredService(request);
      return ok(toJson(await container.notificationService.listPending(request.query?.now)));
    },
  },
  {
    method: "POST",
    pathname: "/notifications",
    handler: async (request, container) => {
      requiredService(request);
      const body = validateWith(scheduleNotificationSchema, request.body);
      return ok(toJson(await container.notificationService.schedule(body)));
    },
  },
  {
    method: "POST",
    pathname: "/notifications/mark-sent",
    handler: async (request, container) => {
      requiredService(request);
      const body = validateWith(markSentNotificationSchema, request.body);
      await container.notificationService.markSent(body.jobId, body.sentAt);
      // markSent() — void; toJson(undefined) ронял бы ответ в 500 после успешной пометки.
      return ok({ markedSent: true });
    },
  },
  {
    method: "POST",
    pathname: "/notifications/cancel",
    handler: async (request, container) => {
      requiredService(request);
      const body = validateWith(cancelNotificationSchema, request.body);
      await container.notificationService.cancel(body.jobId);
      // cancel() — void; toJson(undefined) ронял бы ответ в 500 после успешной отмены.
      return ok({ cancelled: true });
    },
  },
];

export const routes = new Map(routeDefinitions.map((route) => [`${route.method} ${route.pathname}`, route.handler]));
