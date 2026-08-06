import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('outbox_messages')
@Index('IDX_outbox_messages_unpublished', ['createdAt'], {
  where: '"published_at" IS NULL',
})
export class OutboxMessageOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 100 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
