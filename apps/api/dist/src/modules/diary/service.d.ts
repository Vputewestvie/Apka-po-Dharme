import { DiaryEntry } from "../../../../../packages/domain/src";
import type { DiaryRepository } from "../../../../../packages/database/src";
import type { CreateDiaryEntryInput } from "./dto";
export declare class DiaryService {
    private readonly diaryRepository;
    constructor(diaryRepository: DiaryRepository);
    list(userId: string): Promise<DiaryEntry[]>;
    create(input: CreateDiaryEntryInput): Promise<DiaryEntry>;
}
//# sourceMappingURL=service.d.ts.map