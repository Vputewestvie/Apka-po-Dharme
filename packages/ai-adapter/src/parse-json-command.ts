import type { ParsedScheduleCommand, ParsedScheduleItem } from "./types";

export function parseJsonCommand(content: string, rawText: string): ParsedScheduleCommand {
  const normalized = normalizeJsonContent(content);
  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    const parsedItems = normalizeItems(parsed);
    const date = normalizeDate(parsed, rawText);

    return {
      intent: (parsed.intent as ParsedScheduleCommand["intent"]) ?? "unknown",
      date,
      items: parsedItems,
      rawText,
    };
  } catch {
    return {
      intent: "unknown",
      date: null,
      items: [],
      rawText,
    };
  }
}

function normalizeJsonContent(content: string) {
  let text = content.trim();

  const fencedJson = /```json\s*([\s\S]*?)\s*```/i.exec(text);
  if (fencedJson?.[1]) {
    text = fencedJson[1].trim();
  } else {
    const fenced = /```\s*([\s\S]*?)\s*```/.exec(text);
    if (fenced?.[1]) {
      text = fenced[1].trim();
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function normalizeItems(parsed: Record<string, unknown>) {
  const items: ParsedScheduleItem[] = [];
  const rawItems = parsed.items ?? parsed.activities ?? parsed.activities_list ?? [];

  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const practiceName =
          typeof record.practiceName === "string"
            ? record.practiceName
            : typeof record.name === "string"
            ? record.name
            : typeof record.name_en === "string"
            ? record.name_en
            : "";
        const durationMinutes =
          typeof record.durationMinutes === "number"
            ? record.durationMinutes
            : typeof record.duration_minutes === "number"
            ? record.duration_minutes
            : typeof record.duration_minute === "number"
            ? record.duration_minute
            : 0;
        const timeOfDay =
          record.timeOfDay === "morning" ||
          record.timeOfDay === "day" ||
          record.timeOfDay === "evening" ||
          record.timeOfDay === "any"
            ? record.timeOfDay
            : "any";

        if (practiceName && durationMinutes > 0) {
          items.push({ practiceName, durationMinutes, timeOfDay });
        }
      }
    }
  }

  return items;
}

function normalizeDate(parsed: Record<string, unknown>, rawText: string) {
  const maybeDate = parsed.date ?? parsed.date_iso ?? parsed.dateYYYYMMDD;
  if (typeof maybeDate === "string" && maybeDate.trim()) {
    return maybeDate;
  }

  const relative =
    typeof parsed.date_relative === "string"
      ? parsed.date_relative
      : typeof parsed.dateRelative === "string"
      ? parsed.dateRelative
      : typeof parsed.date_relative_en === "string"
      ? parsed.date_relative_en
      : typeof parsed.dateRelativeEn === "string"
      ? parsed.dateRelativeEn
      : null;

  if (typeof relative === "string") {
    const normalized = relative.trim().toLowerCase();
    const computed = parseRelativeDate(normalized);
    if (computed) {
      return computed;
    }
  }

  if (typeof parsed.date === "string") {
    return parsed.date;
  }

  if (rawText.trim()) {
    const relative = rawText.trim().toLowerCase();
    const computed = parseRelativeDate(relative);
    if (computed) {
      return computed;
    }
  }

  return null;
}

function parseRelativeDate(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const russian = value.replace(/\s+/g, " ").trim();
  if (russian === "завтра") {
    return toIsoDate(addDays(today, 1));
  }
  if (russian === "послезавтра") {
    return toIsoDate(addDays(today, 2));
  }
  if (russian === "сегодня") {
    return toIsoDate(today);
  }
  if (russian === "вчера") {
    return toIsoDate(addDays(today, -1));
  }
  if (russian === "tomorrow") {
    return toIsoDate(addDays(today, 1));
  }
  if (russian === "today") {
    return toIsoDate(today);
  }
  if (russian === "yesterday") {
    return toIsoDate(addDays(today, -1));
  }

  return null;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
