import { DiaryEntry } from "../../../../../packages/domain/src";
import type { DiaryRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import type { CreateDiaryEntryInput } from "./dto";

export class DiaryService {
  constructor(private readonly diaryRepository: DiaryRepository) {}

  list(userId: string) {
    return this.diaryRepository.listByUserId(userId);
  }

  async create(input: CreateDiaryEntryInput) {
    const now = new Date().toISOString();
    const entry = new DiaryEntry(
      createId(),
      input.userId,
      input.practiceId,
      input.scheduledPracticeId,
      input.kind,
      now,
      now,
      input.text,
      input.voiceFileId ?? null,
      input.transcription ?? null,
    );
    await this.diaryRepository.upsert(entry);
    return entry;
  }
}
