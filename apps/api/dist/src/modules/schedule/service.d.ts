import { Schedule } from "../../../../../packages/domain/src";
import type { PracticeRepository, ScheduleRepository } from "../../../../../packages/database/src";
import type { ChangeScheduledPracticeTimeInput, CreateScheduleInput, RemoveScheduledPracticeInput, RepeatYesterdayInput, SchedulePracticeInput } from "./dto";
export declare class ScheduleService {
    private readonly scheduleRepository;
    private readonly practiceRepository;
    constructor(scheduleRepository: ScheduleRepository, practiceRepository: PracticeRepository);
    getByDate(userId: string, date: string): Promise<Schedule | null>;
    create(input: CreateScheduleInput): Promise<Schedule>;
    repeatYesterday(input: RepeatYesterdayInput): Promise<Schedule>;
    replacePractices(userId: string, date: string, practices: SchedulePracticeInput[], title: string): Promise<Schedule>;
    removePractice(input: RemoveScheduledPracticeInput): Promise<Schedule>;
    changeTime(input: ChangeScheduledPracticeTimeInput): Promise<Schedule>;
}
//# sourceMappingURL=service.d.ts.map