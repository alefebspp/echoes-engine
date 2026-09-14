import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_daily_stats')
export class UserDailyStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
