import { DataSource, EntityManager, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { OutboxMessage } from 'src/domain/outbox/outbox-message';
import { EventIngested } from 'src/domain/domain-event/event-ingested';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';
import { OutboxMessageOrmEntity } from './entities/outbox-message.entity';
import { TypeOrmEventRepository } from './event-repository';

describe('TypeOrmEventRepository', () => {
  let repository: TypeOrmEventRepository;
  let events: { findOne: jest.Mock };
  let outbox: { update: jest.Mock; count: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionManager: {
    save: jest.Mock;
    getRepository: jest.Mock;
  };
  let eventTagsRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let outboxRepository: {
    save: jest.Mock;
  };
  let domainEvent: Event;

  beforeEach(() => {
    domainEvent = Event.create({
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

    eventTagsRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    outboxRepository = {
      save: jest.fn(),
    };
    transactionManager = {
      save: jest.fn(),
      getRepository: jest.fn((target) => {
        if (target === EventTagOrmEntity) {
          return eventTagsRepository;
        }
        if (target === OutboxMessageOrmEntity) {
          return outboxRepository;
        }
        return eventTagsRepository;
      }),
    };
    events = {
      findOne: jest.fn(),
    };
    outbox = {
      update: jest.fn(),
      count: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (work: (manager: EntityManager) => unknown) =>
        work(transactionManager as unknown as EntityManager),
      ),
    };

    repository = new TypeOrmEventRepository(
      events as unknown as Repository<EventOrmEntity>,
      outbox as unknown as Repository<OutboxMessageOrmEntity>,
      dataSource as unknown as DataSource,
    );
  });

  it('loads tags when finding by user and external event id', async () => {
    const tagCreatedAt = new Date('2026-06-12T15:31:00.000Z');
    events.findOne.mockResolvedValue({
      id: '770e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      sourceId: '660e8400-e29b-41d4-a716-446655440001',
      eventType: 'WEB_VISIT',
      occurredAt: new Date('2026-06-12T15:30:00.000Z'),
      receivedAt: new Date('2026-06-12T15:30:01.000Z'),
      metadata: { url: 'https://kafka.apache.org' },
      externalEventId: 'ext-1',
      createdAt: new Date('2026-06-12T15:30:01.000Z'),
      tagsAssigned: true,
      tags: [
        {
          id: '880e8400-e29b-41d4-a716-446655440003',
          eventId: '770e8400-e29b-41d4-a716-446655440002',
          tag: 'developer tools',
          confidence: '0.9500',
          createdAt: tagCreatedAt,
        },
      ],
    });

    const result = await repository.findByUserIdAndExternalEventId(
      '550e8400-e29b-41d4-a716-446655440000',
      'ext-1',
    );

    expect(events.findOne).toHaveBeenCalledWith({
      where: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        externalEventId: 'ext-1',
      },
      relations: { tags: true },
    });
    expect(result).not.toBeNull();
    expect(result!.areTagsAssigned()).toBe(true);
    expect(result!.getTags()).toHaveLength(1);
    expect(result!.getTags()[0].getTag()).toBe('developer tools');
    expect(result!.getTags()[0].getConfidence()).toBe(0.95);
  });

  it('creates an event and outbox message inside a transaction', async () => {
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
      tagsAssigned: false,
      tags: [],
    };

    const outboxMessage = OutboxMessage.createFromDomainEvent(
      new EventIngested(
        domainEvent.getId().toString(),
        domainEvent.getUserId().toString(),
        domainEvent.getEventType(),
        'corr-1',
      ),
    );

    transactionManager.save.mockResolvedValue(persisted);
    outboxRepository.save.mockResolvedValue([]);

    const result = await repository.create(domainEvent, [outboxMessage]);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.save).toHaveBeenCalled();
    expect(outboxRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: outboxMessage.getId(),
          type: 'EventIngested',
        }),
      ]),
    );
    expect(eventTagsRepository.save).not.toHaveBeenCalled();
    expect(result.getId().toString()).toBe(persisted.id);
    expect(result.getTags()).toHaveLength(0);
    expect(result.areTagsAssigned()).toBe(false);
  });

  it('throws DuplicateExternalEventException on unique violation', async () => {
    transactionManager.save.mockRejectedValue({ code: '23505' });

    await expect(repository.create(domainEvent)).rejects.toThrow(
      DuplicateExternalEventException,
    );
  });

  it('persists assigned tags and marks tags_assigned', async () => {
    domainEvent.assignTags([
      EventTag.create({ tag: 'developer tools', confidence: 0.95 }),
    ]);

    const existing = {
      id: domainEvent.getId().toString(),
      userId: domainEvent.getUserId().toString(),
      sourceId: domainEvent.getSourceId(),
      eventType: domainEvent.getEventType(),
      occurredAt: domainEvent.getOccurredAt(),
      receivedAt: domainEvent.getReceivedAt(),
      metadata: domainEvent.getMetadata(),
      externalEventId: null,
      createdAt: domainEvent.getCreatedAt(),
      tagsAssigned: false,
      tags: [],
    };

    const eventsRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn().mockResolvedValue({ ...existing, tagsAssigned: true }),
    };
    const savedTags = [
      {
        id: domainEvent.getTags()[0].getId(),
        eventId: existing.id,
        tag: 'developer tools',
        confidence: '0.9500',
        createdAt: new Date(),
      },
    ];
    eventTagsRepository.save.mockResolvedValue(savedTags);
    transactionManager.getRepository = jest.fn((target) => {
      if (target === EventOrmEntity) {
        return eventsRepo;
      }
      if (target === EventTagOrmEntity) {
        return eventTagsRepository;
      }
      return eventTagsRepository;
    });

    const result = await repository.persistAssignedTags(domainEvent);

    expect(eventsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tagsAssigned: true }),
    );
    expect(eventTagsRepository.save).toHaveBeenCalled();
    expect(result.areTagsAssigned()).toBe(true);
    expect(result.getTags()).toHaveLength(1);
  });
});
