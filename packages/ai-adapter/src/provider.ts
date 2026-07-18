import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

export type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

export interface AiProvider {
  parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand>;
  parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand>;
  answerUserQuestion(request: AiTextRequest): Promise<string>;
}
