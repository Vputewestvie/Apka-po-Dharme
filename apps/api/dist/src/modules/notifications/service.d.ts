import type { NotificationRepository } from "../../../../../packages/database/src";
import type { ScheduleNotificationInput } from "./dto";
export declare class NotificationService {
    private readonly notificationRepository;
    constructor(notificationRepository: NotificationRepository);
    schedule(input: ScheduleNotificationInput): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        user_id: string;
        type: import("./dto").NotificationType;
        scheduled_at: string;
        sent_at: null;
        status: "pending";
        payload_json: string;
        created_at: string;
        updated_at: string;
    }>;
    listPending(now?: string): Promise<import("../../../../../packages/database/src").NotificationJobRow[]>;
    markSent(jobId: string, sentAt?: string): Promise<void>;
    cancel(jobId: string): Promise<void>;
}
//# sourceMappingURL=service.d.ts.map