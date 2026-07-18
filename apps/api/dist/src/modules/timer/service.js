import { PracticeSession } from "../../../../../packages/domain/src";
import { createId } from "../../id";
export class TimerService {
    timerRepository;
    completionRepository;
    constructor(timerRepository, completionRepository) {
        this.timerRepository = timerRepository;
        this.completionRepository = completionRepository;
    }
    async start(input) {
        const session = new PracticeSession(createId(), input.scheduledPracticeId, input.practiceId, input.userId, input.plannedDurationMinutes);
        session.start(new Date().toISOString());
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "start", JSON.stringify({}));
        return session;
    }
    async pause(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        session.pause(input.timestamp);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "pause", JSON.stringify({}));
        return session;
    }
    async resume(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        session.start(input.timestamp);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "resume", JSON.stringify({}));
        return session;
    }
    async addTime(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        session.addTime(input.seconds ?? 0);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "add_time", JSON.stringify({ seconds: input.seconds ?? 0 }));
        return session;
    }
    async complete(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        session.complete(input.timestamp);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "complete", JSON.stringify({}));
        await this.completionRepository.upsert(session);
        return session;
    }
    async autoComplete(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        const plannedSeconds = session.plannedDurationMinutes * 60;
        if (plannedSeconds > 0 && session.actualDurationSeconds < plannedSeconds) {
            return session;
        }
        session.complete(input.timestamp);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "complete", JSON.stringify({ automatic: true }));
        await this.completionRepository.upsert(session);
        return session;
    }
    async skip(input) {
        const session = await this.getRequiredSession(input.scheduledPracticeId);
        session.skip(input.timestamp, input.reason ?? null);
        await this.timerRepository.upsert(session);
        await this.timerRepository.appendEvent(session.id, "skip", JSON.stringify({ reason: input.reason ?? null }));
        await this.completionRepository.upsert(session);
        return session;
    }
    async getRequiredSession(scheduledPracticeId) {
        const session = await this.timerRepository.getByScheduledPracticeId(scheduledPracticeId);
        if (!session)
            throw new Error("Timer session not found");
        return session;
    }
}
