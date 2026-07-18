import type { CompletionStatus, ID, ISODate, ISODateTime, ScheduleSource, SessionStatus } from "./types";

export class ScheduledPractice {
  constructor(
    public readonly id: ID,
    public readonly practiceId: ID,
    public plannedDate: ISODate,
    public plannedStartTime: string | null,
    public plannedDurationMinutes: number,
    public order: number,
    public status: SessionStatus = "planned",
  ) {
    if (plannedDurationMinutes <= 0) throw new Error("Scheduled practice duration must be positive");
  }
}

export class Schedule {
  constructor(
    public readonly id: ID,
    public readonly userId: ID,
    public readonly date: ISODate,
    public readonly source: ScheduleSource = "manual",
    public title: string = "",
    public readonly items: ScheduledPractice[] = [],
  ) {}

  addPractice(item: ScheduledPractice) {
    this.items.push(item);
    this.items.sort((a, b) => a.order - b.order);
  }

  removePractice(itemId: ID) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index >= 0) this.items.splice(index, 1);
  }
}

export class PracticeSession {
  constructor(
    public readonly id: ID,
    public readonly scheduledPracticeId: ID,
    public readonly practiceId: ID,
    public readonly userId: ID,
    public readonly plannedDurationMinutes = 0,
    public startedAt: ISODateTime | null = null,
    public pausedAt: ISODateTime | null = null,
    public finishedAt: ISODateTime | null = null,
    public actualDurationSeconds = 0,
    public status: SessionStatus = "planned",
    public result: CompletionStatus | null = null,
    public skipReason: string | null = null,
  ) {}

  start(at: ISODateTime) {
    if (this.status !== "planned" && this.status !== "paused") throw new Error("Session cannot be started");
    if (!this.startedAt) this.startedAt = at;
    this.status = "running";
    this.pausedAt = null;
  }

  pause(at: ISODateTime) {
    if (this.status !== "running") throw new Error("Session cannot be paused");
    this.status = "paused";
    this.pausedAt = at;
  }

  addTime(seconds: number) {
    if (seconds <= 0) throw new Error("Added time must be positive");
    this.actualDurationSeconds += seconds;
  }

  complete(at: ISODateTime) {
    if (this.status === "completed") return;
    this.status = "completed";
    this.result = "completed";
    this.finishedAt = at;
  }

  skip(at: ISODateTime, reason: string | null = null) {
    this.status = "skipped";
    this.result = "skipped";
    this.finishedAt = at;
    this.skipReason = reason;
  }

  move(at: ISODateTime) {
    this.status = "moved";
    this.result = "moved";
    this.finishedAt = at;
  }
}
