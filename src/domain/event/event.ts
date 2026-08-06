import { EventTag } from '../event-tag/event-tag';
import { EventId } from '../value-objects/event-id';
import { EventType } from '../value-objects/event-type';
import { UserId } from '../value-objects/user-id';

export class Event {
  private tags: EventTag[] = [];
  private tagsDefined = false;

  private constructor(
    private readonly id: EventId,
    private readonly userId: UserId,
    private readonly sourceId: string,
    private eventType: EventType,
    private readonly occurredAt: Date,
    private readonly receivedAt: Date,
    private readonly metadata: Record<string, unknown>,
    private readonly externalEventId: string | null,
    private readonly createdAt: Date,
    tags: EventTag[] | undefined,
    tagsAssigned: boolean,
  ) {
    this.tags = tags ? [...tags] : [];
    this.tagsDefined = tagsAssigned;
  }

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
      EventType.create(props.eventType),
      props.occurredAt,
      now,
      { ...props.metadata },
      props.externalEventId ?? null,
      now,
      undefined,
      false,
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
    tags?: EventTag[];
    tagsAssigned?: boolean;
  }): Event {
    return new Event(
      EventId.from(props.id),
      UserId.from(props.userId),
      props.sourceId,
      EventType.create(props.eventType),
      props.occurredAt,
      props.receivedAt,
      { ...props.metadata },
      props.externalEventId,
      props.createdAt,
      props.tags,
      props.tagsAssigned ?? props.tags !== undefined,
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
    return this.eventType.toString();
  }

  setEventType(eventType: string): void {
    this.eventType = EventType.create(eventType);
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

  getTags(): EventTag[] {
    return [...this.tags];
  }

  areTagsAssigned(): boolean {
    return this.tagsDefined;
  }

  /**
   * Accepts Enrichment suggestions once. Subsequent calls leave tags unchanged.
   * Safe under at-least-once worker delivery.
   */
  assignTags(tags: EventTag[]): EventTag[] {
    if (this.tagsDefined) {
      return this.getTags();
    }

    this.tags = [...tags];
    this.tagsDefined = true;
    return this.getTags();
  }
}
