import type { ID, ISODateTime, JournalKind } from "./types";

export class DiaryEntry {
  constructor(
    public readonly id: ID,
    public readonly userId: ID,
    // practiceId/scheduledPracticeId обнуляются, когда практика или пункт
    // расписания удалены: записи дневника — важные данные, они сохраняются.
    // Название практики на момент записи хранится в practiceTitle.
    public readonly practiceId: ID | null,
    public readonly scheduledPracticeId: ID | null,
    public readonly kind: JournalKind,
    public readonly createdAt: ISODateTime,
    public updatedAt: ISODateTime = createdAt,
    public text: string = "",
    public voiceFileId: ID | null = null,
    public transcription: string | null = null,
    public readonly practiceTitle: string = "",
  ) {
    if (kind === "text" && !text.trim()) throw new Error("Text diary entry cannot be empty");
  }
}
