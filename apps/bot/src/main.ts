import { BackendApiClient } from "./backend-client";
import { commandToScreen, parseBotCommand } from "./commands";
import type { BotConfig } from "./config";
import { botMessages } from "./messages";
import { createMiniAppButton, createMiniAppLaunchLink } from "./mini-app";
import { sendNotificationWithRetry } from "./notifications";
import { TelegramBotApi, type TelegramUpdate } from "./telegram-api";

export function createBotApp(config: BotConfig) {
  const telegram = new TelegramBotApi(config.telegramBotToken);
  const backend = new BackendApiClient(config.apiBaseUrl);

  async function handleUpdate(update: TelegramUpdate) {
    const text = update.message?.text;
    const chatId = update.message?.chat.id;
    if (!text || !chatId) {
      return;
    }

    const command = parseBotCommand(text);
    if (!command) {
      await telegram.sendMessage(String(chatId), botMessages.unknown);
      return;
    }

    const screen = commandToScreen(command);
    const button = createMiniAppButton(config.miniAppUrl, screen ?? undefined);

    await telegram.sendMessage(String(chatId), botMessages[command], {
      reply_markup: button.reply_markup,
    });
  }

  async function flushNotifications() {
    const jobs = await backend.listPendingNotifications();
    for (const job of jobs) {
      const result = await sendNotificationWithRetry(job, {
        async sendMessage(chatId, text, extra) {
          await telegram.sendMessage(chatId, text, extra);
        },
      });

      if (result.ok) {
        await backend.markNotificationSent(job.id);
      } else {
        console.error(`[bot] notification failed after ${result.attempt} attempts`, job.id, result.error);
      }
    }
  }

  async function pollForever() {
    let offset = 0;

    for (;;) {
      try {
        const updates = await telegram.getUpdates(offset, config.pollingTimeoutSeconds);
        for (const update of updates) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } catch (error) {
        console.error("[bot] polling error", error instanceof Error ? error.message : error);
      }

      try {
        await flushNotifications();
      } catch (error) {
        console.error("[bot] notifications flush error", error instanceof Error ? error.message : error);
      }
    }
  }

  return {
    createMiniAppLaunchLink: (screen?: string) => createMiniAppLaunchLink(config.miniAppUrl, screen),
    flushNotifications,
    handleUpdate,
    pollForever,
  };
}