import type { AiProvider } from "./provider";
import type { AiTextRequest, AiVoiceRequest, ParsedScheduleCommand } from "./types";
export declare class MockAiProvider implements AiProvider {
    parseScheduleText(request: AiTextRequest): Promise<ParsedScheduleCommand>;
    parseScheduleVoice(request: AiVoiceRequest): Promise<ParsedScheduleCommand>;
    answerUserQuestion(): Promise<string>;
}
//# sourceMappingURL=mock-provider.d.ts.map