import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventTag } from '../event-tags/event-tag.entity';
import { EventOrmEntity } from '../infrastructure/typeorm/entities/event.entity';
import { UserSettings } from '../user-settings/user-settings.entity';

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

type DateCountRow = { date: string; count: string };
type TagCountRow = { tag: string; count: string };
type DomainCountRow = { domain: string; count: string };
type BrowserCountRow = { browser: string; count: string };
type SourceCountRow = { sourceCode: string; sourceName: string; count: string };
type HourCountRow = { hour: string; count: string };
type DateRow = { date: string };
type BoundsRow = { firstTrackedAt: Date | null; lastTrackedAt: Date | null };

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly eventsRepository: Repository<EventOrmEntity>,
    @InjectRepository(EventTag)
    private readonly eventTagsRepository: Repository<EventTag>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
  ) {}

  async getStats(userId: string, periodDays = 30): Promise<DashboardStats> {
    const timezone = await this.resolveTimezone(userId);

    const [
      summaryCounts,
      bounds,
      activeDates,
      eventsByDay,
      categoryRows,
      topDomains,
      topBrowsers,
      eventsBySource,
      activityByHour,
    ] = await Promise.all([
      this.fetchSummaryCounts(userId, timezone),
      this.fetchBounds(userId),
      this.fetchActiveDates(userId, timezone),
      this.fetchEventsByDay(userId, timezone, periodDays),
      this.fetchCategoryBreakdown(userId),
      this.fetchTopDomains(userId),
      this.fetchTopBrowsers(userId),
      this.fetchEventsBySource(userId),
      this.fetchActivityByHour(userId, timezone),
    ]);

    const totalEvents = parseInt(summaryCounts.totalEvents, 10);
    const activeDays = activeDates.length;
    const currentStreak = this.computeStreak(activeDates, timezone);
    const categoryBreakdown = this.buildCategoryBreakdown(
      categoryRows,
      totalEvents,
    );

    return {
      timezone,
      periodDays,
      summary: {
        totalEvents,
        eventsToday: parseInt(summaryCounts.eventsToday, 10),
        eventsLast7Days: parseInt(summaryCounts.eventsLast7Days, 10),
        eventsLast30Days: parseInt(summaryCounts.eventsLast30Days, 10),
        activeDays,
        currentStreak,
        untaggedEvents: parseInt(summaryCounts.untaggedEvents, 10),
        firstTrackedAt: bounds.firstTrackedAt?.toISOString() ?? null,
        lastTrackedAt: bounds.lastTrackedAt?.toISOString() ?? null,
        averageEventsPerActiveDay:
          activeDays > 0
            ? Math.round((totalEvents / activeDays) * 100) / 100
            : 0,
      },
      eventsByDay: eventsByDay.map((row) => ({
        date: row.date,
        count: parseInt(row.count, 10),
      })),
      categoryBreakdown,
      topDomains: topDomains.map((row) => ({
        domain: row.domain,
        count: parseInt(row.count, 10),
      })),
      topBrowsers: topBrowsers.map((row) => ({
        browser: row.browser,
        count: parseInt(row.count, 10),
      })),
      eventsBySource: eventsBySource.map((row) => ({
        sourceCode: row.sourceCode,
        sourceName: row.sourceName,
        count: parseInt(row.count, 10),
      })),
      activityByHour: activityByHour.map((row) => ({
        hour: parseInt(row.hour, 10),
        count: parseInt(row.count, 10),
      })),
    };
  }

  private async resolveTimezone(userId: string): Promise<string> {
    const settings = await this.userSettingsRepository.findOneBy({ userId });
    return settings?.timezone ?? 'UTC';
  }

  private async fetchSummaryCounts(
    userId: string,
    timezone: string,
  ): Promise<{
    totalEvents: string;
    eventsToday: string;
    eventsLast7Days: string;
    eventsLast30Days: string;
    untaggedEvents: string;
  }> {
    const [row] = await this.eventsRepository.query(
      `
        SELECT
          COUNT(*)::text AS "totalEvents",
          COUNT(*) FILTER (
            WHERE DATE(e.occurred_at AT TIME ZONE $2)
              = DATE(NOW() AT TIME ZONE $2)
          )::text AS "eventsToday",
          COUNT(*) FILTER (
            WHERE e.occurred_at >= NOW() - INTERVAL '7 days'
          )::text AS "eventsLast7Days",
          COUNT(*) FILTER (
            WHERE e.occurred_at >= NOW() - INTERVAL '30 days'
          )::text AS "eventsLast30Days",
          COUNT(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM event_tags et WHERE et.event_id = e.id
            )
          )::text AS "untaggedEvents"
        FROM events e
        WHERE e.user_id = $1
      `,
      [userId, timezone],
    );

    return (
      row ?? {
        totalEvents: '0',
        eventsToday: '0',
        eventsLast7Days: '0',
        eventsLast30Days: '0',
        untaggedEvents: '0',
      }
    );
  }

  private async fetchBounds(userId: string): Promise<BoundsRow> {
    const [row] = await this.eventsRepository.query(
      `
        SELECT
          MIN(e.occurred_at) AS "firstTrackedAt",
          MAX(e.occurred_at) AS "lastTrackedAt"
        FROM events e
        WHERE e.user_id = $1
      `,
      [userId],
    );

    return row ?? { firstTrackedAt: null, lastTrackedAt: null };
  }

  private async fetchActiveDates(
    userId: string,
    timezone: string,
  ): Promise<string[]> {
    const rows: DateRow[] = await this.eventsRepository.query(
      `
        SELECT DISTINCT DATE(e.occurred_at AT TIME ZONE $2)::text AS date
        FROM events e
        WHERE e.user_id = $1
        ORDER BY date DESC
      `,
      [userId, timezone],
    );

    return rows.map((row) => row.date);
  }

  private async fetchEventsByDay(
    userId: string,
    timezone: string,
    periodDays: number,
  ): Promise<DateCountRow[]> {
    return this.eventsRepository.query(
      `
        SELECT
          DATE(e.occurred_at AT TIME ZONE $2)::text AS date,
          COUNT(*)::text AS count
        FROM events e
        WHERE e.user_id = $1
          AND e.occurred_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY date
        ORDER BY date ASC
      `,
      [userId, timezone, periodDays],
    );
  }

  private async fetchCategoryBreakdown(
    userId: string,
  ): Promise<TagCountRow[]> {
    return this.eventTagsRepository.query(
      `
        SELECT et.tag, COUNT(*)::text AS count
        FROM event_tags et
        INNER JOIN events e ON e.id = et.event_id
        WHERE e.user_id = $1
        GROUP BY et.tag
        ORDER BY count DESC
      `,
      [userId],
    );
  }

  private async fetchTopDomains(userId: string): Promise<DomainCountRow[]> {
    return this.eventsRepository.query(
      `
        SELECT domain, COUNT(*)::text AS count
        FROM (
          SELECT
            lower(
              regexp_replace(
                substring(e.metadata->>'url' FROM '://([^/:]+)'),
                '^www\\.',
                ''
              )
            ) AS domain
          FROM events e
          WHERE e.user_id = $1
            AND e.metadata->>'url' IS NOT NULL
            AND e.metadata->>'url' ~ '^https?://'
        ) AS domains
        WHERE domain IS NOT NULL AND domain <> ''
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
      `,
      [userId],
    );
  }

  private async fetchTopBrowsers(userId: string): Promise<BrowserCountRow[]> {
    return this.eventsRepository.query(
      `
        SELECT e.metadata->>'browser' AS browser, COUNT(*)::text AS count
        FROM events e
        WHERE e.user_id = $1
          AND e.metadata->>'browser' IS NOT NULL
          AND e.metadata->>'browser' <> ''
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 5
      `,
      [userId],
    );
  }

  private async fetchEventsBySource(
    userId: string,
  ): Promise<SourceCountRow[]> {
    return this.eventsRepository.query(
      `
        SELECT
          es.code AS "sourceCode",
          es.name AS "sourceName",
          COUNT(*)::text AS count
        FROM events e
        INNER JOIN event_sources es ON es.id = e.source_id
        WHERE e.user_id = $1
        GROUP BY es.code, es.name
        ORDER BY count DESC
      `,
      [userId],
    );
  }

  private async fetchActivityByHour(
    userId: string,
    timezone: string,
  ): Promise<HourCountRow[]> {
    return this.eventsRepository.query(
      `
        SELECT
          EXTRACT(HOUR FROM e.occurred_at AT TIME ZONE $2)::int::text AS hour,
          COUNT(*)::text AS count
        FROM events e
        WHERE e.user_id = $1
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [userId, timezone],
    );
  }

  private buildCategoryBreakdown(
    rows: TagCountRow[],
    totalEvents: number,
  ): Array<{ tag: string; count: number; percentage: number }> {
    if (totalEvents === 0) {
      return [];
    }

    return rows.map((row) => {
      const count = parseInt(row.count, 10);
      return {
        tag: row.tag,
        count,
        percentage: Math.round((count / totalEvents) * 10000) / 100,
      };
    });
  }

  private computeStreak(activeDates: string[], timezone: string): number {
    if (activeDates.length === 0) {
      return 0;
    }

    const today = this.formatDateInTimezone(new Date(), timezone);
    const yesterday = this.formatDateInTimezone(
      new Date(Date.now() - 86_400_000),
      timezone,
    );

    const mostRecent = activeDates[0];
    if (mostRecent !== today && mostRecent !== yesterday) {
      return 0;
    }

    let streak = 1;
    for (let index = 1; index < activeDates.length; index += 1) {
      const previous = activeDates[index - 1];
      const current = activeDates[index];
      if (this.isPreviousDay(current, previous)) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private isPreviousDay(earlier: string, later: string): boolean {
    const earlierDate = new Date(`${earlier}T00:00:00Z`);
    const laterDate = new Date(`${later}T00:00:00Z`);
    const diffMs = laterDate.getTime() - earlierDate.getTime();
    return diffMs === 86_400_000;
  }
}
