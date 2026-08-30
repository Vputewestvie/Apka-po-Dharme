/**
 * Детерминированный «выбор дня».
 *
 * Карта дня должна быть ОДНОЙ на сутки — если пользователь откроет бота
 * утром и вечером, он увидит ту же карту. Поэтому индекс считается хэшем
 * от даты (и для карт — ещё и от id пользователя), а не Math.random().
 */

/** FNV-1a 32 бит: короткий, стабильный, без зависимостей. */
export function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function pickByDate<T>(items: T[], dateIso: string, salt = ""): number {
  if (items.length === 0) return -1;
  return hash32(`${salt}|${dateIso}`) % items.length;
}

export function pickForUser<T>(items: T[], dateIso: string, telegramId: number | string): number {
  if (items.length === 0) return -1;
  return hash32(`${dateIso}|${telegramId}`) % items.length;
}
