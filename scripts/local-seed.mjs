#!/usr/bin/env node
/**
 * Стартовое наполнение библиотеки практик для локального пользователя.
 *
 * Зачем: на сервере нет сидинга — библиотеку создаёт сам пользователь через
 * интерфейс. Но чтобы можно было сразу проверять кнопки (и especially
 * генерацию расписания через ИИ, которая подбирает практики по названию),
 * нужна пара практик с «говорящими» именами.
 *
 * Идемпотентен: существующие практики с такими же названиями не дублирует.
 *
 * Запуск:  node scripts/local-seed.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const BASE = process.env.API_BASE ?? "http://localhost:3001";

const stub = readFileSync(resolve(ROOT, "apps/mini-app/dist/local-telegram.js"), "utf8");
const INIT_DATA = stub.match(/auth_date=[^"]*/)?.[0];
if (!INIT_DATA) {
  console.error("Сначала выполните: node scripts/prepare-local-prod.mjs");
  process.exit(1);
}
const AUTH = { "content-type": "application/json", "x-telegram-init-data": INIT_DATA };

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: AUTH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

/** Практики, которых ждёт интерфейс и подсказки ИИ. */
const STARTER = [
  {
    title: "Дыхание",
    description: "Дыхательная практика для выравнивания ритма.",
    category: "Дыхание",
    defaultDurationMinutes: 20,
    color: "#7f8467",
    icon: "wind",
    image: { kind: "builtin", ref: "/images/categories/pranayama.jpg" },
    notes: "",
  },
  {
    title: "Чтение",
    description: "Небольшой блок чтения материалов по практике.",
    category: "Текст",
    defaultDurationMinutes: 25,
    color: "#7a6b5f",
    icon: "book",
    image: { kind: "builtin", ref: "/images/categories/reading.jpg" },
    notes: "",
  },
  {
    title: "Медитация",
    description: "Тихая практика без цели и усилия.",
    category: "Медитация",
    defaultDurationMinutes: 30,
    color: "#688b76",
    icon: "leaf",
    // В public/images/categories лежат только pranayama/qigong/reading —
    // картинки «meditation» не существует, иначе практика получала бы битую ссылку.
    image: { kind: "builtin", ref: "/images/categories/pranayama.jpg" },
    notes: "",
  },
  {
    title: "Цигун",
    description: "Мягкая утренняя практика для пробуждения тела.",
    category: "Тело",
    defaultDurationMinutes: 45,
    color: "#688b76",
    icon: "leaf",
    image: { kind: "builtin", ref: "/images/categories/qigong.jpg" },
    notes: "",
  },
  {
    title: "Пранаяма",
    description: "Классический комплекс дыхательных упражнений.",
    category: "Дыхание",
    defaultDurationMinutes: 20,
    color: "#7f8467",
    icon: "wind",
    image: { kind: "builtin", ref: "/images/categories/pranayama.jpg" },
    notes: "",
  },
];

const existing = await call("GET", "/practices");
if (!existing.payload?.ok) {
  console.error("Не удалось получить библиотеку:", JSON.stringify(existing.payload));
  process.exit(1);
}

const byTitle = new Map(existing.payload.data.map((p) => [p.title, p]));

console.log("--- уборка тестовых практик ---");
let removed = 0;
for (const practice of existing.payload.data) {
  if (!practice.title.startsWith("Тестовая практика")) continue;
  const archived = await call("POST", "/practices/archive", { practiceId: practice.id });
  if (archived.payload?.ok) {
    removed += 1;
    byTitle.delete(practice.title);
    console.log(`  в архив: ${practice.title}`);
  }
}
if (removed === 0) console.log("  тестовых практик не найдено");

console.log("\n--- стартовый набор ---");
for (const practice of STARTER) {
  if (byTitle.has(practice.title)) {
    console.log(`  = уже есть: ${practice.title}`);
    continue;
  }
  const created = await call("POST", "/practices", practice);
  if (created.payload?.ok) {
    console.log(`  + создано: ${practice.title} (${practice.defaultDurationMinutes} мин)`);
  } else {
    console.log(`  ! не создано: ${practice.title} — ${JSON.stringify(created.payload)}`);
  }
}

const after = await call("GET", "/practices");
console.log("\n--- библиотека пользователя ---");
for (const practice of after.payload.data) {
  const mark = practice.archived ? "  (архив)" : "";
  console.log(`  ${practice.title} — ${practice.category}, ${practice.defaultDurationMinutes} мин${mark}`);
}
