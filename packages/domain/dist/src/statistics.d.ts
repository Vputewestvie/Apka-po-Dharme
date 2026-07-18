import type { ID } from "./types";
export declare class Statistics {
    readonly userId: ID;
    totalMinutes: number;
    completedCount: number;
    skippedCount: number;
    movedCount: number;
    streakDays: number;
    favoritePracticeIds: ID[];
    constructor(userId: ID, totalMinutes?: number, completedCount?: number, skippedCount?: number, movedCount?: number, streakDays?: number, favoritePracticeIds?: ID[]);
    get totalHours(): number;
    get completionPercent(): number;
    registerCompleted(minutes: number, practiceId?: ID): void;
    registerSkipped(): void;
    registerMoved(): void;
}
//# sourceMappingURL=statistics.d.ts.map