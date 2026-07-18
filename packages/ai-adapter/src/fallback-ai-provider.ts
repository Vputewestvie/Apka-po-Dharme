import type { AiProvider } from "./provider";
import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";

export class FallbackAiProvider implements AiProvider {
  constructor(private readonly primary: AiProvider, private readonly fallback: AiProvider) {}

  async parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand> {
    return this.callWithFallback(() => this.primary.parseScheduleText(request), () => this.fallback.parseScheduleText(request));
  }

  async parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand> {
    return this.callWithFallback(() => this.primary.parseScheduleVoice(request), () => this.fallback.parseScheduleVoice(request));
  }

  async answerUserQuestion(request: AiTextRequest): Promise<string> {
    return this.callWithFallback(() => this.primary.answerUserQuestion(request), () => this.fallback.answerUserQuestion(request));
  }

  private async callWithFallback<T>(primaryCall: () => Promise<T>, fallbackCall: () => Promise<T>): Promise<T> {
    try {
      return await primaryCall();
    } catch (error) {
      if (shouldFallback(error)) {
        return fallbackCall();
      }
      throw error;
    }
  }
}

function shouldFallback(error: unknown) {
  if (!(error instanceof Error)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("failed") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("limit") ||
    message.includes("unavailable") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("500") ||
    message.includes("401") ||
    message.includes("403")
  );
}
