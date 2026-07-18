export type ID = string;

export type ISODate = string;
export type ISODateTime = string;

export type PracticeCategory = string;

export type PracticeSource = "manual" | "template" | "ai";
export type ScheduleSource = "manual" | "text_ai" | "voice_ai" | "repeat_yesterday";

export type SessionStatus = "planned" | "running" | "paused" | "completed" | "skipped" | "moved";
export type CompletionStatus = "completed" | "skipped" | "moved";
export type JournalKind = "text" | "voice";
export type MaterialType = "article" | "video" | "book" | "lecture";
