import { MockAiProvider } from "../../../packages/ai-adapter/src";
import { applyMigrations, loadInitMigration, openSqliteDatabase, SqliteClientAdapter, SqliteDiaryRepository, SqliteMaterialRepository, SqliteNotificationRepository, SqlitePracticeCompletionRepository, SqlitePracticeRepository, SqliteScheduleRepository, SqliteStatisticsRepository, SqliteTimerRepository } from "../../../packages/database/src";
import { AiService } from "./modules/ai";
import { DiaryService } from "./modules/diary";
import { NotificationService } from "./modules/notifications";
import { PracticeLibraryService } from "./modules/practices";
import { ScheduleService } from "./modules/schedule";
import { ScheduleAiService } from "./modules/schedule";
import { StatisticsService } from "./modules/statistics";
import { TimerService } from "./modules/timer";
export function createApiContainer(databasePath) {
    const database = openSqliteDatabase(databasePath);
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
    const aiService = new AiService(new MockAiProvider());
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
