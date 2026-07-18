import { handleRequest } from "./server";
export declare function createApp(databasePath?: string): {
    handleRequest: typeof handleRequest;
    container: {
        aiService: import("./modules/ai").AiService;
        practiceLibraryService: import("./modules/practices").PracticeLibraryService;
        scheduleService: import("./modules/schedule").ScheduleService;
        scheduleAiService: import("./modules/schedule").ScheduleAiService;
        timerService: import("./modules/timer").TimerService;
        diaryService: import("./modules/diary").DiaryService;
        statisticsService: import("./modules/statistics").StatisticsService;
        notificationService: import("./modules/notifications").NotificationService;
    };
};
//# sourceMappingURL=main.d.ts.map