import type { AiService } from "../ai";
import { ScheduleService } from "./service";
export declare class ScheduleAiService {
    private readonly aiService;
    private readonly scheduleService;
    constructor(aiService: AiService, scheduleService: ScheduleService);
    createFromText(userId: string, text: string, practiceNameToId: Record<string, string>): Promise<import("../../../../../packages/domain/src").Schedule>;
    createFromVoice(userId: string, fileId: string, practiceNameToId: Record<string, string>): Promise<import("../../../../../packages/domain/src").Schedule>;
}
//# sourceMappingURL=ai-service.d.ts.map