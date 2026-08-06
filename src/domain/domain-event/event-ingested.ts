import type { DomainEvent } from './domain-event';

export type EventIngestedPayload = {
  eventId: string;
  userId: string;
  eventType: string;
  correlationId: string | null;
};

/**
 * Raised after an Event aggregate is accepted for persistence.
 * Enrichment (tagging, later embeddings/graph) reacts asynchronously.
 */
export class EventIngested implements DomainEvent {
  static readonly TYPE = 'EventIngested';

  readonly type = EventIngested.TYPE;
  readonly occurredAt: Date;

  constructor(
    readonly eventId: string,
    readonly userId: string,
    readonly eventType: string,
    readonly correlationId: string | null = null,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }

  static fromPayload(payload: EventIngestedPayload): EventIngested {
    return new EventIngested(
      payload.eventId,
      payload.userId,
      payload.eventType,
      payload.correlationId ?? null,
    );
  }

  toPayload(): EventIngestedPayload {
    return {
      eventId: this.eventId,
      userId: this.userId,
      eventType: this.eventType,
      correlationId: this.correlationId,
    };
  }
}
