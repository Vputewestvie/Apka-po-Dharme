import type { AiProvider, ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";

export class AiService {
  constructor(private readonly provider: AiProvider) {}

  parseScheduleText(text: string, context?: Record<string, unknown>): Promise<ParsedScheduleCommand> {
    return this.provider.parseScheduleText({ text, context });
  }

  parseScheduleVoice(fileId: string, context?: Record<string, unknown>): Promise<ParsedScheduleCommand> {
    return this.provider.parseScheduleVoice({ fileId, context });
  }

  answerUserQuestion(text: string, context?: Record<string, unknown>): Promise<string> {
    return this.provider.answerUserQuestion({ text, context });
  }
}
