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
