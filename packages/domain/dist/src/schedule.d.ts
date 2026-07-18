import type { CompletionStatus, ID, ISODate, ISODateTime, ScheduleSource, SessionStatus } from "./types";
export declare class ScheduledPractice {
    readonly id: ID;
    readonly practiceId: ID;
    plannedDate: ISODate;
    plannedStartTime: string | null;
    plannedDurationMinutes: number;
    order: number;
    status: SessionStatus;
    constructor(id: ID, practiceId: ID, plannedDate: ISODate, plannedStartTime: string | null, plannedDurationMinutes: number, order: number, status?: SessionStatus);
}
export declare class Schedule {
    readonly id: ID;
    readonly userId: ID;
    readonly date: ISODate;
    readonly source: ScheduleSource;
    title: string;
    readonly items: ScheduledPractice[];
    constructor(id: ID, userId: ID, date: ISODate, source?: ScheduleSource, title?: string, items?: ScheduledPractice[]);
    addPractice(item: ScheduledPractice): void;
    removePractice(itemId: ID): void;
}
export declare class PracticeSession {
    readonly id: ID;
    readonly scheduledPracticeId: ID;
    readonly practiceId: ID;
    readonly userId: ID;
    readonly plannedDurationMinutes: number;
    startedAt: ISODateTime | null;
    pausedAt: ISODateTime | null;
    finishedAt: ISODateTime | null;
    actualDurationSeconds: number;
    status: SessionStatus;
    result: CompletionStatus | null;
    skipReason: string | null;
    constructor(id: ID, scheduledPracticeId: ID, practiceId: ID, userId: ID, plannedDurationMinutes?: number, startedAt?: ISODateTime | null, pausedAt?: ISODateTime | null, finishedAt?: ISODateTime | null, actualDurationSeconds?: number, status?: SessionStatus, result?: CompletionStatus | null, skipReason?: string | null);
    start(at: ISODateTime): void;
    pause(at: ISODateTime): void;
    addTime(seconds: number): void;
    complete(at: ISODateTime): void;
    skip(at: ISODateTime, reason?: string | null): void;
    move(at: ISODateTime): void;
}
//# sourceMappingURL=schedule.d.ts.map