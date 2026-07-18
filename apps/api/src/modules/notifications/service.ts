import type { NotificationRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import type { ScheduleNotificationInput } from "./dto";

export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async schedule(input: ScheduleNotificationInput) {
    const now = new Date().toISOString();
    const job = {
      id: createId(),
      user_id: input.userId,
      type: input.type,
      scheduled_at: input.scheduledAt,
      sent_at: null,
      status: "pending" as const,
      payload_json: JSON.stringify(input.payload),
      created_at: now,
      updated_at: now,
    };
    await this.notificationRepository.upsert(job);
    return job;
  }

  listPending(now = new Date().toISOString()) {
    return this.notificationRepository.listPending(now);
  }

  markSent(jobId: string, sentAt = new Date().toISOString()) {
    return this.notificationRepository.markSent(jobId, sentAt);
  }

  cancel(jobId: string) {
    return this.notificationRepository.cancel(jobId);
  }
}
