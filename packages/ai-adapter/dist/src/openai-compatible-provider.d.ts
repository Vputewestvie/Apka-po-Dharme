import type { AiProvider } from "./provider";
import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";
export type OpenAiCompatibleConfig = {
    baseUrl: string;
    apiKey: string;
    model: string;
};
export declare class OpenAiCompatibleProvider implements AiProvider {
    private readonly config;
    constructor(config: OpenAiCompatibleConfig);
    parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand>;
    parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand>;
    answerUserQuestion(request: AiTextRequest): Promise<string>;
    private complete;
}
//# sourceMappingURL=openai-compatible-provider.d.ts.map