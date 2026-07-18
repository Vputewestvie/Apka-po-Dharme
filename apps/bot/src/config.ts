export type BotConfig = {
  telegramBotToken: string;
  miniAppUrl: string;
  apiBaseUrl: string;
  pollingTimeoutSeconds: number;
};

export function readBotConfig(env: Record<string, string | undefined> = process.env): BotConfig {
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
  const miniAppUrl = env.MINI_APP_URL;
  const apiBaseUrl = env.API_BASE_URL ?? "http://localhost:3001";

  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (!miniAppUrl) {
    throw new Error("MINI_APP_URL is required");
  }

  return {
    telegramBotToken,
    miniAppUrl,
    apiBaseUrl,
    pollingTimeoutSeconds: Number(env.BOT_POLLING_TIMEOUT_SECONDS ?? "25"),
  };
}
