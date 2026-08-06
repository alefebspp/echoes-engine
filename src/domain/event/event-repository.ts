import { Event } from './event';
import type { OutboxMessage } from '../outbox/outbox-message';

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  findByUserIdAndExternalEventId(
    userId: string,
    externalEventId: string,
  ): Promise<Event | null>;
  /**
   * Persists the event and optional outbox messages in one transaction.
   */
  create(event: Event, outboxMessages?: OutboxMessage[]): Promise<Event>;
  /**
   * Persists tags assigned on the aggregate and marks tags as assigned.
   * Idempotent when tags were already assigned.
   */
  persistAssignedTags(event: Event): Promise<Event>;
}
