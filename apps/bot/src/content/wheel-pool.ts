/**
 * Запасной пул для «Колеса Дхармы», если у пользователя ещё нет своей
 * библиотеки практик. Названия совпадают со встроенными категориями
 * мини-аппа, чтобы кнопка «Открыть дневник» вела к знакомому экрану.
 */
export const wheelPool: Array<{ title: string; minutes: number }> = [
  { title: "Медитация", minutes: 20 },
  { title: "Пранаяма", minutes: 10 },
  { title: "Цигун", minutes: 25 },
  { title: "Мантра", minutes: 15 },
  { title: "Осознанная прогулка", minutes: 30 },
  { title: "Чтение дхармы", minutes: 20 },
  { title: "Благодарность", minutes: 5 },
  { title: "Практика перед сном", minutes: 10 },
];

export function randomFromPool() {
  return wheelPool[Math.floor(Math.random() * wheelPool.length)];
}
