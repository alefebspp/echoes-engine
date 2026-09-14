import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  IngestProjectionInput,
  ProjectionStore,
  TagProjectionInput,
} from 'src/domain/ports/projection-store';
import { UserSettingsOrmEntity } from './entities/user-settings.entity';

const INGEST_KIND = 'ingest';
const TAG_KIND = 'tags';

@Injectable()
export class TypeOrmProjectionStore implements ProjectionStore {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserSettingsOrmEntity)
    private readonly userSettingsRepository: Repository<UserSettingsOrmEntity>,
  ) {}

  async resolveTimezone(userId: string): Promise<string> {
    const settings = await this.userSettingsRepository.findOneBy({ userId });
    return settings?.timezone ?? 'UTC';
  }

  async applyIngestProjection(
    input: IngestProjectionInput,
  ): Promise<'applied' | 'skipped'> {
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.query(
        `
          INSERT INTO projection_processed_events (event_id, kind)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          RETURNING event_id
        `,
        [input.eventId, INGEST_KIND],
      );

      if (claim.length === 0) {
        return 'skipped';
      }

      await manager.query(
        `
          INSERT INTO user_daily_stats (user_id, date, event_count)
          VALUES ($1, $2, 1)
          ON CONFLICT (user_id, date)
          DO UPDATE SET event_count = user_daily_stats.event_count + 1
        `,
        [input.userId, input.localDate],
      );

      if (input.domain) {
        await manager.query(
          `
            INSERT INTO user_domain_stats (user_id, domain, event_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id, domain)
            DO UPDATE SET event_count = user_domain_stats.event_count + 1
          `,
          [input.userId, input.domain],
        );
      }

      if (input.browser) {
        await manager.query(
          `
            INSERT INTO user_browser_stats (user_id, browser, event_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id, browser)
            DO UPDATE SET event_count = user_browser_stats.event_count + 1
          `,
          [input.userId, input.browser],
        );
      }

      await manager.query(
        `
          INSERT INTO user_source_stats (user_id, source_id, event_count)
          VALUES ($1, $2, 1)
          ON CONFLICT (user_id, source_id)
          DO UPDATE SET event_count = user_source_stats.event_count + 1
        `,
        [input.userId, input.sourceId],
      );

      await manager.query(
        `
          INSERT INTO user_hourly_stats (user_id, hour, event_count)
          VALUES ($1, $2, 1)
          ON CONFLICT (user_id, hour)
          DO UPDATE SET event_count = user_hourly_stats.event_count + 1
        `,
        [input.userId, input.localHour],
      );

      await manager.query(
        `
          INSERT INTO user_event_summary (
            user_id,
            total_events,
            untagged_events,
            first_tracked_at,
            last_tracked_at
          )
          VALUES ($1, 1, 1, $2, $2)
          ON CONFLICT (user_id)
          DO UPDATE SET
            total_events = user_event_summary.total_events + 1,
            untagged_events = user_event_summary.untagged_events + 1,
            first_tracked_at = LEAST(
              user_event_summary.first_tracked_at,
              EXCLUDED.first_tracked_at
            ),
            last_tracked_at = GREATEST(
              user_event_summary.last_tracked_at,
              EXCLUDED.last_tracked_at
            )
        `,
        [input.userId, input.occurredAt.toISOString()],
      );

      return 'applied';
    });
  }

  async applyTagProjection(
    input: TagProjectionInput,
  ): Promise<'applied' | 'skipped'> {
    if (input.tags.length === 0) {
      return 'skipped';
    }

    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.query(
        `
          INSERT INTO projection_processed_events (event_id, kind)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          RETURNING event_id
        `,
        [input.eventId, TAG_KIND],
      );

      if (claim.length === 0) {
        return 'skipped';
      }

      for (const tag of input.tags) {
        await manager.query(
          `
            INSERT INTO user_tag_stats (user_id, tag, event_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id, tag)
            DO UPDATE SET event_count = user_tag_stats.event_count + 1
          `,
          [input.userId, tag],
        );
      }

      await manager.query(
        `
          UPDATE user_event_summary
          SET untagged_events = GREATEST(user_event_summary.untagged_events - 1, 0)
          WHERE user_id = $1
        `,
        [input.userId],
      );

      return 'applied';
    });
  }
}
