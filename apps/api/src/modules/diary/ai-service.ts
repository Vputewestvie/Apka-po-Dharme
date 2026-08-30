import type { DiaryRepository, PracticeRepository } from "../../../../../packages/database/src";
import type { DiaryEntry } from "../../../../../packages/domain/src";
import type { AiService } from "../ai";

const MAX_ENTRIES = 40;
const MAX_ENTRY_CHARS = 700;

/**
 * AI-анализ дневника практики: на основе записей пользователя модель
 * описывает наблюдения и даёт рекомендации в контексте дхармы.
 */
export class DiaryAiService {
  constructor(
    private readonly aiService: AiService,
    private readonly diaryRepository: DiaryRepository,
    private readonly practiceRepository: PracticeRepository,
  ) {}

  async analyze(userId: string, question?: string): Promise<string> {
    const [entries, library] = await Promise.all([
      this.diaryRepository.listByUserId(userId),
      this.practiceRepository.listByUserId(userId),
    ]);

    if (entries.length === 0) {
      return "В дневнике пока нет записей. Добавь хотя бы одну запись после практики — и я смогу проанализировать твой опыт и подсказать, как углубить практику.";
    }

    const prompt = buildAnalysisPrompt(entries, library.map((p) => p.title), question);
    return this.aiService.answerUserQuestion(prompt);
  }
}

function formatEntry(entry: DiaryEntry): string {
  const date = entry.createdAt.slice(0, 10);
  const title = entry.practiceTitle || "практика";
  const text = entry.text.length > MAX_ENTRY_CHARS ? `${entry.text.slice(0, MAX_ENTRY_CHARS)}…` : entry.text;
  return `${date} (${title}): ${text}`;
}

function buildAnalysisPrompt(entries: DiaryEntry[], practiceTitles: string[], question?: string): string {
  const diary = entries
    .slice(0, MAX_ENTRIES)
    .map(formatEntry)
    .join("\n");

  const parts = [
    "Ты — внимательный и тёплый наставник по духовным практикам (дхарма, осознанность, медитация, дыхание).",
    "Ниже — дневник практики человека: короткие записи о том, что он заметил после практик.",
    "Проанализируй записи и ответь на русском:",
    "1) 2–4 наблюдения: что заметно в практике (регулярность, настройки, повторяющиеся темы, рост или сложности);",
    "2) 2–4 конкретные рекомендации — мягкие, без осуждения и давления, в духе дхармы; предлагай малые шаги;",
    "3) если в конце есть вопрос от человека — ответь и на него, опираясь на записи.",
    "Пиши по-человечески, тёпло и коротко (до 200 слов), без markdown-разметки и без нумерации заголовков.",
    "",
    "Дневник (от свежих записей к старым):",
    diary,
  ];

  if (practiceTitles.length > 0) {
    parts.push("", `Практики в библиотеке: ${practiceTitles.join(", ")}.`);
  }
  const trimmedQuestion = question?.trim();
  if (trimmedQuestion) {
    parts.push("", `Вопрос от человека: ${trimmedQuestion}`);
  }

  return parts.join("\n");
}
