#!/usr/bin/env node
/** Разовая проверка: список практик + генерация расписания через ИИ. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const BASE = process.env.API_BASE ?? "http://localhost:3001";

const stub = readFileSync(resolve(ROOT, "apps/mini-app/dist/local-telegram.js"), "utf8");
const INIT_DATA = stub.match(/auth_date=[^"]*/)?.[0];
const AUTH = { "content-type": "application/json", "x-telegram-init-data": INIT_DATA };

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: AUTH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

const list = await call("GET", "/practices");
console.log("--- практики пользователя ---");
if (!list.payload?.ok) {
  console.log("  не удалось получить:", JSON.stringify(list.payload));
} else {
  const items = list.payload.data;
  if (items.length === 0) console.log("  (пусто)");
  for (const p of items) {
    console.log(`  ${p.id.slice(0, 8)}  ${p.title}  [${p.category}]${p.archived ? "  (архив)" : ""}`);
  }
}

console.log("\n--- ИИ-расписание: «завтра утром дыхание, днём чтение, вечером медитация» ---");
const started = Date.now();
const ai = await call("POST", "/schedule/ai/text", {
  text: "Завтра утром 20 минут дыхания, днём 15 минут чтения, вечером 30 минут медитации",
});
console.log(`  (отклик за ${((Date.now() - started) / 1000).toFixed(1)} с)`);

if (!ai.payload?.ok) {
  console.log("  ОШИБКА:", ai.status, JSON.stringify(ai.payload));
  process.exit(1);
}

const data = ai.payload.data;
console.log(`  дата: ${data.date}  |  практик: ${data.items.length}  |  источник: ${data.source}`);
for (const item of data.items) {
  console.log(`   - ${item.practiceId.slice(0, 8)}  ${item.plannedStartTime ?? "—"}  ${item.plannedDurationMinutes} мин`);
}
