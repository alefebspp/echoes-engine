import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GetDailyStatsQueryHandler,
  GetDashboardQueryHandler,
  GetTagStatsQueryHandler,
} from 'src/application/queries/analytics-query-handlers';
import { GetWeeklyStatsQueryHandler } from 'src/application/queries/get-weekly-stats-query-handler';
import { ListEventsQueryHandler } from 'src/application/queries/list-events-query-handler';
import type { DailyStatsReadStore } from 'src/domain/ports/daily-stats-read-store';
import type { EventsListReadStore } from 'src/domain/ports/events-list-read-store';
import type { ProjectionStore } from 'src/domain/ports/projection-store';
import type { RollupStatsReadStore } from 'src/domain/ports/rollup-stats-read-store';
import type { TagStatsReadStore } from 'src/domain/ports/tag-stats-read-store';
import type { WeeklyStatsReadStore } from 'src/domain/ports/weekly-stats-read-store';
import {
  DAILY_STATS_READ_STORE,
  EVENTS_LIST_READ_STORE,
  PROJECTION_STORE,
  ROLLUP_STATS_READ_STORE,
  TAG_STATS_READ_STORE,
  WEEKLY_STATS_READ_STORE,
} from 'src/infrastructure/nest/injection-tokens';
import { UserBrowserStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-browser-stats.entity';
import { UserDailyStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-daily-stats.entity';
import { UserDomainStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-domain-stats.entity';
import { UserEventSummaryOrmEntity } from 'src/infrastructure/typeorm/entities/user-event-summary.entity';
import { UserHourlyStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-hourly-stats.entity';
import { UserSourceStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-source-stats.entity';
import { UserTagStatsOrmEntity } from 'src/infrastructure/typeorm/entities/user-tag-stats.entity';
import { UserSettingsOrmEntity } from 'src/infrastructure/typeorm/entities/user-settings.entity';
import { ProjectionProcessedEventOrmEntity } from 'src/infrastructure/typeorm/entities/projection-processed-event.entity';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { TypeOrmDailyStatsReadStore } from 'src/infrastructure/typeorm/daily-stats-read-store';
import { TypeOrmEventsListReadStore } from 'src/infrastructure/typeorm/events-list-read-store';
import { TypeOrmProjectionStore } from 'src/infrastructure/typeorm/projection-store';
import { TypeOrmRollupStatsReadStore } from 'src/infrastructure/typeorm/rollup-stats-read-store';
import { TypeOrmTagStatsReadStore } from 'src/infrastructure/typeorm/tag-stats-read-store';
import { TypeOrmWeeklyStatsReadStore } from 'src/infrastructure/typeorm/weekly-stats-read-store';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      UserDailyStatsOrmEntity,
      UserTagStatsOrmEntity,
      UserDomainStatsOrmEntity,
      UserBrowserStatsOrmEntity,
      UserSourceStatsOrmEntity,
      UserHourlyStatsOrmEntity,
      UserEventSummaryOrmEntity,
      UserSettingsOrmEntity,
      ProjectionProcessedEventOrmEntity,
    ]),
  ],
  providers: [
    TypeOrmProjectionStore,
    TypeOrmEventsListReadStore,
    TypeOrmDailyStatsReadStore,
    TypeOrmTagStatsReadStore,
    TypeOrmRollupStatsReadStore,
    TypeOrmWeeklyStatsReadStore,
    {
      provide: PROJECTION_STORE,
      useExisting: TypeOrmProjectionStore,
    },
    {
      provide: EVENTS_LIST_READ_STORE,
      useExisting: TypeOrmEventsListReadStore,
    },
    {
      provide: DAILY_STATS_READ_STORE,
      useExisting: TypeOrmDailyStatsReadStore,
    },
    {
      provide: TAG_STATS_READ_STORE,
      useExisting: TypeOrmTagStatsReadStore,
    },
    {
      provide: ROLLUP_STATS_READ_STORE,
      useExisting: TypeOrmRollupStatsReadStore,
    },
    {
      provide: WEEKLY_STATS_READ_STORE,
      useExisting: TypeOrmWeeklyStatsReadStore,
    },
    {
      provide: ListEventsQueryHandler,
      useFactory: (eventsListReadStore: EventsListReadStore) =>
        new ListEventsQueryHandler(eventsListReadStore),
      inject: [EVENTS_LIST_READ_STORE],
    },
    {
      provide: GetDailyStatsQueryHandler,
      useFactory: (
        dailyStatsReadStore: DailyStatsReadStore,
        projectionStore: ProjectionStore,
      ) => new GetDailyStatsQueryHandler(dailyStatsReadStore, projectionStore),
      inject: [DAILY_STATS_READ_STORE, PROJECTION_STORE],
    },
    {
      provide: GetTagStatsQueryHandler,
      useFactory: (
        tagStatsReadStore: TagStatsReadStore,
        dailyStatsReadStore: DailyStatsReadStore,
        projectionStore: ProjectionStore,
      ) =>
        new GetTagStatsQueryHandler(
          tagStatsReadStore,
          dailyStatsReadStore,
          projectionStore,
        ),
      inject: [TAG_STATS_READ_STORE, DAILY_STATS_READ_STORE, PROJECTION_STORE],
    },
    {
      provide: GetDashboardQueryHandler,
      useFactory: (
        dailyStatsReadStore: DailyStatsReadStore,
        tagStatsReadStore: TagStatsReadStore,
        rollupStatsReadStore: RollupStatsReadStore,
        projectionStore: ProjectionStore,
      ) =>
        new GetDashboardQueryHandler(
          dailyStatsReadStore,
          tagStatsReadStore,
          rollupStatsReadStore,
          projectionStore,
        ),
      inject: [
        DAILY_STATS_READ_STORE,
        TAG_STATS_READ_STORE,
        ROLLUP_STATS_READ_STORE,
        PROJECTION_STORE,
      ],
    },
    {
      provide: GetWeeklyStatsQueryHandler,
      useFactory: (weeklyStatsReadStore: WeeklyStatsReadStore) =>
        new GetWeeklyStatsQueryHandler(weeklyStatsReadStore),
      inject: [WEEKLY_STATS_READ_STORE],
    },
  ],
  exports: [
    ListEventsQueryHandler,
    GetDailyStatsQueryHandler,
    GetTagStatsQueryHandler,
    GetDashboardQueryHandler,
    GetWeeklyStatsQueryHandler,
    PROJECTION_STORE,
  ],
})
export class ReadModelsModule {}
