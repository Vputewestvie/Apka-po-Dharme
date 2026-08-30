import { Practice } from "../../../../../packages/domain/src";
import type { PracticeRepository } from "../../../../../packages/database/src";
import type { ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";
import { createId } from "../../id";
import { ValidationError } from "../../validation";
import type { AiService } from "../ai";
import { ScheduleService } from "./service";

/**
 * Приводит название практики к виду, пригодному для сравнения.
 *
 * Модель возвращает названия непоследовательно: «дыхания», «Дыхание»,
 * «breathing» — в разных падежах, регистре и даже языках. Сравнивать нужно по
 * нормализованной форме, иначе практика из библиотеки не находится.
 */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Отбрасывает типичные окончания, чтобы «дыхания» совпало с «дыхание». */
function stem(value: string): string {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word.replace(/(ии|ия|ию|ией|ием|иях|иям|иями|ой|ою|ые|ый|ая|ое|ому|ыми|ей|ем|ах|ам|ами|а|я|у|ю|е|и|о|ы)$/u, ""),
    )
    .join(" ");
}

/**
 * Сопоставляет название, пришедшее от модели, с практикой из библиотеки.
 *
 * Порядок: готовое соответствие от клиента → точное совпадение → по основе
 * слова → взаимное вхождение подстрокой → совпадение по одному из слов.
 * Возвращает null, если ничего не подошло.
 */
function resolvePracticeId(
  rawName: string,
  library: Practice[],
  nameToId: Record<string, string>,
): string | null {
  // 1. Клиент мог передать готовое соответствие — доверяем ему в первую очередь.
  const direct = nameToId[rawName];
  if (direct) return direct;
  for (const [key, id] of Object.entries(nameToId)) {
    if (normalizeName(key) === normalizeName(rawName)) return id;
  }

  const target = normalizeName(rawName);
  const targetStem = stem(rawName);
  if (!target) return null;

  // 2. Точное совпадение по названию в библиотеке.
  const exact = library.find((p) => normalizeName(p.title) === target);
  if (exact) return exact.id;

  // 3. Совпадение по основе («дыхания» → «дыхание»).
  const byStem = library.find((p) => stem(p.title) === targetStem);
  if (byStem) return byStem.id;

  // 4. Взаимное вхождение: «тихой медитации» ↔ «Медитация».
  const bySubstring = library.find((p) => {
    const title = normalizeName(p.title);
    return Boolean(title) && (title.includes(target) || target.includes(title));
  });
  if (bySubstring) return bySubstring.id;

  // 5. Совпадение по основе одного из слов («дыхания» ↔ «дыхание лотоса»).
  const targetWords = targetStem.split(" ").filter(Boolean);
  const byWord = library.find((p) => {
    const titleWords = stem(p.title).split(" ").filter(Boolean);
    return targetWords.some(
      (w) => w.length > 3 && titleWords.some((t) => t === w || t.startsWith(w) || w.startsWith(t)),
    );
  });
  return byWord?.id ?? null;
}

/** Категория для автосозданной практики — по ключевым словам названия. */
function guessCategory(name: string): string {
  const n = normalizeName(name);
  if (/дых|пранаям|breath|pranayam/.test(n)) return "Дыхание";
  if (/медитац|meditat|осознан|мозарефлекс/.test(n)) return "Ум";
  if (/чита|чтени|книг|reading|book/.test(n)) return "Текст";
  return "Тело";
}

/** Картинка для автосозданной практики — по категории (как на клиенте). */
function imageForCategory(category: string): { kind: "builtin"; ref: string } {
  switch (category) {
    case "Дыхание":
      return { kind: "builtin", ref: "/images/categories/pranayama.jpg" };
    case "Текст":
      return { kind: "builtin", ref: "/images/categories/reading.jpg" };
    default:
      return { kind: "builtin", ref: "/images/categories/qigong.jpg" };
  }
}

/** «чуть-чуть почитаем» → «Почитаем» — название практики с заглавной буквы. */
function toTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Новая практика";
  const first = trimmed[0].toLocaleUpperCase("ru");
  return first + trimmed.slice(1);
}

/** Собирает элементы расписания из разобранного ответа модели. */
function buildPractices(
  parsed: ParsedScheduleCommand,
  library: Practice[],
  nameToId: Record<string, string>,
): {
  practices: Array<{ practiceId: string; plannedStartTime: null; plannedDurationMinutes: number; order: number }>;
  unmatched: Array<{ practiceName: string; durationMinutes: number }>;
} {
  const practices: Array<{ practiceId: string; plannedStartTime: null; plannedDurationMinutes: number; order: number }> = [];
  const unmatched: Array<{ practiceName: string; durationMinutes: number }> = [];

  for (const item of parsed.items) {
    const practiceId = resolvePracticeId(item.practiceName, library, nameToId);
    // Последняя проверка владения: клиентский nameToId мог указывать на чужую
    // практику — такая считается ненайденной и создаётся заново.
    const known = practiceId !== null && library.some((p) => p.id === practiceId);
    const durationRaw = Number(item.durationMinutes);
    const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : 15;

    if (!known) {
      // Ненайденная практика не роняет план: пользователь может назвать что-то,
      // чего в библиотеке ещё нет, — тогда практика будет создана.
      unmatched.push({ practiceName: item.practiceName, durationMinutes: duration });
      continue;
    }
    practices.push({
      practiceId: practiceId!,
      plannedStartTime: null,
      plannedDurationMinutes: duration,
      order: practices.length,
    });
  }

  return { practices, unmatched };
}

/** Дата «сегодня» по UTC — модель часто не возвращает дату в ответе. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export class ScheduleAiService {
  constructor(
    private readonly aiService: AiService,
    private readonly scheduleService: ScheduleService,
    private readonly practiceRepository: PracticeRepository,
  ) {}

  async createFromText(userId: string, text: string, practiceNameToId: Record<string, string>) {
    const parsed = await this.aiService.parseScheduleText(text, { userId });
    return this.applyParsed(userId, parsed, practiceNameToId, "AI schedule", "text_ai");
  }

  async createFromVoice(userId: string, fileId: string, practiceNameToId: Record<string, string>) {
    const parsed = await this.aiService.parseScheduleVoice(fileId, { userId });
    return this.applyParsed(userId, parsed, practiceNameToId, "Voice schedule", "voice_ai");
  }

  /**
   * Превращает разобранный моделью ответ в план дня.
   *
   * Мягкое поведение: без даты берём сегодня, ненайденные практики автоматически
   * создаются в библиотеке (source: "ai") и попадают в план — пользователь может
   * описать день «своими словами», не заполняя библиотеку заранее. Существующий
   * план на дату заменяем, а не создаём дубль.
   */
  private async applyParsed(
    userId: string,
    parsed: ParsedScheduleCommand,
    practiceNameToId: Record<string, string>,
    title: string,
    source: "text_ai" | "voice_ai",
  ) {
    if (parsed.items.length === 0) {
      throw new ValidationError(
        "Не понял, какие практики включить в план. Опишите день конкретнее, например: «утром 15 минут медитации, вечером дыхание».",
      );
    }

    const library = await this.practiceRepository.listByUserId(userId);
    const { practices, unmatched } = buildPractices(parsed, library, practiceNameToId);

    for (const item of unmatched) {
      const category = guessCategory(item.practiceName);
      const created = new Practice(
        createId(),
        userId,
        toTitle(item.practiceName),
        `${toTitle(item.practiceName)} — практика, созданная из AI-плана.`,
        category,
        item.durationMinutes,
        "#688b76",
        "leaf",
        imageForCategory(category),
        "ai",
      );
      await this.practiceRepository.upsert(created);
      practices.push({
        practiceId: created.id,
        plannedStartTime: null,
        plannedDurationMinutes: item.durationMinutes,
        order: practices.length,
      });
    }

    if (practices.length === 0) {
      throw new ValidationError("Не удалось собрать план: список практик пуст.");
    }

    const date = parsed.date ?? todayUtc();
    const existing = await this.scheduleService.getByDate(userId, date);
    if (existing) {
      return this.scheduleService.replacePractices(userId, date, practices, title);
    }
    return this.scheduleService.create({ userId, date, title, source, practices });
  }
}
