import { GoogleAiProvider } from "../../../packages/ai-adapter/src/google-ai-provider";
import { MockAiProvider } from "../../../packages/ai-adapter/src/mock-provider";
import { OpenAiCompatibleProvider } from "../../../packages/ai-adapter/src/openai-compatible-provider";
import { FallbackAiProvider } from "../../../packages/ai-adapter/src/fallback-ai-provider";
import type { AiProvider } from "../../../packages/ai-adapter/src/provider";
import type { SQLiteClient } from "../../../packages/database/src/client";
import { applyMigrations, loadInitMigration, openSqliteDatabase, SqliteClientAdapter, SqliteDiaryRepository, SqliteMaterialRepository, SqliteNotificationRepository, SqlitePracticeCompletionRepository, SqlitePracticeRepository, SqliteScheduleRepository, SqliteSettingsRepository, SqliteStatisticsRepository, SqliteTimerRepository, SqliteUserRepository } from "../../../packages/database/src";
import { AiService } from "./modules/ai";
import { DiaryAiService, DiaryService } from "./modules/diary";
import { NotificationService } from "./modules/notifications";
import { PracticeLibraryService } from "./modules/practices";
import { ScheduleService } from "./modules/schedule";
import { ScheduleAiService } from "./modules/schedule";
import { StatisticsService } from "./modules/statistics";
import { TimerService } from "./modules/timer";
import { UserService } from "./modules/users/service";

/**
 * Сборка контейнера зависимостей.
 *
 * Клиент можно передать готовым — так делает Workers: там база D1 приходит
 * через биндинг, а миграции применяются заранее через `wrangler d1 migrations
 * apply` (в изоляте их гонять нельзя: он поднимается на каждый холодный старт).
 * Если клиент не передан — открываем локальный файл и накатываем миграции сами.
 */
export async function createApiContainer(
  databasePathOrClient: string | SQLiteClient = "./data/app.sqlite",
) {
  let client: SQLiteClient;

  if (typeof databasePathOrClient === "string") {
    const database = await openSqliteDatabase(databasePathOrClient);
    applyMigrations(database, loadInitMigration());
    client = new SqliteClientAdapter(database);
    // Колонка practices.source появилась позже init-схемы: локальная схема
    // исполняется при каждом старте (CREATE TABLE IF NOT EXISTS не обновляет
    // существующие таблицы), поэтому старые базы добиваем идемпотентно.
    try {
      await client.execute("alter table practices add column source text not null default 'manual'");
    } catch {
      // колонка уже есть — это единственная причина ошибки здесь
    }
    // Дневник переживает удаление практики: старые локальные базы имели
    // каскадное удаление journal_entries вместе с практикой — пересоздаём.
    const diaryFk = await client.query<Record<string, unknown>>(
      "select * from pragma_foreign_key_list('journal_entries')",
    );
    const cascadePractice = diaryFk.rows.some(
      (row) => String(row.table) === "practices" && String(row.on_delete).toUpperCase() === "CASCADE",
    );
    if (cascadePractice) {
      await client.execute(
        `create table journal_entries_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          practice_id TEXT REFERENCES practices(id) ON DELETE SET NULL,
          scheduled_practice_id TEXT REFERENCES scheduled_practices(id) ON DELETE SET NULL,
          practice_title TEXT NOT NULL DEFAULT '',
          kind TEXT NOT NULL,
          text TEXT NOT NULL,
          voice_file_id TEXT,
          transcription TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      );
      await client.execute(
        `insert into journal_entries_new (
          id, user_id, practice_id, scheduled_practice_id, practice_title,
          kind, text, voice_file_id, transcription, created_at, updated_at
        )
        select j.id, j.user_id, j.practice_id, j.scheduled_practice_id, coalesce(p.title, ''),
               j.kind, j.text, j.voice_file_id, j.transcription, j.created_at, j.updated_at
        from journal_entries j left join practices p on p.id = j.practice_id`,
      );
      await client.execute("drop table journal_entries");
      await client.execute("alter table journal_entries_new rename to journal_entries");
    }
  } else {
    client = databasePathOrClient;
  }

  const practiceRepository = new SqlitePracticeRepository(client);
  const materialRepository = new SqliteMaterialRepository(client);
  const diaryRepository = new SqliteDiaryRepository(client);
  const notificationRepository = new SqliteNotificationRepository(client);
  const scheduleRepository = new SqliteScheduleRepository(client);
  const statisticsRepository = new SqliteStatisticsRepository(client);
  const timerRepository = new SqliteTimerRepository(client);
  const completionRepository = new SqlitePracticeCompletionRepository(client);
  const userRepository = new SqliteUserRepository(client);
  const settingsRepository = new SqliteSettingsRepository(client);

  const googleApiKey = process.env.GOOGLE_API_KEY ?? "";
  const googleModel = process.env.GOOGLE_MODEL ?? "";
  const openrouterApiKey = process.env.OPENROUTER_API_KEY ?? "";
  const openrouterModel = process.env.OPENROUTER_MODEL ?? "";
  const openrouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const openrouterFallbackModels = (process.env.AI_FALLBACK_MODELS ?? "").split(",").map((value) => value.trim()).filter(Boolean);

  let aiProvider: AiProvider = new MockAiProvider();
  const googleConfigured = Boolean(googleApiKey && googleModel);
  const openrouterConfigured = Boolean(openrouterApiKey && openrouterModel);

  if (googleConfigured) {
    const googleProvider = new GoogleAiProvider({ apiKey: googleApiKey, model: googleModel });
    aiProvider = openrouterConfigured
      ? new FallbackAiProvider(
          googleProvider,
          new OpenAiCompatibleProvider({
            baseUrl: openrouterBaseUrl,
            apiKey: openrouterApiKey,
            model: openrouterModel,
            fallbackModels: openrouterFallbackModels,
          })
        )
      : googleProvider;
  } else if (openrouterConfigured) {
    aiProvider = new OpenAiCompatibleProvider({
      baseUrl: openrouterBaseUrl,
      apiKey: openrouterApiKey,
      model: openrouterModel,
      fallbackModels: openrouterFallbackModels,
    });
  }

  const aiService = new AiService(aiProvider);
  const scheduleService = new ScheduleService(scheduleRepository, practiceRepository);

  return {
    aiService,
    practiceRepository,
    diaryRepository,
    practiceLibraryService: new PracticeLibraryService(practiceRepository, materialRepository),
    scheduleService,
    scheduleAiService: new ScheduleAiService(aiService, scheduleService, practiceRepository),
    timerService: new TimerService(timerRepository, completionRepository, practiceRepository, scheduleRepository),
    diaryService: new DiaryService(diaryRepository, practiceRepository),
    diaryAiService: new DiaryAiService(aiService, diaryRepository, practiceRepository),
    statisticsService: new StatisticsService(statisticsRepository),
    notificationService: new NotificationService(notificationRepository),
    userService: new UserService(userRepository, settingsRepository),
  };
}

export type ApiContainer = Awaited<ReturnType<typeof createApiContainer>>;
