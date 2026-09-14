import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_tag_stats')
export class UserTagStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  tag: string;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
