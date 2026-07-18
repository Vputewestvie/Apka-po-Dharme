export type StatisticsPeriod = "today" | "week" | "month" | "year" | "all";

export type StatisticsQuery = {
  userId: string;
  period: StatisticsPeriod;
};
