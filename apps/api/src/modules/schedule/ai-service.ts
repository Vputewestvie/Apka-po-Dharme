import type { Practice } from "../../../../../packages/domain/src";
import type { PracticeRepository } from "../../../../../packages/database/src";
import type { ParsedScheduleCommand } from "../../../../../packages/ai-adapter/src";
import { NotFoundError } from "../../validation";
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
) {
  return parsed.items.map((item, index) => {
    const practiceId = resolvePracticeId(item.practiceName, library, nameToId);
    if (!practiceId) {
      // Раньше имя использовалось как идентификатор и всё падало с 500.
      // Ненайденная практика — ошибка запроса, а не сервера.
      throw new NotFoundError(`Practice not found: "${item.practiceName}"`);
    }
    return {
      practiceId,
      plannedStartTime: null,
      plannedDurationMinutes: item.durationMinutes,
      order: index,
    };
  });
}

export class ScheduleAiService {
  constructor(
    private readonly aiService: AiService,
    private readonly scheduleService: ScheduleService,
    private readonly practiceRepository: PracticeRepository,
  ) {}

  async createFromText(userId: string, text: string, practiceNameToId: Record<string, string>) {
    const parsed = await this.aiService.parseScheduleText(text, { userId });
    if (!parsed.date) throw new NotFoundError("AI did not return schedule date");

    const library = await this.practiceRepository.listByUserId(userId);
    return this.scheduleService.create({
      userId,
      date: parsed.date,
      title: "AI schedule",
      source: "text_ai",
      practices: buildPractices(parsed, library, practiceNameToId),
    });
  }

  async createFromVoice(userId: string, fileId: string, practiceNameToId: Record<string, string>) {
    const parsed = await this.aiService.parseScheduleVoice(fileId, { userId });
    if (!parsed.date) throw new NotFoundError("AI did not return schedule date");

    const library = await this.practiceRepository.listByUserId(userId);
    return this.scheduleService.create({
      userId,
      date: parsed.date,
      title: "Voice schedule",
      source: "voice_ai",
      practices: buildPractices(parsed, library, practiceNameToId),
    });
  }
}
