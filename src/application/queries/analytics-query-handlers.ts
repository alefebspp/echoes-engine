import type { DailyStatsReadStore } from 'src/domain/ports/daily-stats-read-store';
import type { DashboardStats } from 'src/domain/ports/dashboard-stats-query';
import type { ProjectionStore } from 'src/domain/ports/projection-store';
import type { RollupStatsReadStore } from 'src/domain/ports/rollup-stats-read-store';
import type { TagStatsReadStore } from 'src/domain/ports/tag-stats-read-store';

export class GetDailyStatsQueryHandler {
  constructor(
    private readonly dailyStatsReadStore: DailyStatsReadStore,
    private readonly projectionStore: ProjectionStore,
  ) {}

  async execute(userId: string, periodDays = 30) {
    const timezone = await this.projectionStore.resolveTimezone(userId);
    return this.dailyStatsReadStore.getDailyStats(
      userId,
      timezone,
      periodDays,
    );
  }
}

export class GetTagStatsQueryHandler {
  constructor(
    private readonly tagStatsReadStore: TagStatsReadStore,
    private readonly dailyStatsReadStore: DailyStatsReadStore,
    private readonly projectionStore: ProjectionStore,
  ) {}

  async execute(userId: string) {
    const timezone = await this.projectionStore.resolveTimezone(userId);
    const daily = await this.dailyStatsReadStore.getDailyStats(
      userId,
      timezone,
      30,
    );
    return this.tagStatsReadStore.getTagStats(userId, daily.totalEvents);
  }
}

export class GetDashboardQueryHandler {
  constructor(
    private readonly dailyStatsReadStore: DailyStatsReadStore,
    private readonly tagStatsReadStore: TagStatsReadStore,
    private readonly rollupStatsReadStore: RollupStatsReadStore,
    private readonly projectionStore: ProjectionStore,
  ) {}

  async execute(userId: string, periodDays = 30): Promise<DashboardStats> {
    const timezone = await this.projectionStore.resolveTimezone(userId);

    const [daily, rollups] = await Promise.all([
      this.dailyStatsReadStore.getDailyStats(userId, timezone, periodDays),
      this.rollupStatsReadStore.getRollupStats(userId),
    ]);

    const tags = await this.tagStatsReadStore.getTagStats(
      userId,
      daily.totalEvents,
    );

    return {
      timezone,
      periodDays,
      generatedAt: daily.generatedAt,
      consistency: {
        note: 'Analytics aggregates are eventually consistent with ingest. After POST /events, stats usually update within a few seconds once async handlers run. Tag breakdowns may lag until enrichment completes.',
      },
      summary: {
        totalEvents: daily.totalEvents,
        eventsToday: daily.eventsToday,
        eventsLast7Days: daily.eventsLast7Days,
        eventsLast30Days: daily.eventsLast30Days,
        activeDays: daily.activeDays,
        currentStreak: daily.currentStreak,
        untaggedEvents: daily.untaggedEvents,
        firstTrackedAt: daily.firstTrackedAt,
        lastTrackedAt: daily.lastTrackedAt,
        averageEventsPerActiveDay: daily.averageEventsPerActiveDay,
      },
      eventsByDay: daily.eventsByDay.map((row) => ({
        date: row.date,
        count: row.eventCount,
      })),
      categoryBreakdown: tags.categoryBreakdown,
      topDomains: rollups.topDomains,
      topBrowsers: rollups.topBrowsers,
      eventsBySource: rollups.eventsBySource,
      activityByHour: daily.activityByHour,
    };
  }
}
