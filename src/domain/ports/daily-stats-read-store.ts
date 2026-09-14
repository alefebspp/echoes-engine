export type DailyStatsRow = {
  date: string;
  eventCount: number;
};

export type DailyStatsSnapshot = {
  totalEvents: number;
  eventsToday: number;
  eventsLast7Days: number;
  eventsLast30Days: number;
  activeDays: number;
  currentStreak: number;
  untaggedEvents: number;
  firstTrackedAt: string | null;
  lastTrackedAt: string | null;
  averageEventsPerActiveDay: number;
  eventsByDay: DailyStatsRow[];
  activityByHour: Array<{ hour: number; count: number }>;
  generatedAt: string;
};

export interface DailyStatsReadStore {
  getDailyStats(
    userId: string,
    timezone: string,
    periodDays: number,
  ): Promise<DailyStatsSnapshot>;
}
