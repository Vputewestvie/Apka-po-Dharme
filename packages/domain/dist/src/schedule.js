export class ScheduledPractice {
    id;
    practiceId;
    plannedDate;
    plannedStartTime;
    plannedDurationMinutes;
    order;
    status;
    constructor(id, practiceId, plannedDate, plannedStartTime, plannedDurationMinutes, order, status = "planned") {
        this.id = id;
        this.practiceId = practiceId;
        this.plannedDate = plannedDate;
        this.plannedStartTime = plannedStartTime;
        this.plannedDurationMinutes = plannedDurationMinutes;
        this.order = order;
        this.status = status;
        if (plannedDurationMinutes <= 0)
            throw new Error("Scheduled practice duration must be positive");
    }
}
export class Schedule {
    id;
    userId;
    date;
    source;
    title;
    items;
    constructor(id, userId, date, source = "manual", title = "", items = []) {
        this.id = id;
        this.userId = userId;
        this.date = date;
        this.source = source;
        this.title = title;
        this.items = items;
    }
    addPractice(item) {
        this.items.push(item);
        this.items.sort((a, b) => a.order - b.order);
    }
    removePractice(itemId) {
        const index = this.items.findIndex((item) => item.id === itemId);
        if (index >= 0)
            this.items.splice(index, 1);
    }
}
export class PracticeSession {
    id;
    scheduledPracticeId;
    practiceId;
    userId;
    plannedDurationMinutes;
    startedAt;
    pausedAt;
    finishedAt;
    actualDurationSeconds;
    status;
    result;
    skipReason;
    constructor(id, scheduledPracticeId, practiceId, userId, plannedDurationMinutes = 0, startedAt = null, pausedAt = null, finishedAt = null, actualDurationSeconds = 0, status = "planned", result = null, skipReason = null) {
        this.id = id;
        this.scheduledPracticeId = scheduledPracticeId;
        this.practiceId = practiceId;
        this.userId = userId;
        this.plannedDurationMinutes = plannedDurationMinutes;
        this.startedAt = startedAt;
        this.pausedAt = pausedAt;
        this.finishedAt = finishedAt;
        this.actualDurationSeconds = actualDurationSeconds;
        this.status = status;
        this.result = result;
        this.skipReason = skipReason;
    }
    start(at) {
        if (this.status !== "planned" && this.status !== "paused")
            throw new Error("Session cannot be started");
        if (!this.startedAt)
            this.startedAt = at;
        this.status = "running";
        this.pausedAt = null;
    }
    pause(at) {
        if (this.status !== "running")
            throw new Error("Session cannot be paused");
        this.status = "paused";
        this.pausedAt = at;
    }
    addTime(seconds) {
        if (seconds <= 0)
            throw new Error("Added time must be positive");
        this.actualDurationSeconds += seconds;
    }
    complete(at) {
        if (this.status === "completed")
            return;
        this.status = "completed";
        this.result = "completed";
        this.finishedAt = at;
    }
    skip(at, reason = null) {
        this.status = "skipped";
        this.result = "skipped";
        this.finishedAt = at;
        this.skipReason = reason;
    }
    move(at) {
        this.status = "moved";
        this.result = "moved";
        this.finishedAt = at;
    }
}
