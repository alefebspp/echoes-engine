import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventOrmEntity } from './event.entity';

@Entity('event_tags')
export class EventTagOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => EventOrmEntity, (event) => event.tags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: EventOrmEntity;

  @Column({ length: 100 })
  tag: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
