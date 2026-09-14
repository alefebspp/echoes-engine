import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DailyStatsReadStore, DailyStatsSnapshot } from 'src/domain/ports/daily-stats-read-store';
import { computeStreak, formatDateInTimezone } from 'src/infrastructure/common/event-cursor';
import { UserDailyStatsOrmEntity } from './entities/user-daily-stats.entity';
import { UserEventSummaryOrmEntity } from './entities/user-event-summary.entity';
import { UserHourlyStatsOrmEntity } from './entities/user-hourly-stats.entity';
import { UserSettingsOrmEntity } from './entities/user-settings.entity';

type DateCountRow = { date: string; eventCount: number };
type HourCountRow = { hour: number; eventCount: number };

@Injectable()
export class TypeOrmDailyStatsReadStore implements DailyStatsReadStore {
  constructor(
    @InjectRepository(UserDailyStatsOrmEntity)
    private readonly dailyStatsRepository: Repository<UserDailyStatsOrmEntity>,
    @InjectRepository(UserEventSummaryOrmEntity)
    private readonly summaryRepository: Repository<UserEventSummaryOrmEntity>,
    @InjectRepository(UserHourlyStatsOrmEntity)
    private readonly hourlyStatsRepository: Repository<UserHourlyStatsOrmEntity>,
    @InjectRepository(UserSettingsOrmEntity)
    private readonly userSettingsRepository: Repository<UserSettingsOrmEntity>,
  ) {}

  async getDailyStats(
    userId: string,
    timezone: string,
    periodDays: number,
  ): Promise<DailyStatsSnapshot> {
    const resolvedTimezone =
      timezone ||
      (await this.userSettingsRepository.findOneBy({ userId }))?.timezone ||
      'UTC';

    const summary = await this.summaryRepository.findOneBy({ userId });
    const today = formatDateInTimezone(new Date(), resolvedTimezone);

    const dailyRows = await this.dailyStatsRepository.find({
      where: { userId },
      order: { date: 'DESC' },
    });

    const eventsToday =
      dailyRows.find((row) => row.date === today)?.eventCount ?? 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const eventsLast7Days = this.sumSince(dailyRows, sevenDaysAgo, resolvedTimezone);
    const eventsLast30Days = this.sumSince(
      dailyRows,
      thirtyDaysAgo,
      resolvedTimezone,
    );

    const periodStart = new Date(Date.now() - periodDays * 86_400_000);
    const eventsByDay = dailyRows
      .filter((row) => this.toDate(row.date) >= periodStart)
      .map((row) => ({ date: row.date, eventCount: row.eventCount }))
      .sort((left, right) => left.date.localeCompare(right.date));

    const activeDates = dailyRows
      .filter((row) => row.eventCount > 0)
      .map((row) => row.date);

    const hourlyRows: HourCountRow[] = await this.hourlyStatsRepository.find({
      where: { userId },
      order: { hour: 'ASC' },
    });

    const totalEvents = summary?.totalEvents ?? 0;
    const activeDays = activeDates.length;

    return {
      totalEvents,
      eventsToday,
      eventsLast7Days,
      eventsLast30Days,
      activeDays,
      currentStreak: computeStreak(activeDates, resolvedTimezone),
      untaggedEvents: summary?.untaggedEvents ?? 0,
      firstTrackedAt: summary?.firstTrackedAt?.toISOString() ?? null,
      lastTrackedAt: summary?.lastTrackedAt?.toISOString() ?? null,
      averageEventsPerActiveDay:
        activeDays > 0
          ? Math.round((totalEvents / activeDays) * 100) / 100
          : 0,
      eventsByDay,
      activityByHour: hourlyRows.map((row) => ({
        hour: row.hour,
        count: row.eventCount,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private sumSince(
    rows: DateCountRow[],
    since: Date,
    timezone: string,
  ): number {
    return rows
      .filter((row) => this.toDate(row.date) >= since)
      .reduce((total, row) => total + row.eventCount, 0);
  }

  private toDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
  }
}
