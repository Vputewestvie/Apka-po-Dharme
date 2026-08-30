#!/usr/bin/env node
/**
 * Сквозная проверка «как в продакшене»: тот же сервер, те же init data,
 * тот же порядок вызовов, что делает интерфейс при нажатии кнопок.
 *
 * Отличие от e2e-check.sh: здесь авторизация идёт настоящими Telegram init data,
 * а не dev-заголовком x-user-id (в production он отключён).
 *
 * Запуск (API уже должен быть поднят на :3001):
 *   node scripts/local-prod-smoke.mjs
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
  console.error("Не найдены init data в apps/mini-app/dist/local-telegram.js.");
  console.error("Сначала выполните: node scripts/prepare-local-prod.mjs");
  process.exit(1);
}

const AUTH = { "content-type": "application/json", "x-telegram-init-data": INIT_DATA };

const nowIso = () => new Date().toISOString();

/**
 * Сценарий пишет в ту же базу, что и интерфейс, поэтому чтобы не задеть
 * настоящие данные пользователя, он работает на отдельной дате из далёкого
 * будущего. День выбирается случайно: в расписании есть ограничение
 * UNIQUE(user_id, date), и на фиксированной дате повторный прогон упёрся бы
 * в уже созданную запись.
 */
const TEST_DAY = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
const TODAY = `2099-01-${TEST_DAY}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(method, path, body, headers = AUTH) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

/** Проверяет, что ответ успешный, и возвращает data. */
async function ok(method, path, body) {
  const { status, payload } = await call(method, path, body);
  if (status >= 400 || !payload?.ok) {
    throw new Error(`${method} ${path} → ${status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

console.log(`Прогон пользовательского сценария против ${BASE}`);
console.log(`init data: ${INIT_DATA.slice(0, 48)}…`);
console.log(`дата: ${TODAY}\n`);

// --- 1. Библиотека практик --------------------------------------------------
console.log("1. Практики");
let practices = await ok("GET", "/practices");
check("GET /practices", Array.isArray(practices));

const created = await ok("POST", "/practices", {
  title: "Тестовая практика",
  description: "Создано сценарной проверкой",
  category: "медитация",
  defaultDurationMinutes: 15,
  color: "#688b76",
  icon: "leaf",
  image: { kind: "builtin", ref: "lotus" },
  notes: "",
});
const practiceId = created.id ?? created.practiceId;
check("POST /practices — создание", Boolean(practiceId));

practices = await ok("GET", "/practices");
check("GET /practices — практика появилась", practices.some((p) => p.id === practiceId));

const patched = await ok("PATCH", "/practices", {
  practiceId,
  title: "Тестовая практика (изменено)",
});
check("PATCH /practices — переименование", patched.title === "Тестовая практика (изменено)");

// --- 2. Материалы -----------------------------------------------------------
console.log("\n2. Материалы");
const material = await ok("POST", "/materials", {
  practiceId,
  title: "Статья о дхарме",
  url: "https://advayta.org/library/test",
  type: "article",
  sourceDomain: "advayta.org",
});
check("POST /materials — добавление", Boolean(material));

const materials = await ok("GET", `/materials?practiceId=${practiceId}`);
check("GET /materials", Array.isArray(materials) || Array.isArray(materials?.items));

// --- 3. Расписание ----------------------------------------------------------
console.log("\n3. Расписание");
const schedule = await ok("POST", "/schedule", {
  date: TODAY,
  title: "День проверки",
  source: "manual",
  practices: [
    {
      practiceId,
      plannedStartTime: "07:00",
      plannedDurationMinutes: 15,
      order: 0,
    },
  ],
});
check("POST /schedule — создание", Boolean(schedule));

const scheduleView = await ok("GET", `/schedule?date=${TODAY}`);
const items = scheduleView?.items ?? scheduleView?.practices ?? [];
const scheduledId = items[0]?.id ?? items[0]?.scheduledPracticeId;
check("GET /schedule — практика в расписании", Boolean(scheduledId), JSON.stringify(scheduleView).slice(0, 200));

const changed = await ok("POST", "/schedule/change-time", {
  date: TODAY,
  scheduledPracticeId: scheduledId,
  plannedStartTime: "08:30",
  plannedDurationMinutes: 20,
});
check("POST /schedule/change-time", Boolean(changed));

// --- 4. Таймер (включая ранее сломанную кнопку «+5 минут») ------------------
console.log("\n4. Таймер");
await ok("POST", "/timer/start", {
  scheduledPracticeId: scheduledId,
  practiceId,
  plannedDurationMinutes: 20,
});
check("POST /timer/start", true);

const paused = await ok("POST", "/timer/pause", {
  scheduledPracticeId: scheduledId,
  timestamp: nowIso(),
});
check("POST /timer/pause", Boolean(paused));

const resumed = await ok("POST", "/timer/resume", {
  scheduledPracticeId: scheduledId,
  timestamp: nowIso(),
});
check("POST /timer/resume", Boolean(resumed));

// Кнопка «+5 минут»: раньше из-за Zod она всегда падала с 500.
// Накопленное время живёт в сессии таймера (actualDurationSeconds), а не в
// элементе расписания — GET /schedule его не показывает.
const sessionBefore = await ok("POST", "/timer/pause", {
  scheduledPracticeId: scheduledId,
  timestamp: nowIso(),
});
const secondsBefore = sessionBefore?.actualDurationSeconds ?? 0;
await ok("POST", "/timer/resume", { scheduledPracticeId: scheduledId, timestamp: nowIso() });

const added = await ok("POST", "/timer/add-time", {
  scheduledPracticeId: scheduledId,
  timestamp: nowIso(),
  minutes: 5,
});
check("POST /timer/add-time (minutes:5)", Boolean(added));

const secondsAfter = added?.actualDurationSeconds ?? 0;
check(
  "  → к таймеру прибавилось 300 секунд",
  secondsAfter - secondsBefore === 300,
  `было ${secondsBefore}, стало ${secondsAfter}`,
);

const completed = await ok("POST", "/timer/complete", {
  scheduledPracticeId: scheduledId,
  timestamp: nowIso(),
});
check("POST /timer/complete", Boolean(completed));

// --- 5. Дневник и статистика -----------------------------------------------
console.log("\n5. Дневник и статистика");
const entry = await ok("POST", "/diary", {
  practiceId,
  scheduledPracticeId: scheduledId,
  kind: "text",
  text: "Запись сценарной проверки",
});
check("POST /diary — запись", Boolean(entry));

const diary = await ok("GET", `/diary?date=${TODAY}`);
check("GET /diary", Array.isArray(diary) || Array.isArray(diary?.items));

const stats = await ok("GET", "/statistics");
check("GET /statistics", Boolean(stats));

const refreshed = await ok("POST", "/statistics/refresh", { date: TODAY });
check("POST /statistics/refresh", Boolean(refreshed));

// --- 6. Архив и удаление ----------------------------------------------------
console.log("\n6. Архив и очистка");
await ok("POST", "/practices/archive", { practiceId });
let list = await ok("GET", "/practices");
check("POST /practices/archive", !list.some((p) => p.id === practiceId && !p.archived));

await ok("POST", "/practices/restore", { practiceId });
list = await ok("GET", "/practices");
check("POST /practices/restore", list.some((p) => p.id === practiceId));

await ok("POST", "/schedule/remove-practice", {
  date: TODAY,
  scheduledPracticeId: scheduledId,
});
const cleared = await ok("GET", `/schedule?date=${TODAY}`);
const left = cleared?.items ?? cleared?.practices ?? [];
check("POST /schedule/remove-practice", left.length === 0, `осталось ${left.length}`);

// --- 7. Проверки безопасности в production ----------------------------------
console.log("\n7. Безопасность (production)");

const noAuth = await call("GET", "/practices", undefined, { "content-type": "application/json" });
check("без авторизации → 401", noAuth.status === 401, `получили ${noAuth.status}`);

const devBypass = await call("GET", "/practices", undefined, {
  "content-type": "application/json",
  "x-user-id": "123456789",
});
check("dev-обход x-user-id в проде → 401", devBypass.status === 401, `получили ${devBypass.status}`);

const forged = await call("GET", "/practices", undefined, {
  "content-type": "application/json",
  "x-telegram-init-data": `${INIT_DATA}deadbeef`,
});
check("подделанная подпись → 401", forged.status === 401, `получили ${forged.status}`);

const notifications = await call("GET", "/notifications/pending", undefined, AUTH);
check("уведомления без служебного токена → 403", notifications.status === 403, `получили ${notifications.status}`);

// Токен только латиницей: кириллица в HTTP-заголовке недопустима (ByteString).
const wrongToken = await call("GET", "/notifications/pending", undefined, {
  "content-type": "application/json",
  "x-internal-token": "definitely-not-the-real-token",
});
check("уведомления с неверным токеном → 403", wrongToken.status === 403, `получили ${wrongToken.status}`);

// --- Итог -------------------------------------------------------------------
console.log(`\n${"=".repeat(56)}`);
console.log(`Итого: ${passed} прошло, ${failed} не прошло`);
if (failed > 0) {
  console.log("\nНе прошли:");
  for (const name of failures) console.log(`  - ${name}`);
}
process.exit(failed > 0 ? 1 : 0);
