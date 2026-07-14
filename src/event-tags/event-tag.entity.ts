import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventOrmEntity } from '../infrastructure/typeorm/entities/event.entity';

@Entity('event_tags')
export class EventTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => EventOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventOrmEntity;

  @Column({ length: 100 })
  tag: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
