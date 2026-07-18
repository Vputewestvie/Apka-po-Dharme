export class DiaryEntry {
    id;
    userId;
    practiceId;
    scheduledPracticeId;
    kind;
    createdAt;
    updatedAt;
    text;
    voiceFileId;
    transcription;
    constructor(id, userId, practiceId, scheduledPracticeId, kind, createdAt, updatedAt = createdAt, text = "", voiceFileId = null, transcription = null) {
        this.id = id;
        this.userId = userId;
        this.practiceId = practiceId;
        this.scheduledPracticeId = scheduledPracticeId;
        this.kind = kind;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.text = text;
        this.voiceFileId = voiceFileId;
        this.transcription = transcription;
        if (kind === "text" && !text.trim())
            throw new Error("Text diary entry cannot be empty");
    }
}
