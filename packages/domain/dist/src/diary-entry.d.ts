import type { ID, ISODateTime, JournalKind } from "./types";
export declare class DiaryEntry {
    readonly id: ID;
    readonly userId: ID;
    readonly practiceId: ID;
    readonly scheduledPracticeId: ID;
    readonly kind: JournalKind;
    readonly createdAt: ISODateTime;
    updatedAt: ISODateTime;
    text: string;
    voiceFileId: ID | null;
    transcription: string | null;
    constructor(id: ID, userId: ID, practiceId: ID, scheduledPracticeId: ID, kind: JournalKind, createdAt: ISODateTime, updatedAt?: ISODateTime, text?: string, voiceFileId?: ID | null, transcription?: string | null);
}
//# sourceMappingURL=diary-entry.d.ts.map