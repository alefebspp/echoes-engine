import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RollupStatsReadStore,
  RollupStatsSnapshot,
} from 'src/domain/ports/rollup-stats-read-store';
import { UserBrowserStatsOrmEntity } from './entities/user-browser-stats.entity';
import { UserDomainStatsOrmEntity } from './entities/user-domain-stats.entity';

type SourceCountRow = {
  sourceCode: string;
  sourceName: string;
  count: string;
};

@Injectable()
export class TypeOrmRollupStatsReadStore implements RollupStatsReadStore {
  constructor(
    @InjectRepository(UserDomainStatsOrmEntity)
    private readonly domainStatsRepository: Repository<UserDomainStatsOrmEntity>,
    @InjectRepository(UserBrowserStatsOrmEntity)
    private readonly browserStatsRepository: Repository<UserBrowserStatsOrmEntity>,
  ) {}

  async getRollupStats(userId: string): Promise<RollupStatsSnapshot> {
    const [topDomains, topBrowsers, eventsBySource] = await Promise.all([
      this.domainStatsRepository.find({
        where: { userId },
        order: { eventCount: 'DESC' },
        take: 10,
      }),
      this.browserStatsRepository.find({
        where: { userId },
        order: { eventCount: 'DESC' },
        take: 5,
      }),
      this.fetchEventsBySource(userId),
    ]);

    return {
      topDomains: topDomains.map((row) => ({
        domain: row.domain,
        count: row.eventCount,
      })),
      topBrowsers: topBrowsers.map((row) => ({
        browser: row.browser,
        count: row.eventCount,
      })),
      eventsBySource,
    };
  }

  private async fetchEventsBySource(
    userId: string,
  ): Promise<RollupStatsSnapshot['eventsBySource']> {
    const rows: SourceCountRow[] = await this.domainStatsRepository.query(
      `
        SELECT
          es.code AS "sourceCode",
          es.name AS "sourceName",
          uss.event_count::text AS count
        FROM user_source_stats uss
        INNER JOIN event_sources es ON es.id = uss.source_id
        WHERE uss.user_id = $1
        ORDER BY uss.event_count DESC
      `,
      [userId],
    );

    return rows.map((row) => ({
      sourceCode: row.sourceCode,
      sourceName: row.sourceName,
      count: parseInt(row.count, 10),
    }));
  }
}
