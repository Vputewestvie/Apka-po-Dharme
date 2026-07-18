export class Statistics {
    userId;
    totalMinutes;
    completedCount;
    skippedCount;
    movedCount;
    streakDays;
    favoritePracticeIds;
    constructor(userId, totalMinutes = 0, completedCount = 0, skippedCount = 0, movedCount = 0, streakDays = 0, favoritePracticeIds = []) {
        this.userId = userId;
        this.totalMinutes = totalMinutes;
        this.completedCount = completedCount;
        this.skippedCount = skippedCount;
        this.movedCount = movedCount;
        this.streakDays = streakDays;
        this.favoritePracticeIds = favoritePracticeIds;
    }
    get totalHours() {
        return Math.round((this.totalMinutes / 60) * 100) / 100;
    }
    get completionPercent() {
        const total = this.completedCount + this.skippedCount + this.movedCount;
        if (total === 0)
            return 0;
        return Math.round((this.completedCount / total) * 100);
    }
    registerCompleted(minutes, practiceId) {
        this.totalMinutes += minutes;
        this.completedCount += 1;
        if (practiceId && !this.favoritePracticeIds.includes(practiceId)) {
            this.favoritePracticeIds.push(practiceId);
        }
    }
    registerSkipped() {
        this.skippedCount += 1;
    }
    registerMoved() {
        this.movedCount += 1;
    }
}
