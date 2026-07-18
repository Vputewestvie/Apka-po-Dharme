import { Schedule, ScheduledPractice } from "../../../../../packages/domain/src";
import { createId } from "../../id";
function toScheduledPractice(date, input) {
    return new ScheduledPractice(createId(), input.practiceId, date, input.plannedStartTime, input.plannedDurationMinutes, input.order, "planned");
}
export class ScheduleService {
    scheduleRepository;
    practiceRepository;
    constructor(scheduleRepository, practiceRepository) {
        this.scheduleRepository = scheduleRepository;
        this.practiceRepository = practiceRepository;
    }
    getByDate(userId, date) {
        return this.scheduleRepository.getByUserIdAndDate(userId, date);
    }
    async create(input) {
        const schedule = new Schedule(createId(), input.userId, input.date, input.source ?? "manual", input.title);
        for (const item of input.practices.sort((a, b) => a.order - b.order)) {
            const practice = await this.practiceRepository.getById(item.practiceId);
            if (!practice)
                throw new Error("Practice not found");
            schedule.addPractice(toScheduledPractice(input.date, item));
        }
        await this.scheduleRepository.upsert(schedule);
        return schedule;
    }
    async repeatYesterday(input) {
        const previous = await this.scheduleRepository.getByUserIdAndDate(input.userId, input.previousDate);
        if (!previous)
            throw new Error("Previous schedule not found");
        const repeated = new Schedule(createId(), input.userId, input.date, "repeat_yesterday", input.title);
        for (const item of previous.items) {
            repeated.addPractice(new ScheduledPractice(createId(), item.practiceId, input.date, item.plannedStartTime, item.plannedDurationMinutes, item.order, "planned"));
        }
        await this.scheduleRepository.upsert(repeated);
        return repeated;
    }
    async replacePractices(userId, date, practices, title) {
        const schedule = await this.scheduleRepository.getByUserIdAndDate(userId, date);
        if (!schedule)
            throw new Error("Schedule not found");
        schedule.title = title;
        schedule.items.length = 0;
        for (const item of practices.sort((a, b) => a.order - b.order)) {
            const practice = await this.practiceRepository.getById(item.practiceId);
            if (!practice)
                throw new Error("Practice not found");
            schedule.addPractice(toScheduledPractice(date, item));
        }
        await this.scheduleRepository.upsert(schedule);
        return schedule;
    }
    async removePractice(input) {
        const schedule = await this.scheduleRepository.getByUserIdAndDate(input.userId, input.date);
        if (!schedule)
            throw new Error("Schedule not found");
        schedule.removePractice(input.scheduledPracticeId);
        await this.scheduleRepository.upsert(schedule);
        return schedule;
    }
    async changeTime(input) {
        const schedule = await this.scheduleRepository.getByUserIdAndDate(input.userId, input.date);
        if (!schedule)
            throw new Error("Schedule not found");
        const item = schedule.items.find((candidate) => candidate.id === input.scheduledPracticeId);
        if (!item)
            throw new Error("Scheduled practice not found");
        item.plannedStartTime = input.plannedStartTime;
        item.plannedDurationMinutes = input.plannedDurationMinutes;
        await this.scheduleRepository.upsert(schedule);
        return schedule;
    }
}
