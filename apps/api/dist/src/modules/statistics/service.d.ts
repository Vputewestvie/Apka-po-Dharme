import type { StatisticsRepository } from "../../../../../packages/database/src";
import type { StatisticsQuery } from "./dto";
export declare class StatisticsService {
    private readonly statisticsRepository;
    constructor(statisticsRepository: StatisticsRepository);
    get(query: StatisticsQuery): Promise<{
        period: import("./dto").StatisticsPeriod;
        totalMinutes: number;
        totalHours: number;
        completedCount: number;
        skippedCount: number;
        movedCount: number;
        completionPercent: number;
        streakDays: number;
        favoritePracticeIds: string[];
    } | null>;
    refresh(userId: string): Promise<import("../../../../../packages/domain/src").Statistics | null>;
}
//# sourceMappingURL=service.d.ts.map