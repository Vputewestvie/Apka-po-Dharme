import { DiaryEntry } from "../../../../../packages/domain/src";
import { createId } from "../../id";
export class DiaryService {
    diaryRepository;
    constructor(diaryRepository) {
        this.diaryRepository = diaryRepository;
    }
    list(userId) {
        return this.diaryRepository.listByUserId(userId);
    }
    async create(input) {
        const now = new Date().toISOString();
        const entry = new DiaryEntry(createId(), input.userId, input.practiceId, input.scheduledPracticeId, input.kind, now, now, input.text, input.voiceFileId ?? null, input.transcription ?? null);
        await this.diaryRepository.upsert(entry);
        return entry;
    }
}
