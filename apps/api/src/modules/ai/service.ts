import type { AiInspiration, AiInspirationKind, AiProvider, ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";

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

  /**
   * Вдохновение для бота (коаны, толкования, уроки). Провайдер обязан
   * поддерживать generateInspiration — контейнер собирает только таких.
   */
  generateInspiration(kind: AiInspirationKind, subject?: Record<string, string>): Promise<AiInspiration> {
    const provider = this.provider as AiProvider;
    if (!provider.generateInspiration) {
      throw new Error("AI provider does not support inspiration");
    }
    return provider.generateInspiration({ kind, subject });
  }
}
