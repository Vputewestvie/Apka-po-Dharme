import type { DiaryEntry, MaterialLink, Practice, PracticeSession, Schedule, Statistics } from "../../domain/src";
import type { DiaryEntryRow, MaterialLinkRow, NotificationJobRow, PracticeCompletionRow, ScheduleRow, UserRow, UserSettingsRow } from "./rows";

export interface UserRepository {
  getById(id: string): Promise<UserRow | null>;
  getByTelegramId(telegramId: number): Promise<UserRow | null>;
  upsert(user: UserRow): Promise<void>;
}

export interface SettingsRepository {
  getByUserId(userId: string): Promise<UserSettingsRow | null>;
  upsert(settings: UserSettingsRow): Promise<void>;
}

export interface PracticeRepository {
  listByUserId(userId: string): Promise<Practice[]>;
  getById(id: string): Promise<Practice | null>;
  upsert(practice: Practice): Promise<void>;
}

export interface ScheduleRepository {
  getByUserIdAndDate(userId: string, date: string): Promise<Schedule | null>;
  upsert(schedule: Schedule): Promise<void>;
}

export interface PracticeCompletionRepository {
  getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null>;
  upsert(completion: PracticeSession): Promise<void>;
}

export type TimerEventType = "start" | "pause" | "resume" | "add_time" | "finish_early" | "complete" | "skip" | "move";

export interface TimerRepository {
  getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null>;
  upsert(session: PracticeSession): Promise<void>;
  appendEvent(sessionId: string, eventType: TimerEventType, payloadJson: string): Promise<void>;
}

export interface DiaryRepository {
  listByUserId(userId: string): Promise<DiaryEntry[]>;
  upsert(entry: DiaryEntry): Promise<void>;
}

export interface StatisticsRepository {
  getSnapshot(userId: string): Promise<Statistics | null>;
  upsert(snapshot: Statistics): Promise<void>;
}

export interface MaterialRepository {
  listByPracticeId(practiceId: string): Promise<MaterialLink[]>;
  upsert(material: MaterialLink): Promise<void>;
}

export interface NotificationRepository {
  listPending(now: string): Promise<NotificationJobRow[]>;
  upsert(job: NotificationJobRow): Promise<void>;
  markSent(jobId: string, sentAt: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
}
