import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '../domain-event/domain-event';

/**
 * Reliable outbound message persisted in the same transaction as domain state.
 */
export class OutboxMessage {
  private constructor(
    private readonly id: string,
    private readonly type: string,
    private readonly payload: Record<string, unknown>,
    private readonly createdAt: Date,
    private publishedAt: Date | null,
  ) {}

  static createFromDomainEvent(event: DomainEvent): OutboxMessage {
    return new OutboxMessage(
      randomUUID(),
      event.type,
      event.toPayload(),
      event.occurredAt,
      null,
    );
  }

  static reconstitute(props: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: Date;
    publishedAt: Date | null;
  }): OutboxMessage {
    return new OutboxMessage(
      props.id,
      props.type,
      { ...props.payload },
      props.createdAt,
      props.publishedAt,
    );
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return this.type;
  }

  getPayload(): Record<string, unknown> {
    return { ...this.payload };
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getPublishedAt(): Date | null {
    return this.publishedAt;
  }

  isPublished(): boolean {
    return this.publishedAt !== null;
  }

  markPublished(at: Date = new Date()): void {
    if (this.publishedAt !== null) {
      return;
    }
    this.publishedAt = at;
  }
}
