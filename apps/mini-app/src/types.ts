export type MiniAppScreen =
  | "today"
  | "library"
  | "schedule"
  | "diary"
  | "statistics"
  | "settings";

export type PracticeImage = {
  kind: "builtin" | "user";
  ref: string;
};

export type PracticeDto = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  defaultDurationMinutes: number;
  color: string;
  icon: string;
  image: PracticeImage;
  source: string;
  notes: string;
  archived: boolean;
};

export type ScheduledPracticeDto = {
  id: string;
  practiceId: string;
  plannedDate: string;
  plannedStartTime: string | null;
  plannedDurationMinutes: number;
  order: number;
  status: string;
};

export type ScheduleDto = {
  id: string;
  userId: string;
  date: string;
  source: string;
  title: string;
  items: ScheduledPracticeDto[];
} | null;

export type DiaryEntryDto = {
  id: string;
  userId: string;
  practiceId: string;
  scheduledPracticeId: string;
  kind: "text" | "voice";
  createdAt: string;
  updatedAt: string;
  text: string;
  voiceFileId: string | null;
  transcription: string | null;
};

export type StatisticsDto = {
  period: "today" | "week" | "month" | "year" | "all";
  totalMinutes: number;
  totalHours: number;
  completedCount: number;
  skippedCount: number;
  movedCount: number;
  completionPercent: number;
  streakDays: number;
  favoritePracticeIds: string[];
} | null;

export type DashboardData = {
  userId: string;
  date: string;
  source: "api" | "fallback";
  practices: PracticeDto[];
  schedule: ScheduleDto;
  diary: DiaryEntryDto[];
  statistics: StatisticsDto;
};
