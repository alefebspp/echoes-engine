import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_event_summary')
export class UserEventSummaryOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'total_events', type: 'int', default: 0 })
  totalEvents: number;

  @Column({ name: 'untagged_events', type: 'int', default: 0 })
  untaggedEvents: number;

  @Column({ name: 'first_tracked_at', type: 'timestamptz', nullable: true })
  firstTrackedAt: Date | null;

  @Column({ name: 'last_tracked_at', type: 'timestamptz', nullable: true })
  lastTrackedAt: Date | null;
}
