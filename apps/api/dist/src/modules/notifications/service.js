import { createId } from "../../id";
export class NotificationService {
    notificationRepository;
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }
    async schedule(input) {
        const now = new Date().toISOString();
        const job = {
            id: createId(),
            user_id: input.userId,
            type: input.type,
            scheduled_at: input.scheduledAt,
            sent_at: null,
            status: "pending",
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
    markSent(jobId, sentAt = new Date().toISOString()) {
        return this.notificationRepository.markSent(jobId, sentAt);
    }
    cancel(jobId) {
        return this.notificationRepository.cancel(jobId);
    }
}
