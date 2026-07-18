import type { StatisticsRepository } from "../../../../../packages/database/src";
import type { StatisticsQuery } from "./dto";

export class StatisticsService {
  constructor(private readonly statisticsRepository: StatisticsRepository) {}

  async get(query: StatisticsQuery) {
    const statistics = await this.statisticsRepository.getSnapshot(query.userId);
    if (!statistics) {
      return null;
    }

    return {
      period: query.period,
      totalMinutes: statistics.totalMinutes,
      totalHours: statistics.totalHours,
      completedCount: statistics.completedCount,
      skippedCount: statistics.skippedCount,
      movedCount: statistics.movedCount,
      completionPercent: statistics.completionPercent,
      streakDays: statistics.streakDays,
      favoritePracticeIds: statistics.favoritePracticeIds,
    };
  }

  refresh(userId: string) {
    return this.statisticsRepository.getSnapshot(userId);
  }
}
