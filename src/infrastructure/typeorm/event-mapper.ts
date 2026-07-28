import { Event } from 'src/domain/event/event';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';

export class EventMapper {
  static toDomain(entity: EventOrmEntity): Event {
    return Event.reconstitute({
      id: entity.id,
      userId: entity.userId,
      sourceId: entity.sourceId,
      eventType: entity.eventType,
      occurredAt: entity.occurredAt,
      receivedAt: entity.receivedAt,
      metadata: entity.metadata,
      externalEventId: entity.externalEventId,
      createdAt: entity.createdAt,
      tags: (entity.tags ?? []).map((tag) => EventMapper.tagToDomain(tag)),
    });
  }

  static toOrm(event: Event): EventOrmEntity {
    const entity = new EventOrmEntity();
    entity.id = event.getId().toString();
    entity.userId = event.getUserId().toString();
    entity.sourceId = event.getSourceId();
    entity.eventType = event.getEventType();
    entity.occurredAt = event.getOccurredAt();
    entity.receivedAt = event.getReceivedAt();
    entity.metadata = event.getMetadata();
    entity.externalEventId = event.getExternalEventId();
    entity.createdAt = event.getCreatedAt();
    entity.tags = event.getTags().map((tag) => EventMapper.tagToOrm(tag));
    return entity;
  }

  private static tagToDomain(entity: EventTagOrmEntity): EventTag {
    return EventTag.reconstitute({
      id: entity.id,
      tag: entity.tag,
      confidence:
        entity.confidence === null ? null : Number(entity.confidence),
      createdAt: entity.createdAt,
    });
  }

  private static tagToOrm(tag: EventTag): EventTagOrmEntity {
    const entity = new EventTagOrmEntity();
    entity.id = tag.getId();
    entity.tag = tag.getTag();
    const confidence = tag.getConfidence();
    entity.confidence = confidence === null ? null : confidence.toFixed(4);
    entity.createdAt = tag.getCreatedAt();
    return entity;
  }
}
