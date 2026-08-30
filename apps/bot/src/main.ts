import { BackendApiClient } from "./backend-client";
import type { BotConfig } from "./config";
import { commandToScreen, parseBotCommand, telegramMenuCommands } from "./commands";
import { koanByIndex, koanOfDay } from "./content/koans";
import { monkById, monkOfDay, nextMonk } from "./content/monks";
import { randomFromPool } from "./content/wheel-pool";
import {
  aiCommentaryKeyboard,
  aiKoanKeyboard,
  japaKeyboard,
  koanCardKeyboard,
  mainMenuKeyboard,
  monkKeyboard,
  monkLessonKeyboard,
  openDiaryKeyboard,
  wheelKeyboard,
} from "./keyboards";
import {
  aiKoanText,
  aiTeacherText,
  botMessages,
  htmlParseMode,
  japaText,
  koanCardText,
  koanKindLabel,
  monkCardText,
  monkLessonText,
  welcomeCardText,
  wheelResultText,
  wheelSpinningFrames,
} from "./messages";
import { createMiniAppLaunchLink } from "./mini-app";
import { sendNotificationWithRetry } from "./notifications";
import { TelegramBotApi, type TelegramCallbackQuery, type TelegramUpdate } from "./telegram-api";

type BotBackend = Pick<
  BackendApiClient,
  "listPendingNotifications" | "markNotificationSent" | "inspire" | "listUserPractices"
>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Установка меню команд — один раз на процесс/изолят. setMyCommands
 * идемпотентен, а при ошибке (сеть) сбрасываем промис и пробуем на
 * следующем апдейте.
 */
let menuSetupPromise: Promise<void> | null = null;
function ensureBotMenu(telegram: TelegramBotApi): Promise<void> {
  if (!menuSetupPromise) {
    menuSetupPromise = telegram
      .setMyCommands(telegramMenuCommands)
      .then(() => undefined)
      .catch((error) => {
        console.error("[bot] setMyCommands failed", error instanceof Error ? error.message : error);
        menuSetupPromise = null;
      });
  }
  return menuSetupPromise;
}

export function createBotApp(
  config: BotConfig,
  /**
   * Слой «бот → данные». По умолчанию — HTTP-клиент к API, но Workers
   * передаёт сюда процессный бэкенд: воркеру запрещено делать подзапрос
   * на собственный URL (Cloudflare error 1042).
   */
  backend: BotBackend = new BackendApiClient(config.apiBaseUrl, config.internalToken),
) {
  const telegram = new TelegramBotApi(config.telegramBotToken);

  // --- Отправка карточек ---

  function sendKoanCard(chatId: number, telegramId: number) {
    const { index, entry } = koanOfDay(telegramId);
    return telegram.sendMessage(String(chatId), koanCardText(entry, koanKindLabel(entry)), {
      ...htmlParseMode,
      reply_markup: koanCardKeyboard(index),
    });
  }

  function sendMonkCard(chatId: number, ofDay: boolean) {
    const monk = ofDay ? monkOfDay().entry : nextMonk(monkOfDay().entry.id);
    return telegram.sendMessage(String(chatId), monkCardText(monk, ofDay), {
      ...htmlParseMode,
      reply_markup: monkKeyboard(monk.id),
    });
  }

  // --- Команды (сообщения) ---

  async function handleMessage(update: TelegramUpdate) {
    const text = update.message?.text;
    const chatId = update.message?.chat.id;
    if (!text || !chatId) {
      return;
    }

    const fromId = update.message?.from?.id ?? chatId;
    const firstName = update.message?.from?.first_name;
    const command = parseBotCommand(text);

    switch (command) {
      case "/start": {
        await telegram.sendMessage(String(chatId), welcomeCardText(firstName), {
          ...htmlParseMode,
          reply_markup: mainMenuKeyboard(config.miniAppUrl),
        });
        return;
      }
      case "/help": {
        await telegram.sendMessage(String(chatId), botMessages.help, {
          ...htmlParseMode,
          reply_markup: mainMenuKeyboard(config.miniAppUrl),
        });
        return;
      }
      case "/today":
      case "/schedule": {
        const screen = commandToScreen(command);
        await telegram.sendMessage(String(chatId), command === "/today" ? botMessages.today : botMessages.schedule, {
          ...htmlParseMode,
          reply_markup: openDiaryKeyboard(config.miniAppUrl, screen ?? undefined),
        });
        return;
      }
      case "/quote": {
        await sendKoanCard(chatId, fromId);
        return;
      }
      case "/monk": {
        await sendMonkCard(chatId, true);
        return;
      }
      case "/japa": {
        await telegram.sendMessage(String(chatId), japaText(0), {
          ...htmlParseMode,
          reply_markup: japaKeyboard(0),
        });
        return;
      }
      default: {
        await telegram.sendMessage(String(chatId), botMessages.unknown, {
          ...htmlParseMode,
          reply_markup: mainMenuKeyboard(config.miniAppUrl),
        });
      }
    }
  }

  // --- Callback-и (нажатия на inline-кнопки) ---

  async function handleCallback(query: TelegramCallbackQuery) {
    const data = query.data ?? "";
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    // Сообщение могло быть удалено — тогда просто подтверждаем нажатие.
    if (!chatId || !messageId) {
      await telegram.answerCallbackQuery(query.id).catch(() => undefined);
      return;
    }

    const edit = (text: string, replyMarkup: unknown) =>
      telegram
        .editMessageText(String(chatId), messageId, text, {
          ...htmlParseMode,
          reply_markup: replyMarkup,
        })
        .catch(() => undefined);

    const toast = (text?: string) =>
      telegram.answerCallbackQuery(query.id, text).catch(() => undefined);

    // japa:tap:<n> — текущий счёт живёт в callback_data, сервер ничего не хранит.
    if (data.startsWith("japa:tap:")) {
      const current = Number(data.slice("japa:tap:".length));
      const next = Number.isFinite(current) ? Math.min(current + 1, 108) : 0;
      await edit(japaText(next), japaKeyboard(next));
      if (next === 27) await toast("Четверть малы — ум уже тише 🌸");
      else if (next === 54) await toast("Половина. Дальше мала крутится сама 🌸");
      else if (next === 81) await toast("Три четверти. Осталось меньше, чем пройдено 🌸");
      else if (next === 108) await toast("Мала завершена! 108 из 108 🪷✨");
      else await toast();
      return;
    }

    switch (true) {
      case data === "japa:reset": {
        await edit(japaText(0), japaKeyboard(0));
        await toast("Мала с начала 🌱");
        return;
      }
      case /^japa:\d+$/.test(data): {
        // Кнопка из главного меню присылает «japa:0»: открыть счётчик
        // на этом числе. Раньше такой колбэк ничем не обрабатывался и
        // уходил в default — казалось, что кнопка «Джапа» не работает.
        const opened = Math.min(Math.max(Number(data.slice("japa:".length)), 0), 108);
        await edit(japaText(opened), japaKeyboard(opened));
        await toast();
        return;
      }
      case data === "menu": {
        await edit(welcomeCardText(query.from.first_name), mainMenuKeyboard(config.miniAppUrl));
        await toast();
        return;
      }
      case data === "koan:card": {
        const { index, entry } = koanOfDay(query.from.id);
        await edit(koanCardText(entry, koanKindLabel(entry)), koanCardKeyboard(index));
        await toast();
        return;
      }
      case data === "koan:new": {
        await toast("Ждём учителя…");
        try {
          const { text } = await backend.inspire("koan");
          await edit(aiKoanText(text), aiKoanKeyboard());
        } catch {
          await toast(botMessages.aiSilent);
        }
        return;
      }
      case data.startsWith("koan:ask:"): {
        const entry = koanByIndex(Number(data.slice("koan:ask:".length)));
        if (!entry) {
          await toast("Карта потерялась — возьми новую 🃏");
          return;
        }
        await toast("Учитель думает…");
        try {
          const { text } = await backend.inspire("koan-commentary", {
            text: entry.text,
            source: entry.source,
          });
          await edit(aiTeacherText(text), aiCommentaryKeyboard());
        } catch {
          await toast(botMessages.aiSilent);
        }
        return;
      }
      case data === "monk:day": {
        const monk = monkOfDay().entry;
        await edit(monkCardText(monk, true), monkKeyboard(monk.id));
        await toast();
        return;
      }
      case data.startsWith("monk:next:"): {
        const current = monkById(data.slice("monk:next:".length)) ?? monkOfDay().entry;
        const monk = nextMonk(current.id);
        await edit(monkCardText(monk, false), monkKeyboard(monk.id));
        await toast();
        return;
      }
      case data.startsWith("monk:lesson:"): {
        const monk = monkById(data.slice("monk:lesson:".length));
        if (!monk) {
          await toast("Монах ушёл в ретрит 🏔");
          return;
        }
        await toast("Учитель думает…");
        try {
          const { text } = await backend.inspire("monk-lesson", {
            name: monk.name,
            years: monk.years,
            tradition: monk.tradition,
            feat: monk.feat,
          });
          await edit(monkLessonText(monk, text), monkLessonKeyboard(monk.id));
        } catch {
          await toast(botMessages.aiSilent);
        }
        return;
      }
      case data === "wheel": {
        await toast("Кручу колесо…");
        await spinWheel(chatId, messageId, query.from.id);
        return;
      }
      default: {
        await toast();
      }
    }
  }

  /** Колесо Дхармы: пара кадров «вращения» и выбор практики пользователя. */
  async function spinWheel(chatId: number, messageId: number, telegramId: number) {
    const edit = (text: string) =>
      telegram
        .editMessageText(String(chatId), messageId, text, { ...htmlParseMode })
        .catch(() => undefined);

    for (const frame of wheelSpinningFrames) {
      await edit(frame);
      await sleep(350);
    }

    let title: string;
    let minutes: number;
    let fromLibrary = false;
    try {
      const practices = await backend.listUserPractices(telegramId);
      if (practices.length > 0) {
        const pick = practices[Math.floor(Math.random() * practices.length)];
        title = pick.title;
        minutes = pick.minutes || 20;
        fromLibrary = true;
      } else {
        const pool = randomFromPool();
        title = pool.title;
        minutes = pool.minutes;
      }
    } catch {
      const pool = randomFromPool();
      title = pool.title;
      minutes = pool.minutes;
    }

    await telegram
      .editMessageText(String(chatId), messageId, wheelResultText(title, minutes, fromLibrary), {
        ...htmlParseMode,
        reply_markup: wheelKeyboard(),
      })
      .catch(() => undefined);
  }

  async function handleUpdate(update: TelegramUpdate) {
    await ensureBotMenu(telegram);

    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }

    if (update.message) {
      await handleMessage(update);
    }
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
