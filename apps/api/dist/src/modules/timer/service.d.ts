import { PracticeSession } from "../../../../../packages/domain/src";
import type { PracticeCompletionRepository, TimerRepository } from "../../../../../packages/database/src";
import type { AutoCompleteTimerInput, StartTimerInput, TimerActionInput } from "./dto";
export declare class TimerService {
    private readonly timerRepository;
    private readonly completionRepository;
    constructor(timerRepository: TimerRepository, completionRepository: PracticeCompletionRepository);
    start(input: StartTimerInput): Promise<PracticeSession>;
    pause(input: TimerActionInput): Promise<PracticeSession>;
    resume(input: TimerActionInput): Promise<PracticeSession>;
    addTime(input: TimerActionInput): Promise<PracticeSession>;
    complete(input: TimerActionInput): Promise<PracticeSession>;
    autoComplete(input: AutoCompleteTimerInput): Promise<PracticeSession>;
    skip(input: TimerActionInput): Promise<PracticeSession>;
    private getRequiredSession;
}
//# sourceMappingURL=service.d.ts.map