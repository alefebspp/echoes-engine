export type WeeklyStatsRow = {
  weekStart: string;
  eventCount: number;
};

export type WeeklyStatsSnapshot = {
  weeks: WeeklyStatsRow[];
  generatedAt: string;
  refreshNote: string;
};

export interface WeeklyStatsReadStore {
  getWeeklyStats(userId: string): Promise<WeeklyStatsSnapshot>;
}
