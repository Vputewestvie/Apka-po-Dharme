import type { AiProvider, ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";
export declare class AiService {
    private readonly provider;
    constructor(provider: AiProvider);
    parseScheduleText(text: string, context?: Record<string, unknown>): Promise<ParsedScheduleCommand>;
    parseScheduleVoice(fileId: string, context?: Record<string, unknown>): Promise<ParsedScheduleCommand>;
    answerUserQuestion(text: string, context?: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=service.d.ts.map