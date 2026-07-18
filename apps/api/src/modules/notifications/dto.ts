export type NotificationType = "morning" | "day" | "evening" | "next_practice" | "timer_finished";

export type ScheduleNotificationInput = {
  userId: string;
  type: NotificationType;
  scheduledAt: string;
  payload: Record<string, string | number | boolean | null>;
};
