import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetDashboardStatsUseCase } from 'src/application/dashboard/get-dashboard-stats-use-case';
import type { DashboardStatsQuery } from 'src/domain/ports/dashboard-stats-query';
import { DASHBOARD_STATS_QUERY } from 'src/infrastructure/nest/injection-tokens';
import { TypeOrmDashboardStatsQuery } from 'src/infrastructure/typeorm/dashboard-stats-query';
import { EventOrmEntity } from 'src/infrastructure/typeorm/entities/event.entity';
import { EventTagOrmEntity } from 'src/infrastructure/typeorm/entities/event-tag.entity';
import { UserSettingsOrmEntity } from 'src/infrastructure/typeorm/entities/user-settings.entity';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      EventTagOrmEntity,
      UserSettingsOrmEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    {
      provide: DASHBOARD_STATS_QUERY,
      useClass: TypeOrmDashboardStatsQuery,
    },
    {
      provide: GetDashboardStatsUseCase,
      useFactory: (dashboardStatsQuery: DashboardStatsQuery) =>
        new GetDashboardStatsUseCase(dashboardStatsQuery),
      inject: [DASHBOARD_STATS_QUERY],
    },
  ],
})
export class DashboardModule {}
