import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_domain_stats')
export class UserDomainStatsOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount: number;
}
