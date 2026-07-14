import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventSourceOrmEntity } from './event-source.entity';
import { UserOrmEntity } from './user.entity';

@Entity('events')
@Index('UQ_events_user_id_external_event_id', ['userId', 'externalEventId'], {
  unique: true,
})
export class EventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @ManyToOne(() => EventSourceOrmEntity)
  @JoinColumn({ name: 'source_id' })
  source: EventSourceOrmEntity;

  @Column({ name: 'event_type', length: 100 })
  eventType: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;

  @Column({
    name: 'external_event_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalEventId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
