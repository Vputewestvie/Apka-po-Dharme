import { AiService } from "./modules/ai";
import { DiaryService } from "./modules/diary";
import { NotificationService } from "./modules/notifications";
import { PracticeLibraryService } from "./modules/practices";
import { ScheduleService } from "./modules/schedule";
import { ScheduleAiService } from "./modules/schedule";
import { StatisticsService } from "./modules/statistics";
import { TimerService } from "./modules/timer";
export declare function createApiContainer(databasePath: string): {
    aiService: AiService;
    practiceLibraryService: PracticeLibraryService;
    scheduleService: ScheduleService;
    scheduleAiService: ScheduleAiService;
    timerService: TimerService;
    diaryService: DiaryService;
    statisticsService: StatisticsService;
    notificationService: NotificationService;
};
//# sourceMappingURL=container.d.ts.map