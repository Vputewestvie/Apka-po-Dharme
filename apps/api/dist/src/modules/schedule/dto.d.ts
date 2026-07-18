export type SchedulePracticeInput = {
    practiceId: string;
    plannedStartTime: string | null;
    plannedDurationMinutes: number;
    order: number;
};
export type CreateScheduleInput = {
    userId: string;
    date: string;
    title: string;
    source?: "manual" | "text_ai" | "voice_ai" | "repeat_yesterday";
    practices: SchedulePracticeInput[];
};
export type RepeatYesterdayInput = {
    userId: string;
    date: string;
    title: string;
    previousDate: string;
};
export type RemoveScheduledPracticeInput = {
    userId: string;
    date: string;
    scheduledPracticeId: string;
};
export type ChangeScheduledPracticeTimeInput = {
    userId: string;
    date: string;
    scheduledPracticeId: string;
    plannedStartTime: string | null;
    plannedDurationMinutes: number;
};
//# sourceMappingURL=dto.d.ts.map