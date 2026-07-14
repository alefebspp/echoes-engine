import { EventId } from '../value-objects/event-id';
import { UserId } from '../value-objects/user-id';

export class Event {
  private constructor(
    private readonly id: EventId,
    private readonly userId: UserId,
    private readonly sourceId: string,
    private readonly eventType: string,
    private readonly occurredAt: Date,
    private readonly receivedAt: Date,
    private readonly metadata: Record<string, unknown>,
    private readonly externalEventId: string | null,
    private readonly createdAt: Date,
  ) {}

  static create(props: {
    userId: string;
    sourceId: string;
    eventType: string;
    occurredAt: Date;
    metadata: Record<string, unknown>;
    externalEventId?: string | null;
  }): Event {
    const now = new Date();

    return new Event(
      EventId.generate(),
      UserId.from(props.userId),
      props.sourceId,
      props.eventType,
      props.occurredAt,
      now,
      { ...props.metadata },
      props.externalEventId ?? null,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    sourceId: string;
    eventType: string;
    occurredAt: Date;
    receivedAt: Date;
    metadata: Record<string, unknown>;
    externalEventId: string | null;
    createdAt: Date;
  }): Event {
    return new Event(
      EventId.from(props.id),
      UserId.from(props.userId),
      props.sourceId,
      props.eventType,
      props.occurredAt,
      props.receivedAt,
      { ...props.metadata },
      props.externalEventId,
      props.createdAt,
    );
  }

  getId(): EventId {
    return this.id;
  }

  getUserId(): UserId {
    return this.userId;
  }

  getSourceId(): string {
    return this.sourceId;
  }

  getEventType(): string {
    return this.eventType;
  }

  getOccurredAt(): Date {
    return this.occurredAt;
  }

  getReceivedAt(): Date {
    return this.receivedAt;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  getExternalEventId(): string | null {
    return this.externalEventId;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }
}
