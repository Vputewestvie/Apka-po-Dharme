import { readBotConfig } from "./config";
import { createBotApp } from "./main";

const config = readBotConfig();
const bot = createBotApp(config);

bot.pollForever().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
