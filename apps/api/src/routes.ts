import { z } from "zod";
import type { ApiContainer } from "./container";
import type { ApiRequest, ApiResponse, JsonValue } from "./types";
import {
  ValidationError,
  autoCompleteTimerSchema,
  cancelNotificationSchema,
  changeScheduledPracticeTimeSchema,
  createDiarySchema,
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
    throw new ValidationError("Not authenticated");
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
      const body = validateWith(practiceInputSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.create(body)));
    },
  },
  {
    method: "PATCH",
    pathname: "/practices",
    handler: async (request, container) => {
      const body = validateWith(practiceUpdateSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.update(body)));
    },
  },
  {
    method: "POST",
    pathname: "/practices/archive",
    handler: async (request, container) => {
      const { practiceId } = validateWith(practiceIdSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.archive(practiceId)));
    },
  },
  {
    method: "POST",
    pathname: "/practices/restore",
    handler: async (request, container) => {
      const { practiceId } = validateWith(practiceIdSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.restore(practiceId)));
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
      const body = validateWith(materialInputSchema, request.body);
      return ok(toJson(await container.practiceLibraryService.addMaterial(body)));
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
      const body = validateWith(createScheduleSchema, request.body);
      return ok(toJson(await container.scheduleService.create(body)));
    },
  },
  {
    method: "PUT",
    pathname: "/schedule/practices",
    handler: async (request, container) => {
      const body = validateWith(replacePracticesSchema, request.body);
      return ok(toJson(await container.scheduleService.replacePractices(body.userId, body.date, body.practices, body.title)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/repeat-yesterday",
    handler: async (request, container) => {
      const body = validateWith(repeatYesterdaySchema, request.body);
      return ok(toJson(await container.scheduleService.repeatYesterday(body)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/remove-practice",
    handler: async (request, container) => {
      const body = validateWith(removeScheduledPracticeSchema, request.body);
      return ok(toJson(await container.scheduleService.removePractice(body)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/change-time",
    handler: async (request, container) => {
      const body = validateWith(changeScheduledPracticeTimeSchema, request.body);
      return ok(toJson(await container.scheduleService.changeTime(body)));
    },
  },

  // --- Schedule AI ---
  {
    method: "POST",
    pathname: "/schedule/ai/text",
    handler: async (request, container) => {
      const body = validateWith(scheduleAiTextSchema, request.body);
      return ok(toJson(await container.scheduleAiService.createFromText(body.userId, body.text, body.practiceNameToId)));
    },
  },
  {
    method: "POST",
    pathname: "/schedule/ai/voice",
    handler: async (request, container) => {
      const body = validateWith(scheduleAiVoiceSchema, request.body);
      return ok(toJson(await container.scheduleAiService.createFromVoice(body.userId, body.fileId, body.practiceNameToId)));
    },
  },

  // --- Timer ---
  {
    method: "POST",
    pathname: "/timer/start",
    handler: async (request, container) => {
      const body = validateWith(startTimerSchema, request.body);
      return ok(toJson(await container.timerService.start(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/pause",
    handler: async (request, container) => {
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.pause(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/resume",
    handler: async (request, container) => {
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.resume(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/add-time",
    handler: async (request, container) => {
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.addTime(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/complete",
    handler: async (request, container) => {
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.complete(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/auto-complete",
    handler: async (request, container) => {
      const body = validateWith(autoCompleteTimerSchema, request.body);
      return ok(toJson(await container.timerService.autoComplete(body)));
    },
  },
  {
    method: "POST",
    pathname: "/timer/skip",
    handler: async (request, container) => {
      const body = validateWith(timerActionSchema, request.body);
      return ok(toJson(await container.timerService.skip(body)));
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
      const body = validateWith(createDiarySchema, request.body);
      return ok(toJson(await container.diaryService.create(body)));
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
      const { userId } = validateWith(userIdSchema, request.body);
      return ok(toJson(await container.statisticsService.refresh(userId)));
    },
  },

  // --- Notifications ---
  {
    method: "GET",
    pathname: "/notifications/pending",
    handler: async (request, container) => ok(toJson(await container.notificationService.listPending(request.query?.now))),
  },
  {
    method: "POST",
    pathname: "/notifications",
    handler: async (request, container) => {
      const body = validateWith(scheduleNotificationSchema, request.body);
      return ok(toJson(await container.notificationService.schedule(body)));
    },
  },
  {
    method: "POST",
    pathname: "/notifications/mark-sent",
    handler: async (request, container) => {
      const body = validateWith(markSentNotificationSchema, request.body);
      return ok(toJson(await container.notificationService.markSent(body.jobId, body.sentAt)));
    },
  },
  {
    method: "POST",
    pathname: "/notifications/cancel",
    handler: async (request, container) => {
      const body = validateWith(cancelNotificationSchema, request.body);
      return ok(toJson(await container.notificationService.cancel(body.jobId)));
    },
  },
];

export const routes = new Map(routeDefinitions.map((route) => [`${route.method} ${route.pathname}`, route.handler]));