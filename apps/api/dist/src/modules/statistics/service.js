export class StatisticsService {
    statisticsRepository;
    constructor(statisticsRepository) {
        this.statisticsRepository = statisticsRepository;
    }
    async get(query) {
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
    refresh(userId) {
        return this.statisticsRepository.getSnapshot(userId);
    }
}
