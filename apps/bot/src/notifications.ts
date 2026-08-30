import type { NotificationJobRow } from "../../../packages/database/src";

export type BotTransport = {
  sendMessage(chatId: string, text: string, extra?: Record<string, unknown>): Promise<void>;
};

type NotificationCopy = { emoji: string; lead: string };

function notificationCopy(job: NotificationJobRow): NotificationCopy {
  switch (job.type) {
    case "morning":
      return { emoji: "🌅", lead: "Доброе утро. Сегодня:" };
    case "day":
      return { emoji: "☀️", lead: "Следующая практика:" };
    case "evening":
      return { emoji: "🌇", lead: "Вечерняя проверка:" };
    case "next_practice":
      return { emoji: "🔔", lead: "Пора перейти к практике:" };
    case "timer_finished":
      return { emoji: "🪷", lead: "Практика завершена:" };
    default:
      return { emoji: "📿", lead: "Напоминание:" };
  }
}

export function formatNotification(job: NotificationJobRow) {
  const payload = JSON.parse(job.payload_json || "{}") as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title : "Практика";
  const { emoji, lead } = notificationCopy(job);
  return `${emoji} ${lead} ${title}`;
}

export async function sendNotificationWithRetry(
  job: NotificationJobRow,
  transport: BotTransport,
  attempts = 3,
  baseDelayMs = 1000,
) {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await transport.sendMessage(job.user_id, formatNotification(job));
      return { ok: true as const, attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < attempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { ok: false as const, attempt: attempts, error: lastError };
}
