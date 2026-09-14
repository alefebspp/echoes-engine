import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TagStatsReadStore, TagStatsSnapshot } from 'src/domain/ports/tag-stats-read-store';
import { UserTagStatsOrmEntity } from './entities/user-tag-stats.entity';

@Injectable()
export class TypeOrmTagStatsReadStore implements TagStatsReadStore {
  constructor(
    @InjectRepository(UserTagStatsOrmEntity)
    private readonly tagStatsRepository: Repository<UserTagStatsOrmEntity>,
  ) {}

  async getTagStats(
    userId: string,
    totalEvents: number,
  ): Promise<TagStatsSnapshot> {
    const rows = await this.tagStatsRepository.find({
      where: { userId },
      order: { eventCount: 'DESC' },
    });

    const categoryBreakdown =
      totalEvents === 0
        ? []
        : rows.map((row) => ({
            tag: row.tag,
            count: row.eventCount,
            percentage:
              Math.round((row.eventCount / totalEvents) * 10000) / 100,
          }));

    return {
      categoryBreakdown,
      generatedAt: new Date().toISOString(),
    };
  }
}
