import { DiaryEntry } from "../../../../../packages/domain/src";
import type { DiaryRepository, PracticeRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import type { CreateDiaryEntryInput } from "./dto";

export class DiaryService {
  constructor(
    private readonly diaryRepository: DiaryRepository,
    private readonly practiceRepository: PracticeRepository,
  ) {}

  list(userId: string) {
    return this.diaryRepository.listByUserId(userId);
  }

  async create(input: CreateDiaryEntryInput) {
    const now = new Date().toISOString();
    // Снимок названия практики: запись дневника должна оставаться понятной,
    // даже если практику потом удалят (practice_id обнулится каскадом).
    const practice = await this.practiceRepository.getById(input.practiceId);
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
      practice?.title ?? "",
    );
    await this.diaryRepository.upsert(entry);
    return entry;
  }
}
