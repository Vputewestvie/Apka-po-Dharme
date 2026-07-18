export type UserRow = {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    language_code: string | null;
    timezone: string;
    created_at: string;
    updated_at: string;
};
export type UserSettingsRow = {
    id: string;
    user_id: string;
    theme: "light" | "dark";
    ai_enabled: boolean;
    ai_provider: string | null;
    notification_enabled: boolean;
    morning_notification_time: string | null;
    day_notification_time: string | null;
    evening_notification_time: string | null;
    created_at: string;
    updated_at: string;
};
export type PracticeRow = {
    id: string;
    user_id: string;
    category_id: string | null;
    title: string;
    description: string;
    image_kind: "builtin" | "user";
    image_ref: string;
    icon: string;
    color: string;
    default_duration_minutes: number;
    personal_notes: string;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
};
export type ScheduleRow = {
    id: string;
    user_id: string;
    date: string;
    title: string;
    created_by: "manual" | "text_ai" | "voice_ai" | "repeat_yesterday";
    created_at: string;
    updated_at: string;
};
export type ScheduledPracticeRow = {
    id: string;
    schedule_id: string;
    practice_id: string;
    planned_start_time: string | null;
    planned_duration_minutes: number;
    sort_order: number;
    status: "planned" | "running" | "paused" | "completed" | "skipped" | "moved";
    moved_from_id: string | null;
    created_at: string;
    updated_at: string;
};
export type PracticeCompletionRow = {
    id: string;
    scheduled_practice_id: string;
    result: "completed" | "skipped" | "moved";
    actual_duration_seconds: number;
    skip_reason: string | null;
    completed_at: string;
    created_at: string;
};
export type DiaryEntryRow = {
    id: string;
    user_id: string;
    practice_id: string;
    scheduled_practice_id: string;
    kind: "text" | "voice";
    text: string;
    voice_file_id: string | null;
    transcription: string | null;
    created_at: string;
    updated_at: string;
};
export type StatisticsSnapshotRow = {
    user_id: string;
    total_minutes: number;
    completed_count: number;
    skipped_count: number;
    moved_count: number;
    streak_days: number;
    favorite_practice_ids_json: string;
    updated_at: string;
};
export type MaterialLinkRow = {
    id: string;
    practice_id: string;
    title: string;
    url: string;
    type: "article" | "video" | "book" | "lecture";
    source_domain: string;
    created_at: string;
    updated_at: string;
};
export type NotificationJobRow = {
    id: string;
    user_id: string;
    type: "morning" | "day" | "evening" | "next_practice" | "timer_finished";
    scheduled_at: string;
    sent_at: string | null;
    status: "pending" | "sent" | "cancelled";
    payload_json: string;
    created_at: string;
    updated_at: string;
};
//# sourceMappingURL=rows.d.ts.map