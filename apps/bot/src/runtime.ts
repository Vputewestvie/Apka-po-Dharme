import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectDotEnv } from "../../../packages/shared/src/load-dot-env";
import { readBotConfig } from "./config";
import { createBotApp } from "./main";

// runtime.ts лежит в apps/bot/src/ — до корня монорепо три уровня вверх.
const MONOREPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Без этого бот не видел бы .env и падал с «TELEGRAM_BOT_TOKEN is required»
// при любом запуске, кроме ручного экспорта переменных в шелле.
const envFile = loadProjectDotEnv(MONOREPO_ROOT);
if (envFile) {
  console.log(`Загружен конфиг: ${envFile}`);
}

const config = readBotConfig();
const bot = createBotApp(config);

bot.pollForever().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
