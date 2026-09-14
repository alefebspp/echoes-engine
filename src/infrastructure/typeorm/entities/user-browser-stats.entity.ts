import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_browser_stats')
export class UserBrowserStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  browser: string;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
