import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_hourly_stats')
export class UserHourlyStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'smallint' })
  hour: number;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
