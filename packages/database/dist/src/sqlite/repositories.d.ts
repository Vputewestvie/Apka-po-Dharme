import { DiaryEntry, MaterialLink, Practice, PracticeSession, Schedule, Statistics } from "../../../domain/src";
import type { DiaryRepository, MaterialRepository, NotificationRepository, PracticeCompletionRepository, PracticeRepository, ScheduleRepository, StatisticsRepository, TimerRepository, TimerEventType } from "../repositories";
import type { SQLiteClient } from "../client";
import type { NotificationJobRow } from "../rows";
export declare class SqlitePracticeRepository implements PracticeRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    listByUserId(userId: string): Promise<Practice[]>;
    getById(id: string): Promise<Practice | null>;
    upsert(practice: Practice): Promise<void>;
}
export declare class SqliteMaterialRepository implements MaterialRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    listByPracticeId(practiceId: string): Promise<MaterialLink[]>;
    upsert(material: MaterialLink): Promise<void>;
}
export declare class SqliteDiaryRepository implements DiaryRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    listByUserId(userId: string): Promise<DiaryEntry[]>;
    upsert(entry: DiaryEntry): Promise<void>;
}
export declare class SqliteStatisticsRepository implements StatisticsRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    getSnapshot(userId: string): Promise<Statistics | null>;
    upsert(snapshot: Statistics): Promise<void>;
}
export declare class SqliteNotificationRepository implements NotificationRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    listPending(now: string): Promise<NotificationJobRow[]>;
    upsert(job: NotificationJobRow): Promise<void>;
    markSent(jobId: string, sentAt: string): Promise<void>;
    cancel(jobId: string): Promise<void>;
}
export declare class SqliteScheduleRepository implements ScheduleRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    getByUserIdAndDate(userId: string, date: string): Promise<Schedule | null>;
    upsert(schedule: Schedule): Promise<void>;
}
export declare class SqliteTimerRepository implements TimerRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null>;
    upsert(session: PracticeSession): Promise<void>;
    appendEvent(sessionId: string, eventType: TimerEventType, payloadJson: string): Promise<void>;
}
export declare class SqlitePracticeCompletionRepository implements PracticeCompletionRepository {
    private readonly client;
    constructor(client: SQLiteClient);
    getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null>;
    upsert(completion: PracticeSession): Promise<void>;
}
//# sourceMappingURL=repositories.d.ts.map