import { PracticeSession } from "../../../../../packages/domain/src";
import type { PracticeCompletionRepository, PracticeRepository, ScheduleRepository, TimerRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import { ForbiddenError, NotFoundError, ValidationError } from "../../validation";
import type { AutoCompleteTimerInput, StartTimerInput, TimerActionInput } from "./dto";

export class TimerService {
  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly completionRepository: PracticeCompletionRepository,
    private readonly practiceRepository: PracticeRepository,
    private readonly scheduleRepository?: ScheduleRepository,
  ) {}

  async start(input: StartTimerInput) {
    // Таймер запускается по конкретной практике — проверяем, что она принадлежит
    // пользователю, иначе можно было бы крутить таймер по чужой практике.
    const practice = await this.practiceRepository.getById(input.practiceId);
    if (!practice) throw new NotFoundError("Practice not found");
    if (practice.userId !== input.userId) {
      throw new ForbiddenError("Practice belongs to another user");
    }

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

  async pause(input: TimerActionInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    session.pause(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "pause", JSON.stringify({}));
    return session;
  }

  async resume(input: TimerActionInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    session.start(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "resume", JSON.stringify({}));
    return session;
  }

  async addTime(input: TimerActionInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    const secondsToAdd = input.seconds ?? (input.minutes ?? 0) * 60;
    // Раньше нулевое значение доходило до домена и превращалось в 500.
    // Запрос без seconds/minutes — это ошибка валидации, а не падение сервера.
    if (!Number.isFinite(secondsToAdd) || secondsToAdd <= 0) {
      throw new ValidationError("Added time must be positive");
    }
    session.addTime(secondsToAdd);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(
      session.id,
      "add_time",
      JSON.stringify({ seconds: secondsToAdd }),
    );
    return session;
  }

  async complete(input: TimerActionInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    session.complete(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "complete", JSON.stringify({}));
    await this.completionRepository.upsert(session);
    await this.markScheduledItem(session.scheduledPracticeId, "completed");
    return session;
  }

  async autoComplete(input: AutoCompleteTimerInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    const plannedSeconds = session.plannedDurationMinutes * 60;
    if (plannedSeconds > 0 && session.actualDurationSeconds < plannedSeconds) {
      return session;
    }
    session.complete(input.timestamp);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "complete", JSON.stringify({ automatic: true }));
    await this.completionRepository.upsert(session);
    await this.markScheduledItem(session.scheduledPracticeId, "completed");
    return session;
  }

  async skip(input: TimerActionInput, userId: string) {
    const session = await this.getRequiredSession(input.scheduledPracticeId, userId);
    session.skip(input.timestamp, input.reason ?? null);
    await this.timerRepository.upsert(session);
    await this.timerRepository.appendEvent(session.id, "skip", JSON.stringify({ reason: input.reason ?? null }));
    await this.completionRepository.upsert(session);
    await this.markScheduledItem(session.scheduledPracticeId, "skipped");
    return session;
  }

  /** Отмечает пункт расписания, чтобы счётчик «Готово» не сбрасывался после перезагрузки. */
  private async markScheduledItem(
    scheduledPracticeId: string,
    status: "completed" | "skipped",
  ) {
    if (!this.scheduleRepository) return;
    try {
      await this.scheduleRepository.updateItemStatus(scheduledPracticeId, status);
    } catch {
      // Пункт расписания мог быть удалён или перемещён — статус сессии это не меняет.
    }
  }

  /** Находит сессию таймера и проверяет, что она принадлежит указанному пользователю. */
  private async getRequiredSession(scheduledPracticeId: string, userId: string) {
    const session = await this.timerRepository.getByScheduledPracticeId(scheduledPracticeId);
    if (!session) throw new NotFoundError("Timer session not found");
    if (session.userId !== userId) throw new ForbiddenError("Timer session belongs to another user");
    return session;
  }
}
