import type { KoanEntry } from "./content/koans";
import { koanKindEmoji } from "./content/koans";
import type { MonkEntry } from "./content/monks";
import { dayGreeting, moonPhaseEmoji, moonPhaseName } from "./sky";

/** Telegram parse_mode=HTML требует экранировать пользовательский ввод. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const htmlParseMode = { parse_mode: "HTML" } as const;

const FRAME_TOP = "❋ ──────── 🪷 ──────── ❋";
const FRAME_BOTTOM = "❋ ───────────────────── ❋";

/** Приветственная открытка: время суток, луна, рамка. */
export function welcomeCardText(firstName: string | undefined, now = new Date()): string {
  const greeting = dayGreeting(now);
  const name = firstName ? `, <b>${escapeHtml(firstName)}</b>` : "";
  const moon = moonPhaseEmoji(now);
  const moonName = moonPhaseName(now);
  return [
    `${greeting.emoji} ${greeting.text}${name}!`,
    "",
    FRAME_TOP,
    "",
    `Сегодня над путём — <b>${moon} ${moonName}</b>.`,
    "Дневник помнит твои практики, таймер — твоё время, а колесо дхармы уже крутится.",
    "",
    "<i>Руби дрова. Носи воду. Остальное запишется.</i>",
    "",
    FRAME_BOTTOM,
    "",
    "<i>Выбери, с чего начнём:</i>",
  ].join("\n");
}

export function koanCardText(entry: KoanEntry, kindLabel: string): string {
  return [
    "🃏 <b>Карта дня</b>",
    "",
    FRAME_TOP,
    "",
    escapeHtml(entry.text),
    "",
    `— <i>${escapeHtml(entry.source)}</i>`,
    "",
    FRAME_BOTTOM,
    "",
    `<i>${kindLabel}. Одна карта на день — как луна.</i>`,
  ].join("\n");
}

export function koanKindLabel(entry: KoanEntry): string {
  if (entry.kind === "pelevin") return `${koanKindEmoji.pelevin} Сегодня Пелевин`;
  if (entry.kind === "proverb") return `${koanKindEmoji.proverb} Поговорка традиций`;
  return `${koanKindEmoji.koan} Классический коан`;
}

export function aiKoanText(koan: string): string {
  return [
    "🃏 <b>Свежий коан</b> <i>(сгенерирован ИИ прямо сейчас)</i>",
    "",
    FRAME_TOP,
    "",
    escapeHtml(koan),
    "",
    FRAME_BOTTOM,
  ].join("\n");
}

export function aiTeacherText(text: string): string {
  return [
    "🕯 <b>Учитель говорит</b>",
    "",
    escapeHtml(text),
  ].join("\n");
}

export function japaText(count: number): string {
  if (count >= 108) {
    return [
      "📿 <b>Мала завершена: 108 / 108</b>",
      "",
      FRAME_TOP,
      "",
      "Сто восемь зёрен пересчитаны. То, что повторялось, — закончилось; то, что слушало, — осталось.",
      "",
      FRAME_BOTTOM,
    ].join("\n");
  }

  const progress = "●".repeat(Math.floor(count / 12)) + "○".repeat(9 - Math.floor(count / 12));
  const milestone =
    count === 27 ? "\n\n🌸 Четверть мала. Ум уже тише — заметь это." :
    count === 54 ? "\n\n🌸 Половина. Дальше мала крутится сама." :
    count === 81 ? "\n\n🌸 Три четверти. Осталось меньше, чем пройдено." :
    "";
  return [
    `📿 <b>Джапа: ${count} / 108</b>`,
    "",
    `<code>${progress}</code>${milestone}`,
    "",
    "<i>Жми +1 на каждое повторение — или читай мантру вслух, а кнопку жми на каждое зерно.</i>",
  ].join("\n");
}

export function monkCardText(monk: MonkEntry, ofDay: boolean): string {
  return [
    `${ofDay ? "✨ <b>Монах дня</b>" : "✨ <b>Подвиг монаха</b>"}`,
    "",
    FRAME_TOP,
    "",
    `<b>${escapeHtml(monk.name)}</b>`,
    `📅 ${escapeHtml(monk.years)} · ☸️ ${escapeHtml(monk.tradition)}`,
    "",
    escapeHtml(monk.feat),
    "",
    FRAME_BOTTOM,
    "",
    `<i>${escapeHtml(monk.lesson)}</i>`,
  ].join("\n");
}

export function monkLessonText(monk: MonkEntry, lesson: string): string {
  return [
    `🪷 <b>Вдохновение · ${escapeHtml(monk.name)}</b>`,
    "",
    escapeHtml(lesson),
  ].join("\n");
}

export const wheelSpinningFrames = [
  "☸️ <i>Колесо вращается…</i>",
  "☸️☸️ <i>Карма перемешивается…</i>",
  "🌀 <i>Ом мани падме хум…</i>",
];

export function wheelResultText(title: string, minutes: number, fromLibrary: boolean): string {
  return [
    "☸️ <b>Колесо Дхармы остановилось</b>",
    "",
    FRAME_TOP,
    "",
    `<b>${escapeHtml(title)}</b> — ${minutes} минут${fromLibrary ? "" : " (из встроенных практик)"}.`,
    "",
    "Спорить с колесом бесполезно. Дхарма выбрала — ты практикуешь.",
    "",
    FRAME_BOTTOM,
  ].join("\n");
}

export const botMessages = {
  today: "🧘 Практика дня ждёт внутри дневника. Таймер, расписание и записи — там.",
  schedule: "☸️ План на день уже собран (или ждёт, когда ты его соберёшь).",
  help: [
    "🕯 <b>Чем бот может помочь</b>",
    "",
    "• /today — экран практики дня",
    "• /schedule — план на день",
    "• /quote — карта дня: коан или Пелевин",
    "• /monk — подвиг монаха дня",
    "• /japa — счётчик джапа-малы",
    "",
    "Всё остальное — внутри дневника: таймер, дневник, статистика.",
  ].join("\n"),
  unknown: "Я понимаю команды /today, /schedule, /quote, /monk и /japa. А ещё у меня есть меню 👇",
  aiSilent: "Учитель сейчас молчит. Даже это — урок 🌫 Попробуй ещё раз через минуту.",
} as const;
