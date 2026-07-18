import { DiaryEntry, MaterialLink, Practice, PracticeSession, Schedule, ScheduledPractice, Statistics } from "../../../domain/src";
import type { DiaryRepository, MaterialRepository, NotificationRepository, PracticeCompletionRepository, PracticeRepository, ScheduleRepository, StatisticsRepository, TimerRepository, TimerEventType } from "../repositories";
import type { SQLiteClient } from "../client";
import type { MaterialLinkRow, NotificationJobRow, PracticeRow, ScheduleRow, ScheduledPracticeRow, StatisticsSnapshotRow } from "../rows";

function practiceToRow(practice: Practice): PracticeRow {
  return {
    id: practice.id,
    user_id: practice.userId,
    category_id: practice.category || null,
    title: practice.title,
    description: practice.description,
    image_kind: practice.image.kind,
    image_ref: practice.image.ref,
    icon: practice.icon,
    color: practice.color,
    default_duration_minutes: practice.defaultDurationMinutes,
    personal_notes: practice.notes,
    is_archived: practice.archived,
    created_at: practice.createdAt,
    updated_at: practice.updatedAt,
  };
}

function practiceFromRow(row: PracticeRow) {
  return new Practice(
    row.id,
    row.user_id,
    row.title,
    row.description,
    row.category_id ?? "",
    row.default_duration_minutes,
    row.color,
    row.icon,
    {
      kind: row.image_kind,
      ref: row.image_ref,
    },
    "manual",
    row.personal_notes,
    row.is_archived,
    row.created_at,
    row.updated_at,
  );
}

function materialToRow(material: MaterialLink): MaterialLinkRow {
  return {
    id: material.id,
    practice_id: material.practiceId,
    title: material.title,
    url: material.url,
    type: material.type,
    source_domain: material.sourceDomain,
    created_at: "",
    updated_at: "",
  };
}

function materialFromRow(row: MaterialLinkRow) {
  return new MaterialLink(row.id, row.practice_id, row.title, row.url, row.type, row.source_domain);
}

function diaryToRow(entry: DiaryEntry) {
  return {
    id: entry.id,
    user_id: entry.userId,
    practice_id: entry.practiceId,
    scheduled_practice_id: entry.scheduledPracticeId,
    kind: entry.kind,
    text: entry.text,
    voice_file_id: entry.voiceFileId,
    transcription: entry.transcription,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function diaryFromRow(row: Record<string, unknown>) {
  return new DiaryEntry(
    String(row.id),
    String(row.user_id),
    String(row.practice_id),
    String(row.scheduled_practice_id),
    String(row.kind) as DiaryEntry["kind"],
    String(row.created_at),
    String(row.updated_at ?? row.created_at),
    String(row.text ?? ""),
    row.voice_file_id ? String(row.voice_file_id) : null,
    row.transcription ? String(row.transcription) : null,
  );
}

function scheduleToRow(schedule: Schedule): ScheduleRow {
  const now = new Date().toISOString();
  return {
    id: schedule.id,
    user_id: schedule.userId,
    date: schedule.date,
    title: schedule.title,
    created_by: schedule.source,
    created_at: now,
    updated_at: now,
  };
}

function scheduleFromRow(row: ScheduleRow, items: ScheduledPractice[]) {
  return new Schedule(row.id, row.user_id, row.date, row.created_by, row.title, items);
}

function scheduledPracticeToRow(item: ScheduledPractice, scheduleId: string): ScheduledPracticeRow {
  const now = new Date().toISOString();
  return {
    id: item.id,
    schedule_id: scheduleId,
    practice_id: item.practiceId,
    planned_start_time: item.plannedStartTime,
    planned_duration_minutes: item.plannedDurationMinutes,
    sort_order: item.order,
    status: item.status,
    moved_from_id: null,
    created_at: now,
    updated_at: now,
  };
}

function scheduledPracticeFromRow(row: ScheduledPracticeRow, plannedDate: string) {
  return new ScheduledPractice(
    row.id,
    row.practice_id,
    plannedDate,
    row.planned_start_time,
    row.planned_duration_minutes,
    row.sort_order,
    row.status,
  );
}

function practiceSessionToRow(session: PracticeSession) {
  const now = new Date().toISOString();
  return {
    id: session.id,
    scheduled_practice_id: session.scheduledPracticeId,
    started_at: session.startedAt,
    paused_at: session.pausedAt,
    finished_at: session.finishedAt,
    planned_duration_minutes: session.plannedDurationMinutes,
    actual_duration_seconds: session.actualDurationSeconds,
    status: session.status,
    created_at: now,
    updated_at: now,
    practice_id: session.practiceId,
    user_id: session.userId,
  };
}

function practiceSessionFromRow(row: Record<string, unknown>) {
  return new PracticeSession(
    String(row.id),
    String(row.scheduled_practice_id),
    String(row.practice_id),
    String(row.user_id),
    Number(row.planned_duration_minutes ?? 0),
    row.started_at ? String(row.started_at) : null,
    row.paused_at ? String(row.paused_at) : null,
    row.finished_at ? String(row.finished_at) : null,
    Number(row.actual_duration_seconds ?? 0),
    String(row.status) as PracticeSession["status"],
  );
}

function practiceSessionToCompletionRow(session: PracticeSession) {
  const now = new Date().toISOString();
  return {
    id: session.id,
    scheduled_practice_id: session.scheduledPracticeId,
    result: session.result ?? session.status,
    actual_duration_seconds: session.actualDurationSeconds,
    skip_reason: session.skipReason,
    completed_at: session.finishedAt ?? now,
    created_at: now,
  };
}

export class SqlitePracticeRepository implements PracticeRepository {
  constructor(private readonly client: SQLiteClient) {}

  async listByUserId(userId: string): Promise<Practice[]> {
    const result = await this.client.query<PracticeRow>("select * from practices where user_id = ?", [userId]);
    return result.rows.map(practiceFromRow);
  }

  async getById(id: string): Promise<Practice | null> {
    const result = await this.client.query<PracticeRow>("select * from practices where id = ? limit 1", [id]);
    const row = result.rows[0];
    return row ? practiceFromRow(row) : null;
  }

  async upsert(practice: Practice): Promise<void> {
    const row = practiceToRow(practice);
    await this.client.execute(
      `insert into practices (
        id, user_id, category_id, title, description, image_kind, image_ref, icon, color,
        default_duration_minutes, personal_notes, is_archived, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        category_id = excluded.category_id,
        title = excluded.title,
        description = excluded.description,
        image_kind = excluded.image_kind,
        image_ref = excluded.image_ref,
        icon = excluded.icon,
        color = excluded.color,
        default_duration_minutes = excluded.default_duration_minutes,
        personal_notes = excluded.personal_notes,
        is_archived = excluded.is_archived,
        updated_at = excluded.updated_at`,
      [
        row.id,
        row.user_id,
        row.category_id,
        row.title,
        row.description,
        row.image_kind,
        row.image_ref,
        row.icon,
        row.color,
        row.default_duration_minutes,
        row.personal_notes,
        row.is_archived,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}

export class SqliteMaterialRepository implements MaterialRepository {
  constructor(private readonly client: SQLiteClient) {}

  async listByPracticeId(practiceId: string): Promise<MaterialLink[]> {
    const result = await this.client.query<MaterialLinkRow>("select * from practice_materials where practice_id = ?", [practiceId]);
    return result.rows.map(materialFromRow);
  }

  async upsert(material: MaterialLink): Promise<void> {
    const row = materialToRow(material);
    await this.client.execute(
      `insert into practice_materials (
        id, practice_id, title, url, type, source_domain, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        practice_id = excluded.practice_id,
        title = excluded.title,
        url = excluded.url,
        type = excluded.type,
        source_domain = excluded.source_domain,
        updated_at = excluded.updated_at`,
      [
        row.id,
        row.practice_id,
        row.title,
        row.url,
        row.type,
        row.source_domain,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}

export class SqliteDiaryRepository implements DiaryRepository {
  constructor(private readonly client: SQLiteClient) {}

  async listByUserId(userId: string): Promise<DiaryEntry[]> {
    const result = await this.client.query<Record<string, unknown>>(
      "select * from journal_entries where user_id = ? order by created_at desc",
      [userId],
    );
    return result.rows.map(diaryFromRow);
  }

  async upsert(entry: DiaryEntry): Promise<void> {
    const row = diaryToRow(entry);
    await this.client.execute(
      `insert into journal_entries (
        id, user_id, practice_id, scheduled_practice_id, kind, text, voice_file_id, transcription,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        text = excluded.text,
        voice_file_id = excluded.voice_file_id,
        transcription = excluded.transcription,
        updated_at = excluded.updated_at`,
      [
        row.id,
        row.user_id,
        row.practice_id,
        row.scheduled_practice_id,
        row.kind,
        row.text,
        row.voice_file_id,
        row.transcription,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}

export class SqliteStatisticsRepository implements StatisticsRepository {
  constructor(private readonly client: SQLiteClient) {}

  async getSnapshot(userId: string): Promise<Statistics | null> {
    const completionTotals = await this.client.query<Record<string, unknown>>(
      `select
        count(*) as total_count,
        sum(case when pc.result = 'completed' then 1 else 0 end) as completed_count,
        sum(case when pc.result = 'skipped' then 1 else 0 end) as skipped_count,
        sum(case when pc.result = 'moved' then 1 else 0 end) as moved_count,
        sum(pc.actual_duration_seconds) as total_seconds
       from practice_completions pc
       join scheduled_practices sp on sp.id = pc.scheduled_practice_id
       join schedules s on s.id = sp.schedule_id
       where s.user_id = ?`,
      [userId],
    );

    const favoriteResult = await this.client.query<Record<string, unknown>>(
      `select sp.practice_id, count(*) as total
       from practice_completions pc
       join scheduled_practices sp on sp.id = pc.scheduled_practice_id
       join schedules s on s.id = sp.schedule_id
       where s.user_id = ? and pc.result = 'completed'
       group by sp.practice_id
       order by total desc`,
      [userId],
    );

    const row = completionTotals.rows[0];
    const statistics = new Statistics(userId);
    statistics.totalMinutes = Math.round(Number(row?.total_seconds ?? 0) / 60);
    statistics.completedCount = Number(row?.completed_count ?? 0);
    statistics.skippedCount = Number(row?.skipped_count ?? 0);
    statistics.movedCount = Number(row?.moved_count ?? 0);
    statistics.favoritePracticeIds = favoriteResult.rows.map((item) => String(item.practice_id));
    return statistics;
  }

  async upsert(snapshot: Statistics): Promise<void> {
    const row: StatisticsSnapshotRow = {
      user_id: snapshot.userId,
      total_minutes: snapshot.totalMinutes,
      completed_count: snapshot.completedCount,
      skipped_count: snapshot.skippedCount,
      moved_count: snapshot.movedCount,
      streak_days: snapshot.streakDays,
      favorite_practice_ids_json: JSON.stringify(snapshot.favoritePracticeIds),
      updated_at: new Date().toISOString(),
    };
    await this.client.execute(
      `insert into statistics_snapshots (
        user_id, total_minutes, completed_count, skipped_count, moved_count, streak_days,
        favorite_practice_ids_json, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(user_id) do update set
        total_minutes = excluded.total_minutes,
        completed_count = excluded.completed_count,
        skipped_count = excluded.skipped_count,
        moved_count = excluded.moved_count,
        streak_days = excluded.streak_days,
        favorite_practice_ids_json = excluded.favorite_practice_ids_json,
        updated_at = excluded.updated_at`,
      [
        row.user_id,
        row.total_minutes,
        row.completed_count,
        row.skipped_count,
        row.moved_count,
        row.streak_days,
        row.favorite_practice_ids_json,
        row.updated_at,
      ],
    );
  }
}

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly client: SQLiteClient) {}

  async listPending(now: string): Promise<NotificationJobRow[]> {
    const result = await this.client.query<NotificationJobRow>(
      "select * from notification_jobs where status = 'pending' and scheduled_at <= ? order by scheduled_at asc",
      [now],
    );
    return result.rows;
  }

  async upsert(job: NotificationJobRow): Promise<void> {
    await this.client.execute(
      `insert into notification_jobs (
        id, user_id, type, scheduled_at, sent_at, status, payload_json, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        scheduled_at = excluded.scheduled_at,
        sent_at = excluded.sent_at,
        status = excluded.status,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`,
      [
        job.id,
        job.user_id,
        job.type,
        job.scheduled_at,
        job.sent_at,
        job.status,
        job.payload_json,
        job.created_at,
        job.updated_at,
      ],
    );
  }

  async markSent(jobId: string, sentAt: string): Promise<void> {
    await this.client.execute(
      "update notification_jobs set status = 'sent', sent_at = ?, updated_at = ? where id = ?",
      [sentAt, sentAt, jobId],
    );
  }

  async cancel(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute(
      "update notification_jobs set status = 'cancelled', updated_at = ? where id = ?",
      [now, jobId],
    );
  }
}

export class SqliteScheduleRepository implements ScheduleRepository {
  constructor(private readonly client: SQLiteClient) {}

  async getByUserIdAndDate(userId: string, date: string): Promise<Schedule | null> {
    const scheduleResult = await this.client.query<ScheduleRow>(
      "select * from schedules where user_id = ? and date = ? limit 1",
      [userId, date],
    );
    const scheduleRow = scheduleResult.rows[0];
    if (!scheduleRow) return null;

    const itemsResult = await this.client.query<ScheduledPracticeRow>(
      "select * from scheduled_practices where schedule_id = ? order by sort_order asc",
      [scheduleRow.id],
    );
    return scheduleFromRow(
      scheduleRow,
      itemsResult.rows.map((item) => scheduledPracticeFromRow(item, scheduleRow.date)),
    );
  }

  async upsert(schedule: Schedule): Promise<void> {
    const row = scheduleToRow(schedule);
    await this.client.execute(
      `insert into schedules (id, user_id, date, title, created_by, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         date = excluded.date,
         title = excluded.title,
         created_by = excluded.created_by,
         updated_at = excluded.updated_at`,
      [row.id, row.user_id, row.date, row.title, row.created_by, row.created_at, row.updated_at],
    );

    await this.client.execute("delete from scheduled_practices where schedule_id = ?", [schedule.id]);
    for (const item of schedule.items) {
      const itemRow = scheduledPracticeToRow(item, schedule.id);
      await this.client.execute(
        `insert into scheduled_practices (
          id, schedule_id, practice_id, planned_start_time, planned_duration_minutes, sort_order,
          status, moved_from_id, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemRow.id,
          itemRow.schedule_id,
          itemRow.practice_id,
          itemRow.planned_start_time,
          itemRow.planned_duration_minutes,
          itemRow.sort_order,
          itemRow.status,
          itemRow.moved_from_id,
          itemRow.created_at,
          itemRow.updated_at,
        ],
      );
    }
  }
}

export class SqliteTimerRepository implements TimerRepository {
  constructor(private readonly client: SQLiteClient) {}

  async getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `select ts.*, sp.practice_id, s.user_id
       from timer_sessions ts
       join scheduled_practices sp on sp.id = ts.scheduled_practice_id
       join schedules s on s.id = sp.schedule_id
       where ts.scheduled_practice_id = ?
       limit 1`,
      [scheduledPracticeId],
    );
    const row = result.rows[0];
    return row ? practiceSessionFromRow(row) : null;
  }

  async upsert(session: PracticeSession): Promise<void> {
    const row = practiceSessionToRow(session);
    await this.client.execute(
      `insert into timer_sessions (
        id, scheduled_practice_id, started_at, paused_at, finished_at, planned_duration_minutes,
        actual_duration_seconds, status, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        started_at = excluded.started_at,
        paused_at = excluded.paused_at,
        finished_at = excluded.finished_at,
        actual_duration_seconds = excluded.actual_duration_seconds,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        row.id,
        row.scheduled_practice_id,
        row.started_at,
        row.paused_at,
        row.finished_at,
        row.planned_duration_minutes,
        row.actual_duration_seconds,
        row.status,
        row.created_at,
        row.updated_at,
      ],
    );
  }

  async appendEvent(sessionId: string, eventType: TimerEventType, payloadJson: string): Promise<void> {
    await this.client.execute(
      "insert into timer_events (id, timer_session_id, event_type, event_at, payload_json) values (?, ?, ?, ?, ?)",
      [cryptoRandomId(), sessionId, eventType, new Date().toISOString(), payloadJson],
    );
  }
}

export class SqlitePracticeCompletionRepository implements PracticeCompletionRepository {
  constructor(private readonly client: SQLiteClient) {}

  async getByScheduledPracticeId(scheduledPracticeId: string): Promise<PracticeSession | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `select pc.*, sp.practice_id, s.user_id, ts.planned_duration_minutes
       from practice_completions pc
       join scheduled_practices sp on sp.id = pc.scheduled_practice_id
       join schedules s on s.id = sp.schedule_id
       left join timer_sessions ts on ts.scheduled_practice_id = pc.scheduled_practice_id
       where pc.scheduled_practice_id = ?
       limit 1`,
      [scheduledPracticeId],
    );
    const row = result.rows[0];
    return row
      ? new PracticeSession(
          String(row.id),
          String(row.scheduled_practice_id),
          String(row.practice_id),
          String(row.user_id),
          Number(row.planned_duration_minutes ?? 0),
          null,
          null,
          String(row.completed_at),
          Number(row.actual_duration_seconds ?? 0),
          String(row.result) as PracticeSession["status"],
          String(row.result) as PracticeSession["result"],
          String(row.skip_reason ?? "") || null,
        )
      : null;
  }

  async upsert(completion: PracticeSession): Promise<void> {
    const row = practiceSessionToCompletionRow(completion);
    await this.client.execute(
      `insert into practice_completions (
        id, scheduled_practice_id, result, actual_duration_seconds, skip_reason, completed_at, created_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(scheduled_practice_id) do update set
        result = excluded.result,
        actual_duration_seconds = excluded.actual_duration_seconds,
        skip_reason = excluded.skip_reason,
        completed_at = excluded.completed_at`,
      [
        row.id,
        row.scheduled_practice_id,
        row.result,
        row.actual_duration_seconds,
        row.skip_reason,
        row.completed_at,
        row.created_at,
      ],
    );
  }
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
