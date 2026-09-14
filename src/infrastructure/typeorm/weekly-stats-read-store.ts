import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  WeeklyStatsReadStore,
  WeeklyStatsSnapshot,
} from 'src/domain/ports/weekly-stats-read-store';

type WeeklyRow = { weekStart: string; eventCount: string };

@Injectable()
export class TypeOrmWeeklyStatsReadStore implements WeeklyStatsReadStore {
  constructor(private readonly dataSource: DataSource) {}

  async getWeeklyStats(userId: string): Promise<WeeklyStatsSnapshot> {
    let rows: WeeklyRow[] = [];

    try {
      rows = await this.dataSource.query(
        `
          SELECT
            week_start::text AS "weekStart",
            event_count::text AS "eventCount"
          FROM user_weekly_stats
          WHERE user_id = $1
          ORDER BY week_start DESC
          LIMIT 52
        `,
        [userId],
      );
    } catch {
      rows = await this.dataSource.query(
        `
          SELECT
            date_trunc('week', occurred_at AT TIME ZONE 'UTC')::date::text AS "weekStart",
            COUNT(*)::text AS "eventCount"
          FROM events
          WHERE user_id = $1
          GROUP BY date_trunc('week', occurred_at AT TIME ZONE 'UTC')::date
          ORDER BY "weekStart" DESC
          LIMIT 52
        `,
        [userId],
      );
    }

    return {
      weeks: rows.map((row) => ({
        weekStart: row.weekStart,
        eventCount: parseInt(row.eventCount, 10),
      })),
      generatedAt: new Date().toISOString(),
      refreshNote:
        'Weekly rollups refresh on a schedule (default: hourly). Data may lag by up to one refresh interval.',
    };
  }
}
