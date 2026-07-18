export type CreateDiaryEntryInput = {
  userId: string;
  practiceId: string;
  scheduledPracticeId: string;
  kind: "text" | "voice";
  text: string;
  voiceFileId?: string | null;
  transcription?: string | null;
};
