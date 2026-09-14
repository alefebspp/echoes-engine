import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('projection_processed_events')
export class ProjectionProcessedEventOrmEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  kind: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
