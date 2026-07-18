import type { AiProvider } from "./provider";
import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

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
}
