export type StartTimerInput = {
  scheduledPracticeId: string;
  practiceId: string;
  userId: string;
  plannedDurationMinutes: number;
};

export type TimerActionInput = {
  scheduledPracticeId: string;
  timestamp: string;
  seconds?: number;
  minutes?: number;
  reason?: string | null;
};

export type AutoCompleteTimerInput = {
  scheduledPracticeId: string;
  timestamp: string;
};
