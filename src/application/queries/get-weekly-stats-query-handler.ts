import type { WeeklyStatsReadStore } from 'src/domain/ports/weekly-stats-read-store';

export class GetWeeklyStatsQueryHandler {
  constructor(private readonly weeklyStatsReadStore: WeeklyStatsReadStore) {}

  execute(userId: string) {
    return this.weeklyStatsReadStore.getWeeklyStats(userId);
  }
}
