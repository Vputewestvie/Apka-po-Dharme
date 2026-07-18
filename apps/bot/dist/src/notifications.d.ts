import type { NotificationJobRow } from "../../../packages/database/src";
export type BotTransport = {
    sendMessage(chatId: string, text: string): Promise<void>;
};
export declare function formatNotification(job: NotificationJobRow): string;
export declare function sendNotification(job: NotificationJobRow, transport: BotTransport): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map