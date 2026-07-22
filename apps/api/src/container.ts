import { GoogleAiProvider } from "../../../packages/ai-adapter/src/google-ai-provider";
import { MockAiProvider } from "../../../packages/ai-adapter/src/mock-provider";
import { OpenAiCompatibleProvider } from "../../../packages/ai-adapter/src/openai-compatible-provider";
import { FallbackAiProvider } from "../../../packages/ai-adapter/src/fallback-ai-provider";
import type { AiProvider } from "../../../packages/ai-adapter/src/provider";
import { applyMigrations, loadInitMigration, openSqliteDatabase, SqliteClientAdapter, SqliteDiaryRepository, SqliteMaterialRepository, SqliteNotificationRepository, SqlitePracticeCompletionRepository, SqlitePracticeRepository, SqliteScheduleRepository, SqliteStatisticsRepository, SqliteTimerRepository } from "../../../packages/database/src";
import { AiService } from "./modules/ai";
import { DiaryService } from "./modules/diary";
import { NotificationService } from "./modules/notifications";
import { PracticeLibraryService } from "./modules/practices";
import { ScheduleService } from "./modules/schedule";
import { ScheduleAiService } from "./modules/schedule";
import { StatisticsService } from "./modules/statistics";
import { TimerService } from "./modules/timer";

export async function createApiContainer(databasePath: string) {
  const database = await openSqliteDatabase(databasePath);
  applyMigrations(database, loadInitMigration());

  const client = new SqliteClientAdapter(database);
  const practiceRepository = new SqlitePracticeRepository(client);
  const materialRepository = new SqliteMaterialRepository(client);
  const diaryRepository = new SqliteDiaryRepository(client);
  const notificationRepository = new SqliteNotificationRepository(client);
  const scheduleRepository = new SqliteScheduleRepository(client);
  const statisticsRepository = new SqliteStatisticsRepository(client);
  const timerRepository = new SqliteTimerRepository(client);
  const completionRepository = new SqlitePracticeCompletionRepository(client);

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
    practiceLibraryService: new PracticeLibraryService(practiceRepository, materialRepository),
    scheduleService,
    scheduleAiService: new ScheduleAiService(aiService, scheduleService),
    timerService: new TimerService(timerRepository, completionRepository),
    diaryService: new DiaryService(diaryRepository),
    statisticsService: new StatisticsService(statisticsRepository),
    notificationService: new NotificationService(notificationRepository),
  };
}

export type ApiContainer = Awaited<ReturnType<typeof createApiContainer>>;
