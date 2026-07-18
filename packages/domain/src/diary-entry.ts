import type { ID, ISODateTime, JournalKind } from "./types";

export class DiaryEntry {
  constructor(
    public readonly id: ID,
    public readonly userId: ID,
    public readonly practiceId: ID,
    public readonly scheduledPracticeId: ID,
    public readonly kind: JournalKind,
    public readonly createdAt: ISODateTime,
    public updatedAt: ISODateTime = createdAt,
    public text: string = "",
    public voiceFileId: ID | null = null,
    public transcription: string | null = null,
  ) {
    if (kind === "text" && !text.trim()) throw new Error("Text diary entry cannot be empty");
  }
}
