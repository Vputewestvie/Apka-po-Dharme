import type { ID } from "./types";

export class Statistics {
  constructor(
    public readonly userId: ID,
    public totalMinutes = 0,
    public completedCount = 0,
    public skippedCount = 0,
    public movedCount = 0,
    public streakDays = 0,
    public favoritePracticeIds: ID[] = [],
  ) {}

  get totalHours() {
    return Math.round((this.totalMinutes / 60) * 100) / 100;
  }

  get completionPercent() {
    const total = this.completedCount + this.skippedCount + this.movedCount;
    if (total === 0) return 0;
    return Math.round((this.completedCount / total) * 100);
  }

  registerCompleted(minutes: number, practiceId?: ID) {
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
