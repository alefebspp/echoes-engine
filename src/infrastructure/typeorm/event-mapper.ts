import { Event } from 'src/domain/event/event';
import { EventOrmEntity } from './entities/event.entity';

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
    return entity;
  }
}
