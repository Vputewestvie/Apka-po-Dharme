export type ParsedScheduleItem = {
  practiceName: string;
  durationMinutes: number;
  timeOfDay: "morning" | "day" | "evening" | "any";
};

export type ParsedScheduleCommand = {
  intent: "create_schedule" | "modify_schedule" | "unknown";
  date: string | null;
  items: ParsedScheduleItem[];
  rawText: string;
};

export type AiTextRequest = {
  text: string;
  context?: Record<string, unknown>;
};

export type AiVoiceRequest = {
  fileId: string;
  context?: Record<string, unknown>;
};

/** Род вдохновения для бота: свежий коан или толкование. */
export type AiInspirationKind = "koan" | "koan-commentary" | "monk-lesson";

export type AiInspirationRequest = {
  kind: AiInspirationKind;
  /** Факты, которые AI обязан использовать (текст коана, данные монаха). */
  subject?: Record<string, string>;
};

export type AiInspiration = {
  text: string;
  /** true — ответ сгенерирован моделью, false — запасной локальный. */
  generated: boolean;
};
