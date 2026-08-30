import { createMiniAppLaunchLink } from "./mini-app";

/** Кнопка, открывающая экран мини-аппа. */
function webAppButton(baseUrl: string, screen: string | undefined, title: string) {
  const link = createMiniAppLaunchLink(baseUrl, screen);
  return { text: title, web_app: { url: link.url } };
}

function callbackButton(callbackData: string, title: string) {
  return { text: title, callback_data: callbackData };
}

/**
 * Главная «мандала-меню»: веб-кнопки в шахматном порядке с интерактивом чата.
 * callback_data обязан быть ≤ 64 байт — поэтому только короткие слаги.
 */
export function mainMenuKeyboard(baseUrl: string) {
  return {
    inline_keyboard: [
      [
        webAppButton(baseUrl, "today", "🪷 Практика дня"),
        webAppButton(baseUrl, "schedule", "☸️ План дня"),
      ],
      [
        callbackButton("japa:0", "📿 Джапа 108"),
        callbackButton("koan:card", "🃏 Карта дня"),
        callbackButton("monk:day", "✨ Монах дня"),
      ],
      [
        callbackButton("wheel", "☸️ Крутить колесо"),
        webAppButton(baseUrl, "diary", "📖 Дневник"),
        webAppButton(baseUrl, "statistics", "📊 Статистика"),
      ],
    ],
  };
}

/** Открытка карты дня (курируемый коан по индексу). */
export function koanCardKeyboard(koanIndex: number) {
  return {
    inline_keyboard: [
      [callbackButton(`koan:ask:${koanIndex}`, "🕯 Спросить учителя")],
      [
        callbackButton("koan:new", "🎰 Новый коан"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

/** Свежий AI-коан: спросить учителя нельзя (текста нет в callback_data). */
export function aiKoanKeyboard() {
  return {
    inline_keyboard: [
      [
        callbackButton("koan:new", "🎰 Ещё коан"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

export function aiCommentaryKeyboard() {
  return {
    inline_keyboard: [
      [
        callbackButton("koan:card", "🃏 Карта дня"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

/**
 * Счётчик джапы хранит состояние прямо в callback_data — серверу не нужно
 * запоминать ничего между нажатиями.
 */
export function japaKeyboard(count: number) {
  return {
    inline_keyboard: [
      count >= 108
        ? [callbackButton("japa:reset", "🌀 Новая мала")]
        : [
            callbackButton(`japa:tap:${count}`, "📿 +1"),
            callbackButton("japa:reset", "🌀 Сброс"),
          ],
    ],
  };
}

export function monkKeyboard(monkId: string) {
  return {
    inline_keyboard: [
      [callbackButton(`monk:lesson:${monkId}`, "🪷 Вдохновение на сегодня")],
      [
        callbackButton(`monk:next:${monkId}`, "☸️ Другой монах"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

export function monkLessonKeyboard(monkId: string) {
  return {
    inline_keyboard: [
      [
        callbackButton(`monk:next:${monkId}`, "☸️ Другой монах"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

export function wheelKeyboard() {
  return {
    inline_keyboard: [
      [
        callbackButton("wheel", "🎰 Крутить ещё"),
        callbackButton("menu", "🏠 Меню"),
      ],
    ],
  };
}

export function openDiaryKeyboard(baseUrl: string, screen = "today") {
  return {
    inline_keyboard: [[webAppButton(baseUrl, screen, "🪷 Открыть дневник")]],
  };
}
