import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { structuredLog } from 'src/common/logging/structured-log';

@Injectable()
export class WeeklyStatsRefreshService {
  private refreshing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(WeeklyStatsRefreshService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshWeeklyStats(): Promise<void> {
    if (
      this.configService.get<string>('WEEKLY_STATS_REFRESH_ENABLED', 'true') ===
      'false'
    ) {
      return;
    }

    if (this.refreshing) {
      this.logger.warn(structuredLog('weekly_stats.refresh.skipped_in_flight'));
      return;
    }

    this.refreshing = true;

    try {
      await this.dataSource.query(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY user_weekly_stats',
      );
      this.logger.log(structuredLog('weekly_stats.refresh.completed'));
    } catch (error) {
      try {
        await this.dataSource.query('REFRESH MATERIALIZED VIEW user_weekly_stats');
        this.logger.log(
          structuredLog('weekly_stats.refresh.completed_non_concurrent'),
        );
      } catch (innerError) {
        this.logger.error(
          structuredLog('weekly_stats.refresh.failed', {
            ...(innerError instanceof Error && {
              errorName: innerError.name,
              errorMessage: innerError.message,
            }),
          }),
          innerError instanceof Error ? innerError.stack : undefined,
        );
      }
    } finally {
      this.refreshing = false;
    }
  }
}
