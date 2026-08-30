#!/usr/bin/env node
/**
 * Продакшен-сборка мини-апки для деплоя на Cloudflare Workers.
 *
 * Почему не просто `vite build`: Vite автоматически подтягивает
 * apps/mini-app/.env, а там девелоперские значения — VITE_DEV_USER_ID
 * (ломает продакшен-авторизацию) и VITE_API_URL=http://localhost:3001
 * (весь прод-клиент уходит в localhost устройства пользователя →
 * «Load failed» у всех, у кого не запущен локальный API).
 *
 * Этот скрипт повторяет приём prepare-local-prod.mjs: убирает .env на время
 * сборки, возвращает его в finally и ПОСЛЕ сборки проверяет бандл — если
 * в нём остались следы дев-конфигурации, деплой проваливается.
 */

import { existsSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const MINI_APP = resolve(ROOT, "apps/mini-app");
const DIST = resolve(MINI_APP, "dist");
const DEV_ENV = resolve(MINI_APP, ".env");
const DEV_ENV_BAK = resolve(MINI_APP, ".env.local-dev");

const envMoved = existsSync(DEV_ENV);
if (envMoved) {
  rmSync(DEV_ENV_BAK, { force: true });
  renameSync(DEV_ENV, DEV_ENV_BAK);
  console.log("  apps/mini-app/.env временно убран (дев-значения не должны попасть в прод-бандл)");
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

const FORBIDDEN = ["localhost:3001", "local-dev-user", "x-user-id"];
const bundleDir = resolve(DIST, "assets");
const offenders = [];
for (const file of readdirSync(bundleDir).filter((f) => f.endsWith(".js"))) {
  const text = readFileSync(resolve(bundleDir, file), "utf8");
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) offenders.push(`${file} → ${needle}`);
  }
}

if (offenders.length > 0) {
  console.error("  ОШИБКА: в прод-бандле остались дев-значения:");
  for (const line of offenders) console.error("    " + line);
  process.exit(1);
}

console.log("  ✓ бандл чист: без localhost, x-user-id и дев-пользователя");
