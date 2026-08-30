import type { AiInspiration, AiInspirationRequest, AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

export type { AiInspiration, AiInspirationRequest, AiInspirationKind } from "./types";

export interface AiProvider {
  parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand>;
  parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand>;
  answerUserQuestion(request: AiTextRequest): Promise<string>;
  /**
   * Вдохновение для бота. Провайдер может не уметь генерировать (mock,
   * выключенный ключ) — тогда возвращает запасной текст с generated: false.
   */
  generateInspiration?(request: AiInspirationRequest): Promise<AiInspiration>;
}
