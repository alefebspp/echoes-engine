export type DashboardSummary = {
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
};

export type DashboardStats = {
  timezone: string;
  periodDays: number;
  summary: DashboardSummary;
  eventsByDay: Array<{ date: string; count: number }>;
  categoryBreakdown: Array<{ tag: string; count: number; percentage: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  topBrowsers: Array<{ browser: string; count: number }>;
  eventsBySource: Array<{
    sourceCode: string;
    sourceName: string;
    count: number;
  }>;
  activityByHour: Array<{ hour: number; count: number }>;
};

export interface DashboardStatsQuery {
  getStats(userId: string, periodDays: number): Promise<DashboardStats>;
}
