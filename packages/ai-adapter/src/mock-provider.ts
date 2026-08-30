import type { AiProvider } from "./provider";
import type { AiInspiration, AiInspirationRequest, AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

/** Локальные запасные ответы: бот работает, даже когда AI не настроен. */
const fallbackKoan =
  "Ученик спросил мастера: «Сколько ещё ждать просветления?» — «А сколько у тебя заряжен телефон?» — «На весь день». — «Иди, попрактикуй, пока не разрядился».";

const fallbackCommentary =
  "Этот коан про тебя и твой телефон: правда всегда в руке, просто экран ярче. Положи его на пять минут — и текст дочитает сам себя.";

const fallbackLesson =
  "У монаха не было отопления, а у тебя есть тёплые носки — значит, и десять минут практики сегодня возможны. Начни с малого, продолжи тем же.";

export class MockAiProvider implements AiProvider {
  async parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand> {
    return {
      intent: "unknown",
      date: null,
      items: [],
      rawText: request.text,
    };
  }

  async parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand> {
    return {
      intent: "unknown",
      date: null,
      items: [],
      rawText: request.fileId,
    };
  }

  async answerUserQuestion(): Promise<string> {
    return "AI is disabled.";
  }

  async generateInspiration(request: AiInspirationRequest): Promise<AiInspiration> {
    const text =
      request.kind === "koan-commentary"
        ? fallbackCommentary
        : request.kind === "monk-lesson"
          ? fallbackLesson
          : fallbackKoan;
    return { text, generated: false };
  }
}
