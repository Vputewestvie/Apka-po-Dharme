export type BotCommand =
  | "/start"
  | "/help"
  | "/today"
  | "/schedule"
  | "/quote"
  | "/monk"
  | "/japa";

export const botCommands: BotCommand[] = [
  "/start",
  "/help",
  "/today",
  "/schedule",
  "/quote",
  "/monk",
  "/japa",
];

/** Экран мини-аппа для команды (если команда должна открыть конкретный экран). */
export function commandToScreen(command: BotCommand): string | null {
  switch (command) {
    case "/today":
      return "today";
    case "/schedule":
      return "schedule";
    default:
      return null;
  }
}

export function parseBotCommand(text: string): BotCommand | null {
  const [rawCommand] = text.trim().split(/\s+/);
  const bare = rawCommand.split("@")[0].toLowerCase();
  return botCommands.includes(bare as BotCommand) ? (bare as BotCommand) : null;
}

/**
 * Меню команд (кнопка «≡» слева от поля ввода). setMyCommands идемпотентен —
 * вызываем при старте рантайма и раз на изолят воркера.
 */
export const telegramMenuCommands: Array<{ command: string; description: string }> = [
  { command: "start", description: "🪷 Открыть дневник практики" },
  { command: "today", description: "🧘 Практика дня" },
  { command: "schedule", description: "☸️ План на день" },
  { command: "quote", description: "🃏 Карта дня: коан или Пелевин" },
  { command: "monk", description: "✨ Подвиг монаха дня" },
  { command: "japa", description: "📿 Счётчик джапа-малы" },
  { command: "help", description: "🕯 Помощь" },
];
