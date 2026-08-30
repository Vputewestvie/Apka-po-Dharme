import type { AiProvider } from "./provider";
import type { AiInspiration, AiInspirationRequest, AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";
import { parseJsonCommand, todayIsoDate } from "./parse-json-command";
import { buildInspirationPrompt } from "./inspiration-prompts";

export type GoogleAiProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export class GoogleAiProvider implements AiProvider {
  constructor(private readonly config: GoogleAiProviderConfig) {}

  async parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand> {
    const prompt = `You are an assistant that parses Russian schedule commands into a strict JSON object. Respond with ONLY valid JSON and no extra text. The output object must use this schema:\n{\n  \"intent\": \"create_schedule\",\n  \"date\": \"YYYY-MM-DD\",\n  \"items\": [\n    {\"practiceName\": \"string\", \"durationMinutes\": number, \"timeOfDay\": \"morning|day|evening|any\"}\n  ],\n  \"rawText\": \"original text\"\n}\nToday's actual date is ${todayIsoDate()}. Always use it as the reference point: never invent another year or date.\nIf the command contains relative date words like сегодня, завтра, послезавтра, вчера, tomorrow, today, or yesterday, convert them to the actual date in YYYY-MM-DD format relative to today's date above.\nIf the command mentions no date at all, use today's date (${todayIsoDate()}).\nUsers often speak conversationally (например: «давай немножко медитируем, немножко погуляем»). Convert verbs and casual hints into practice names: медитируем → медитация, погуляем → прогулка, почитаем → чтение, подышим → дыхание.\nIf the text mentions ANY activity, always return at least one item. Use 15 as the default durationMinutes when no number is named («немножко», «чуть-чуть» ≈ 10).\nOnly return "intent":"unknown" with empty items when the text has nothing to do with planning practices (a greeting, a question, small talk).If you cannot parse the command, return a JSON object with \"intent\":\"unknown\", \"date\":null, \"items\":[], \"rawText\":\"original text\".\nParse this Russian schedule command exactly:\n${request.text}`;
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

  async generateInspiration(request: AiInspirationRequest): Promise<AiInspiration> {
    const content = await this.complete(buildInspirationPrompt(request));
    return { text: content, generated: true };
  }

  private async complete(prompt: string) {
    const baseUrl = normalizeBaseUrl(this.config.baseUrl ?? "https://generativelanguage.googleapis.com");
    const models = [`${baseUrl}/v1beta2/models/${this.config.model}:generateText`, `${baseUrl}/v1/models/${this.config.model}:generateText`];
    const body = JSON.stringify({
      prompt: {
        text: prompt,
      },
      temperature: 0,
      maxOutputTokens: 800,
    });

    const usesApiKeyQuery = /^AIza[0-9A-Za-z_-]{35}$/.test(this.config.apiKey);
    let lastError: Error | null = null;
    for (const url of models) {
      try {
        const requestUrl = usesApiKeyQuery ? `${url}?key=${encodeURIComponent(this.config.apiKey)}` : url;
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };

        if (!usesApiKeyQuery) {
          headers.authorization = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetch(requestUrl, {
          method: "POST",
          headers,
          body,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          if (response.status === 404 || /not found/i.test(text)) {
            lastError = new Error(`GoogleAI request path not found: ${response.status} ${response.statusText} ${text}`);
            continue;
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error(`GoogleAI authentication failed: ${response.status} ${response.statusText} ${text}`);
          }
          throw new Error(`GoogleAI request failed: ${response.status} ${response.statusText} ${text}`);
        }

        const data = await response.json();
        const content = extractGoogleContent(data);
        if (!content || typeof content !== "string" || content.trim().length === 0) {
          throw new Error("GoogleAI returned empty response");
        }

        return content;
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes("GoogleAI authentication failed")) {
            throw err;
          }
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error("GoogleAI request failed with no available endpoints");
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function extractGoogleContent(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data;

  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    if (typeof candidate === "string") return candidate;
    if (typeof candidate.content === "string") return candidate.content;
    if (typeof candidate.output === "string") return candidate.output;
  }

  if (typeof data.output === "string") return data.output;
  if (typeof data.text === "string") return data.text;
  if (typeof data.response === "string") return data.response;

  if (data.candidates && typeof data.candidates === "object") {
    const first = Object.values(data.candidates)[0] as unknown;
    if (typeof first === "string") return first;
    if (first && typeof (first as any).content === "string") return (first as any).content;
  }

  return "";
}
