export type BotCommand = "/start" | "/help" | "/today" | "/schedule";

export type CommandScreen = "today" | "schedule";

export const botCommands: BotCommand[] = ["/start", "/help", "/today", "/schedule"];

export function parseBotCommand(text: string): BotCommand | null {
  const command = text.trim().split(/\s+/)[0] as BotCommand;
  return botCommands.includes(command) ? command : null;
}

export function commandToScreen(command: BotCommand): CommandScreen | null {
  switch (command) {
    case "/today":
      return "today";
    case "/schedule":
      return "schedule";
    default:
      return null;
  }
}
