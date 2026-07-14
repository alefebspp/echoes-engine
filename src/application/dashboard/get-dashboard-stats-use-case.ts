import type {
  DashboardStats,
  DashboardStatsQuery,
} from 'src/domain/ports/dashboard-stats-query';

export class GetDashboardStatsUseCase {
  constructor(private readonly dashboardStatsQuery: DashboardStatsQuery) {}

  execute(userId: string, periodDays = 30): Promise<DashboardStats> {
    return this.dashboardStatsQuery.getStats(userId, periodDays);
  }
}
