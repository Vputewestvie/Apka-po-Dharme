import type { BotCommand } from "./commands";

export const botMessages: Record<BotCommand | "unknown", string> = {
  "/start": "Готово. Открой Mini App и продолжай дневную практику.",
  "/help": "Команды: /today, /schedule. Основная работа идёт внутри Mini App.",
  "/today": "Открываю сегодняшний экран практик.",
  "/schedule": "Открываю план на день.",
  unknown: "Пока понимаю команды /today и /schedule.",
};
