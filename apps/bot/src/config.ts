export type BotConfig = {
  telegramBotToken: string;
  miniAppUrl: string;
  apiBaseUrl: string;
  pollingTimeoutSeconds: number;
  /**
   * Служебный токен для вызовов «бот → API».
   * Раньше брался из process.env внутри BackendApiClient — неявно. В Workers
   * окружение приходит биндингом, и надёжнее передавать секрет явно.
   */
  internalToken: string;
};

export function readBotConfig(env: Record<string, string | undefined> = process.env): BotConfig {
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
  const miniAppUrl = env.MINI_APP_URL;
  const apiBaseUrl = env.API_BASE_URL ?? "http://localhost:3001";
  const internalToken = env.INTERNAL_API_TOKEN ?? "";

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
    internalToken,
  };
}
