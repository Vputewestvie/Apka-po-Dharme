import type { Practice } from "../../../../../packages/domain/src";
import type { PracticeRepository } from "../../../../../packages/database/src";
import type { ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";
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

/** Собирает элементы расписания из разобранного ответа модели. */
function buildPractices(
  parsed: ParsedScheduleCommand,
  library: Practice[],
  nameToId: Record<string, string>,
): { practices: Array<{ practiceId: string; plannedStartTime: null; plannedDurationMinutes: number; order: number }>; unmatched: string[] } {
  const practices: Array<{ practiceId: string; plannedStartTime: null; plannedDurationMinutes: number; order: number }> = [];
  const unmatched: string[] = [];

  for (const item of parsed.items) {
    const practiceId = resolvePracticeId(item.practiceName, library, nameToId);
    // Последняя проверка владения: клиентский nameToId мог указывать на чужую
    // практику — такая считается ненайденной, а не добавляется в план.
    if (!practiceId || !library.some((p) => p.id === practiceId)) {
      // Ненайденное имя больше не роняет весь план (раньше это был 404 на
      // каждый запрос, если в описании встречалась практика вне библиотеки).
      // Такие пункты пропускаются и репортируются пользователю.
      unmatched.push(item.practiceName);
      continue;
    }
    const duration = Number(item.durationMinutes);
    practices.push({
      practiceId,
      plannedStartTime: null,
      plannedDurationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 15,
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
   * Мягкое поведение: без даты берём сегодня, ненайденные практики пропускаем
   * (ошибка только если не нашлось ни одной), существующий план на дату
   * заменяем, а не создаём дубль.
   */
  private async applyParsed(
    userId: string,
    parsed: ParsedScheduleCommand,
    practiceNameToId: Record<string, string>,
    title: string,
    source: "text_ai" | "voice_ai",
  ) {
    const library = await this.practiceRepository.listByUserId(userId);
    if (library.length === 0) {
      throw new ValidationError(
        "В библиотеке нет практик. Сначала добавьте практики на вкладке «Практики», потом собирайте план.",
      );
    }

    const { practices, unmatched } = buildPractices(parsed, library, practiceNameToId);
    if (practices.length === 0) {
      throw new ValidationError(
        `Не нашёл в библиотеке ни одной практики из описания (${unmatched.join(", ")}). Добавьте их на вкладке «Практики» или назовите существующие: ${library.map((p) => p.title).join(", ")}.`,
      );
    }

    const date = parsed.date ?? todayUtc();
    const existing = await this.scheduleService.getByDate(userId, date);
    if (existing) {
      return this.scheduleService.replacePractices(userId, date, practices, title);
    }
    return this.scheduleService.create({ userId, date, title, source, practices });
  }
}
