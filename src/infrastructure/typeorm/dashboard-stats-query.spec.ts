import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';
import { UserSettingsOrmEntity } from './entities/user-settings.entity';
import { TypeOrmDashboardStatsQuery } from './dashboard-stats-query';

describe('TypeOrmDashboardStatsQuery', () => {
  let query: TypeOrmDashboardStatsQuery;
  let eventsRepository: jest.Mocked<Pick<Repository<EventOrmEntity>, 'query'>>;
  let eventTagsRepository: jest.Mocked<
    Pick<Repository<EventTagOrmEntity>, 'query'>
  >;
  let userSettingsRepository: jest.Mocked<
    Pick<Repository<UserSettingsOrmEntity>, 'findOneBy'>
  >;

  const userId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    eventsRepository = { query: jest.fn() };
    eventTagsRepository = { query: jest.fn() };
    userSettingsRepository = { findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypeOrmDashboardStatsQuery,
        {
          provide: getRepositoryToken(EventOrmEntity),
          useValue: eventsRepository,
        },
        {
          provide: getRepositoryToken(EventTagOrmEntity),
          useValue: eventTagsRepository,
        },
        {
          provide: getRepositoryToken(UserSettingsOrmEntity),
          useValue: userSettingsRepository,
        },
      ],
    }).compile();

    query = module.get(TypeOrmDashboardStatsQuery);
    jest.clearAllMocks();
  });

  it('returns aggregated dashboard stats for a user', async () => {
    userSettingsRepository.findOneBy.mockResolvedValue({
      userId,
      timezone: 'UTC',
      trackingEnabled: true,
      user: {} as UserSettingsOrmEntity['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    eventsRepository.query.mockImplementation(async (sql: string) => {
      if (sql.includes('"totalEvents"')) {
        return [
          {
            totalEvents: '12',
            eventsToday: '2',
            eventsLast7Days: '8',
            eventsLast30Days: '12',
            untaggedEvents: '1',
          },
        ];
      }
      if (sql.includes('"firstTrackedAt"')) {
        return [
          {
            firstTrackedAt: new Date('2026-06-01T10:00:00.000Z'),
            lastTrackedAt: new Date('2026-06-12T15:30:00.000Z'),
          },
        ];
      }
      if (sql.includes('DISTINCT DATE')) {
        return [{ date: '2026-06-12' }, { date: '2026-06-11' }];
      }
      if (sql.includes('GROUP BY date')) {
        return [
          { date: '2026-06-11', count: '5' },
          { date: '2026-06-12', count: '7' },
        ];
      }
      if (sql.includes('AS domain')) {
        return [{ domain: 'kafka.apache.org', count: '4' }];
      }
      if (sql.includes("metadata->>'browser'")) {
        return [{ browser: 'chrome', count: '12' }];
      }
      if (sql.includes('"sourceCode"')) {
        return [
          {
            sourceCode: 'browser_extension',
            sourceName: 'Browser Extension',
            count: '12',
          },
        ];
      }
      if (sql.includes('EXTRACT(HOUR')) {
        return [
          { hour: '9', count: '3' },
          { hour: '15', count: '9' },
        ];
      }
      return [];
    });

    eventTagsRepository.query.mockResolvedValue([
      { tag: 'developer tools', count: '8' },
      { tag: 'search', count: '3' },
    ]);

    const stats = await query.getStats(userId, 30);

    expect(stats.timezone).toBe('UTC');
    expect(stats.periodDays).toBe(30);
    expect(stats.summary).toMatchObject({
      totalEvents: 12,
      eventsToday: 2,
      eventsLast7Days: 8,
      eventsLast30Days: 12,
      activeDays: 2,
      untaggedEvents: 1,
      averageEventsPerActiveDay: 6,
    });
    expect(stats.eventsByDay).toEqual([
      { date: '2026-06-11', count: 5 },
      { date: '2026-06-12', count: 7 },
    ]);
    expect(stats.categoryBreakdown[0]).toMatchObject({
      tag: 'developer tools',
      count: 8,
      percentage: 66.67,
    });
    expect(stats.topDomains).toEqual([
      { domain: 'kafka.apache.org', count: 4 },
    ]);
    expect(stats.topBrowsers).toEqual([{ browser: 'chrome', count: 12 }]);
    expect(stats.eventsBySource).toEqual([
      {
        sourceCode: 'browser_extension',
        sourceName: 'Browser Extension',
        count: 12,
      },
    ]);
    expect(stats.activityByHour).toEqual([
      { hour: 9, count: 3 },
      { hour: 15, count: 9 },
    ]);
  });

  it('defaults timezone to UTC when user settings are missing', async () => {
    userSettingsRepository.findOneBy.mockResolvedValue(null);
    eventsRepository.query.mockResolvedValue([]);
    eventTagsRepository.query.mockResolvedValue([]);

    const stats = await query.getStats(userId);

    expect(stats.timezone).toBe('UTC');
    expect(stats.summary.totalEvents).toBe(0);
    expect(stats.summary.currentStreak).toBe(0);
  });
});
