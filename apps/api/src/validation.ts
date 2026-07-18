import { z } from "zod";

export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly issues: string[];

  constructor(message: string, issues?: string[]) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues ?? [message];
  }

  static fromZod(error: z.ZodError): ValidationError {
    const issues = error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return new ValidationError("Validation failed", issues);
  }
}

// --- Practice ---

export const practiceInputSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  title: z.string().min(1, "title is required").max(200),
  description: z.string().max(2000).optional().default(""),
  category: z.string().min(1, "category is required").max(100),
  defaultDurationMinutes: z.number().positive("defaultDurationMinutes must be positive"),
  color: z.string().optional().default("#688b76"),
  icon: z.string().optional().default("leaf"),
  image: z.object({
    kind: z.enum(["builtin", "user"]),
    ref: z.string(),
  }),
  notes: z.string().optional().default(""),
});

export const practiceUpdateSchema = z.object({
  practiceId: z.string().min(1, "practiceId is required"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100).optional(),
  defaultDurationMinutes: z.number().positive().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  image: z.object({
    kind: z.enum(["builtin", "user"]),
    ref: z.string(),
  }).optional(),
  notes: z.string().optional(),
});

export const materialInputSchema = z.object({
  practiceId: z.string().min(1),
  title: z.string().min(1).max(300),
  url: z.string().url("url must be a valid URL"),
  type: z.enum(["article", "video", "book", "lecture"]),
  sourceDomain: z.string().min(1),
});

// --- Schedule ---

export const schedulePracticeSchema = z.object({
  practiceId: z.string().min(1),
  plannedStartTime: z.string().nullable(),
  plannedDurationMinutes: z.number().positive(),
  order: z.number().int().min(0),
});

export const createScheduleSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  title: z.string().min(1).max(300),
  source: z.enum(["manual", "text_ai", "voice_ai", "repeat_yesterday"]).optional(),
  practices: z.array(schedulePracticeSchema).min(1, "at least one practice is required"),
});

export const replacePracticesSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(300),
  practices: z.array(schedulePracticeSchema),
});

export const repeatYesterdaySchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(300),
  previousDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const removeScheduledPracticeSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledPracticeId: z.string().min(1),
});

export const changeScheduledPracticeTimeSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledPracticeId: z.string().min(1),
  plannedStartTime: z.string().nullable(),
  plannedDurationMinutes: z.number().positive(),
});

// --- Schedule AI ---

export const scheduleAiTextSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1, "text is required"),
  practiceNameToId: z.record(z.string(), z.string()).optional().default({}),
});

export const scheduleAiVoiceSchema = z.object({
  userId: z.string().min(1),
  fileId: z.string().min(1, "fileId is required"),
  practiceNameToId: z.record(z.string(), z.string()).optional().default({}),
});

// --- Timer ---

export const startTimerSchema = z.object({
  userId: z.string().min(1),
  scheduledPracticeId: z.string().min(1),
  practiceId: z.string().min(1),
  plannedDurationMinutes: z.number().positive(),
});

export const timerActionSchema = z.object({
  scheduledPracticeId: z.string().min(1, "scheduledPracticeId is required"),
  timestamp: z.string().min(1, "timestamp is required"),
  reason: z.string().optional(),
});

export const autoCompleteTimerSchema = z.object({
  userId: z.string().min(1),
  scheduledPracticeId: z.string().min(1),
  practiceId: z.string().min(1),
  timestamp: z.string().min(1, "timestamp is required"),
});

// --- Diary ---

export const createDiarySchema = z.object({
  userId: z.string().min(1),
  practiceId: z.string().min(1),
  scheduledPracticeId: z.string().min(1),
  kind: z.enum(["text", "voice"]),
  text: z.string().optional().default(""),
});

// --- Notifications ---

export const scheduleNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["morning", "day", "evening", "next_practice", "timer_finished"]),
  scheduledAt: z.string().min(1),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

export const markSentNotificationSchema = z.object({
  jobId: z.string().min(1),
  sentAt: z.string().optional(),
});

export const cancelNotificationSchema = z.object({
  jobId: z.string().min(1),
});

// --- Auth / Archive ---

export const practiceIdSchema = z.object({
  practiceId: z.string().min(1),
});

export const userIdSchema = z.object({
  userId: z.string().min(1),
});