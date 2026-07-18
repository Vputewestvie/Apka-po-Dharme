import { PracticeSession } from "../../../../../packages/domain/src";
import type { PracticeCompletionRepository, TimerRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import type { AutoCompleteTimerInput, StartTimerInput, TimerActionInput } from "./dto";

export class TimerService {
  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly completionRepository: PracticeCompletionRepository,
  ) {}

  async start(input: StartTimerInput) {
    const session = new PracticeSession(
      createId(),
      input.scheduledPracticeId,
      input.practiceId,
      input.userId,
      input.plannedDurationMinutes,
    );
    session.start(new Date().toISOString());
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "start", JSON.stringify({}));
    return session;
  }

  async pause(input: TimerActionInput) {
    const session = await this.getRequiredSession(input.scheduledPracticeId);
    session.pause(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "pause", JSON.stringify({}));
    return session;
  }

  async resume(input: TimerActionInput) {
    const session = await this.getRequiredSession(input.scheduledPracticeId);
    session.start(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "resume", JSON.stringify({}));
    return session;
  }

  async addTime(input: TimerActionInput) {
    const session = await this.getRequiredSession(input.scheduledPracticeId);
    const secondsToAdd = input.seconds ?? (input.minutes ?? 0) * 60;
    session.addTime(secondsToAdd);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(
      session.id,
      "add_time",
      JSON.stringify({ seconds: secondsToAdd }),
    );
    return session;
  }

  async complete(input: TimerActionInput) {
    const session = await this.getRequiredSession(input.scheduledPracticeId);
    session.complete(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "complete", JSON.stringify({}));
    await this.completionRepository.upsert(session);
    return session;
  }

  async autoComplete(input: AutoCompleteTimerInput) {
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

  async skip(input: TimerActionInput) {
    const session = await this.getRequiredSession(input.scheduledPracticeId);
    session.skip(input.timestamp, input.reason ?? null);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "skip", JSON.stringify({ reason: input.reason ?? null }));
    await this.completionRepository.upsert(session);
    return session;
  }

  private async getRequiredSession(scheduledPracticeId: string) {
    const session = await this.timerRepository.getByScheduledPracticeId(scheduledPracticeId);
    if (!session) throw new Error("Timer session not found");
    return session;
  }
}
