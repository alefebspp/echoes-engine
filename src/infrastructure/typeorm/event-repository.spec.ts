import { DataSource, EntityManager, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { EventOrmEntity } from './entities/event.entity';
import { TypeOrmEventRepository } from './event-repository';
import { TypeOrmEventTagger } from './event-tagger';

describe('TypeOrmEventRepository', () => {
  let repository: TypeOrmEventRepository;
  let events: jest.Mocked<Pick<Repository<EventOrmEntity>, 'findOneBy'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let eventTagger: jest.Mocked<
    Pick<TypeOrmEventTagger, 'tagEventFromMetadata'>
  >;
  let transactionManager: jest.Mocked<Pick<EntityManager, 'save'>>;

  const domainEvent = Event.create({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    sourceId: '660e8400-e29b-41d4-a716-446655440001',
    eventType: 'WEB_VISIT',
    occurredAt: new Date('2026-06-12T15:30:00.000Z'),
    metadata: {
      url: 'https://kafka.apache.org',
      title: 'Apache Kafka',
      browser: 'chrome',
    },
  });

  beforeEach(() => {
    transactionManager = {
      save: jest.fn(),
    };
    events = {
      findOneBy: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (work) =>
        work(transactionManager as EntityManager),
      ),
    };
    eventTagger = {
      tagEventFromMetadata: jest.fn(),
    };

    repository = new TypeOrmEventRepository(
      events as unknown as Repository<EventOrmEntity>,
      dataSource as unknown as DataSource,
      eventTagger as unknown as TypeOrmEventTagger,
    );
  });

  it('creates an event and tags inside a transaction', async () => {
    const persisted = {
      id: domainEvent.getId().toString(),
      userId: domainEvent.getUserId().toString(),
      sourceId: domainEvent.getSourceId(),
      eventType: domainEvent.getEventType(),
      occurredAt: domainEvent.getOccurredAt(),
      receivedAt: domainEvent.getReceivedAt(),
      metadata: domainEvent.getMetadata(),
      externalEventId: null,
      createdAt: domainEvent.getCreatedAt(),
    } as EventOrmEntity;

    transactionManager.save.mockResolvedValue(persisted);
    eventTagger.tagEventFromMetadata.mockResolvedValue([]);

    const result = await repository.create(domainEvent);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.save).toHaveBeenCalled();
    expect(eventTagger.tagEventFromMetadata).toHaveBeenCalledWith(
      persisted.id,
      persisted.metadata,
      transactionManager,
    );
    expect(result.getId().toString()).toBe(persisted.id);
  });

  it('rolls back when tag creation fails inside the transaction', async () => {
    const persisted = {
      id: domainEvent.getId().toString(),
      userId: domainEvent.getUserId().toString(),
      sourceId: domainEvent.getSourceId(),
      eventType: domainEvent.getEventType(),
      occurredAt: domainEvent.getOccurredAt(),
      receivedAt: domainEvent.getReceivedAt(),
      metadata: domainEvent.getMetadata(),
      externalEventId: null,
      createdAt: domainEvent.getCreatedAt(),
    } as EventOrmEntity;

    transactionManager.save.mockResolvedValue(persisted);
    eventTagger.tagEventFromMetadata.mockRejectedValue(
      new Error('tag persistence failed'),
    );

    await expect(repository.create(domainEvent)).rejects.toThrow(
      'tag persistence failed',
    );
  });

  it('throws DuplicateExternalEventException on unique violation', async () => {
    transactionManager.save.mockRejectedValue({ code: '23505' });

    await expect(repository.create(domainEvent)).rejects.toThrow(
      DuplicateExternalEventException,
    );
  });
});
