/**
 * «Небо над путём»: фаза луны и приветствие по времени суток.
 *
 * Часовой пояс пользователя боту неизвестен (мини-апп узнаёт его отдельно),
 * поэтому время берём UTC — для открытки этого достаточно.
 */

/** Новолуние 2000-01-06 18:14 UTC — фиксированная точка отсчёта фаз. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH_DAYS = 29.530588853;

const MOON_EMOJI = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"] as const;

export function moonPhaseEmoji(now = new Date()): string {
  const ageDays =
    (((now.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000) % SYNODIC_MONTH_DAYS + SYNODIC_MONTH_DAYS)
      % SYNODIC_MONTH_DAYS;
  return MOON_EMOJI[Math.floor((ageDays / SYNODIC_MONTH_DAYS) * 8) % 8];
}

export function moonPhaseName(now = new Date()): string {
  const ageDays =
    (((now.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000) % SYNODIC_MONTH_DAYS + SYNODIC_MONTH_DAYS)
      % SYNODIC_MONTH_DAYS;
  if (ageDays < 1.85) return "новолуние";
  if (ageDays < 5.5) return "молодая луна";
  if (ageDays < 9.2) return "первая четверть";
  if (ageDays < 12.9) return "растущая луна";
  if (ageDays < 16.6) return "полнолуние";
  if (ageDays < 20.3) return "убывающая луна";
  if (ageDays < 24) return "последняя четверть";
  return "старая луна";
}

export function dayGreeting(now = new Date()): { emoji: string; text: string } {
  const hour = now.getUTCHours();
  if (hour >= 4 && hour < 10) return { emoji: "🌅", text: "Доброе утро" };
  if (hour >= 10 && hour < 17) return { emoji: "☀️", text: "Добрый день" };
  if (hour >= 17 && hour < 22) return { emoji: "🌇", text: "Добрый вечер" };
  return { emoji: "🌙", text: "Тихой ночи" };
}
