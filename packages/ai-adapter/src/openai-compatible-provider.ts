import type { AiProvider } from "./provider";
import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";
import { parseJsonCommand } from "./parse-json-command";

export type OpenAiCompatibleConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModels?: string[];
};

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  private get fallbackModels(): string[] {
    return Array.from(
      new Set([
        ...(this.config.fallbackModels ?? []),
        "gpt-4o-mini",
        "deepseek/deepseek-v4-flash",
        "gpt-3o-mini",
      ])
    );
  }

  async parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand> {
    const prompt = `You are an assistant that parses Russian schedule commands into a strict JSON object.
Respond with ONLY valid JSON and no extra text.
The output object must use this schema:
{
  "intent": "create_schedule",
  "date": "YYYY-MM-DD",
  "items": [
    {"practiceName": "string", "durationMinutes": number, "timeOfDay": "morning|day|evening|any"}
  ],
  "rawText": "original text"
}
If the command contains relative date words like сегодня, завтра, послезавтра, вчера, next week, or tomorrow, convert them to the actual date in YYYY-MM-DD format.
If you cannot parse the command, return a JSON object with "intent":"unknown", "date":null, "items":[], "rawText":"original text".
Parse this Russian schedule command exactly:
${request.text}`;
    const content = await this.complete(prompt);
    return parseJsonCommand(content, request.text);
  }

  async parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand> {
    return {
      intent: "unknown",
      date: null,
      items: [],
      rawText: request.fileId,
    };
  }

  async answerUserQuestion(request: AiTextRequest): Promise<string> {
    return this.complete(request.text);
  }

  private async complete(prompt: string) {
    const tryModels = [this.config.model, ...this.fallbackModels].filter(Boolean);
    const lastErrorMessages: string[] = [];

    for (const model of tryModels) {
      const endpoints = [
        {
          path: "/chat/completions",
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 800,
          }),
        },
        {
          path: "/completions",
          body: JSON.stringify({
            model,
            prompt,
            temperature: 0,
            max_tokens: 800,
          }),
        },
      ];

      for (const endpoint of endpoints) {
        try {
          console.debug("[OpenAiCompatibleProvider] trying model", model, "endpoint", endpoint.path);
          const response = await fetch(`${this.config.baseUrl}${endpoint.path}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${this.config.apiKey}`,
            },
            body: endpoint.body,
          });

          const responseText = await response.text();
          if (!response.ok) {
            console.warn(
              "[OpenAiCompatibleProvider] model",
              model,
              "endpoint",
              endpoint.path,
              "failed",
              response.status,
              responseText
            );
            lastErrorMessages.push(`status=${response.status} endpoint=${endpoint.path} model=${model} text=${responseText}`);
            continue;
          }

          const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string }; text?: string }> };
          const content =
            data.choices?.[0]?.message?.content?.trim() ?? data.choices?.[0]?.text?.trim() ?? "";

          if (content.length > 0) {
            console.debug("[OpenAiCompatibleProvider] model", model, "endpoint", endpoint.path, "response content", content);
            return content;
          }

          console.warn(
            "[OpenAiCompatibleProvider] model",
            model,
            "endpoint",
            endpoint.path,
            "returned empty text",
            responseText
          );
          lastErrorMessages.push(`empty response endpoint=${endpoint.path} model=${model}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[OpenAiCompatibleProvider] model", model, "endpoint", endpoint.path, "error", message);
          lastErrorMessages.push(`endpoint=${endpoint.path} model=${model} error=${message}`);
        }
      }
    }

    throw new Error(`AI provider request failed: ${lastErrorMessages.join(" | ")}`);
  }
}

