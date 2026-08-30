#!/usr/bin/env node
/**
 * Подготовка локального запуска «как в продакшене».
 *
 * Что делает:
 *   1. Собирает мини-апку прод-бандлом (vite build).
 *   2. Подписывает настоящие Telegram init data токеном бота — то есть приложение
 *      авторизуется ровно тем же путём, что и внутри Telegram: HMAC-SHA256,
 *      проверка подписи и срока годности на стороне API.
 *   3. Кладёт в dist/ локальную точку входа local.html с заглушкой Telegram.
 *
 * Почему нужна заглушка: в обычном браузере нет window.Telegram, а именно оттуда
 * приложение берёт init data. Заглушка подставляет заранее подписанную строку,
 * поэтому весь продакшен-путь авторизации работает без клиента Telegram.
 *
 * ВАЖНО: local.html и local-telegram.js создаются только в dist/ (в .gitignore)
 * и предназначены исключительно для локальной проверки. В прод они не попадают.
 *
 * Запуск:  node scripts/prepare-local-prod.mjs
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const DIST = resolve(ROOT, "apps/mini-app/dist");
const MINI_APP = resolve(ROOT, "apps/mini-app");
const DEV_ENV = resolve(MINI_APP, ".env");
const DEV_ENV_BAK = resolve(MINI_APP, ".env.local-dev");
const SECRETS = resolve(process.env.USERPROFILE ?? "", ".workbuddy-ai/secrets.md");

const USER_ID = 123456789;

function readBotToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  if (!existsSync(SECRETS)) {
    throw new Error(
      `Не найден ни TELEGRAM_BOT_TOKEN в окружении, ни файл секретов: ${SECRETS}`,
    );
  }
  const text = readFileSync(SECRETS, "utf8");
  const found = text.match(/^\|?\s*`?(\d{8,}:AA[A-Za-z0-9_-]{30,})`?\s*\|?$/m);
  if (!found) {
    // Запасной вариант: просто ищем токен вида 123:AA... по всему файлу.
    const loose = text.match(/\d{8,}:AA[A-Za-z0-9_-]{30,}/);
    if (!loose) throw new Error("В secrets.md не найден токен Telegram-бота");
    return loose[0];
  }
  return found[1];
}

/** Формирует init data в точности в том виде, в котором его присылает Telegram. */
function buildInitData(token, userId) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify({
      id: userId,
      first_name: "Локальный",
      last_name: "Тест",
      username: "local_test",
      language_code: "ru",
    }),
  });

  // Подпись по СЫРЫМ парам «key=value» (значения остаются URL-закодированными):
  // именно так считает Telegram. Подпись по раскодированным значениям API
  // отвергнет — из-за этого раньше падал настоящий клиент в Telegram.
  const dataCheckString = params
    .toString()
    .split("&")
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);

  return params.toString();
}

console.log("=== 1/3. Сборка мини-апки (production) ===");

/**
 * На время сборки убираем apps/mini-app/.env.
 *
 * Причина: в нём лежит VITE_DEV_USER_ID, а клиент (src/api.ts) проверяет его
 * ПЕРВЫМ и при его наличии шлёт заголовок x-user-id, не доходя до Telegram.
 * В production dev-режим отключён (isDevAuthEnabled требует
 * NODE_ENV !== "production"), поэтому такой бандл получил бы 401 на каждый
 * запрос. Без .env бандл идёт боевым путём: читает window.Telegram.initData.
 *
 * VITE_API_URL в проде тоже не нужен: API раздаёт dist сам, поэтому запросы
 * уходят по относительным путям на тот же origin — как в реальном деплое.
 */
const envMoved = existsSync(DEV_ENV);
if (envMoved) {
  rmSync(DEV_ENV_BAK, { force: true });
  renameSync(DEV_ENV, DEV_ENV_BAK);
  console.log("  apps/mini-app/.env временно отключён (VITE_DEV_USER_ID сломал бы продакшен-путь)");
}

try {
  execFileSync("npm", ["run", "build", "-w", "@app/mini-app"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
} finally {
  if (envMoved) {
    renameSync(DEV_ENV_BAK, DEV_ENV);
    console.log("  apps/mini-app/.env возвращён на место");
  }
}

const indexPath = resolve(DIST, "index.html");
if (!existsSync(indexPath)) {
  throw new Error(`Сборка не дала ${indexPath}`);
}

// Контроль: в боевом бандле не должно быть dev-заглушки x-user-id.
const bundleDir = resolve(DIST, "assets");
const bundleFiles = existsSync(bundleDir) ? readdirSync(bundleDir).filter((f) => f.endsWith(".js")) : [];
const withDevId = bundleFiles.filter((file) =>
  readFileSync(resolve(bundleDir, file), "utf8").includes("x-user-id"),
);
if (withDevId.length > 0) {
  console.log(`  ⚠ ВНИМАНИЕ: в бандле остался x-user-id (${withDevId.join(", ")}) — прод-путь авторизации не сработает`);
} else {
  console.log("  ✓ в бандле нет x-user-id — авторизация пойдёт через Telegram init data");
}

console.log("\n=== 2/3. Подпись Telegram init data ===");
const token = readBotToken();
const initData = buildInitData(token, USER_ID);
console.log(`  бот: ${token.split(":")[0]}:***  пользователь: ${USER_ID}`);
console.log(`  подпись сформирована, auth_date = ${new Date().toISOString()}`);

console.log("\n=== 3/3. Локальная точка входа ===");
mkdirSync(DIST, { recursive: true });

// Заглушка клиента Telegram. Выполняется СИНХРОННО до загрузки бандла приложения,
// поэтому к моменту первого запроса init data уже лежит в window.Telegram.
const stub = `/* ЛОКАЛЬНАЯ ЗАГЛУШКА КЛИЕНТА TELEGRAM — только для проверки без Telegram.
 * Создаётся scripts/prepare-local-prod.mjs, в репозиторий не попадает.
 * init data подписаны настоящим токеном бота, поэтому API проверяет их
 * обычным продакшен-путём (HMAC + срок годности). */
(function () {
  var initData = ${JSON.stringify(initData)};
  window.Telegram = window.Telegram || {};
  window.Telegram.initData = initData;
  window.Telegram.WebApp = window.Telegram.WebApp || {
    initData: initData,
    ready: function () {},
    expand: function () {},
    close: function () {},
  };
  console.log("[local] подставлены init data пользователя ${USER_ID}");
})();
`;
writeFileSync(resolve(DIST, "local-telegram.js"), stub, "utf8");

// local.html — копия боевого index.html, но со заглушкой перед бандлом.
let html = readFileSync(indexPath, "utf8");
if (!html.includes("local-telegram.js")) {
  html = html.replace(
    /<script type="module"/,
    '<script src="/local-telegram.js"></script>\n    <script type="module"',
  );
  // Официальный скрипт Telegram подключать не нужно: он перезаписал бы заглушку.
  html = html.replace(
    /<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js[^"]*"><\/script>/,
    "<!-- в локальном режиме скрипт Telegram заменён заглушкой local-telegram.js -->",
  );
}
writeFileSync(resolve(DIST, "local.html"), html, "utf8");

console.log("  создано dist/local.html");
console.log("  создано dist/local-telegram.js");
console.log("\nГотово. Приложение будет доступно по адресу:");
console.log("  http://localhost:3001/local.html");
