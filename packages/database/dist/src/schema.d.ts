export declare const tables: {
    readonly users: "users";
    readonly userSettings: "user_settings";
    readonly practiceCategories: "practice_categories";
    readonly practices: "practices";
    readonly practiceMaterials: "practice_materials";
    readonly files: "files";
    readonly schedules: "schedules";
    readonly scheduledPractices: "scheduled_practices";
    readonly timerSessions: "timer_sessions";
    readonly timerEvents: "timer_events";
    readonly practiceCompletions: "practice_completions";
    readonly journalEntries: "journal_entries";
    readonly scheduleChanges: "schedule_changes";
    readonly notificationJobs: "notification_jobs";
    readonly aiRequests: "ai_requests";
};
export type TableName = (typeof tables)[keyof typeof tables];
//# sourceMappingURL=schema.d.ts.map