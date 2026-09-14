import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_source_stats')
export class UserSourceStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
