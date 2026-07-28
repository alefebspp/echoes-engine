import { DataSource, EntityManager, Repository } from 'typeorm';
import { Event } from 'src/domain/event/event';
import { EventTag } from 'src/domain/event-tag/event-tag';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { EventOrmEntity } from './entities/event.entity';
import { EventTagOrmEntity } from './entities/event-tag.entity';
import { TypeOrmEventRepository } from './event-repository';

describe('TypeOrmEventRepository', () => {
  let repository: TypeOrmEventRepository;
  let events: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionManager: {
    save: jest.Mock;
    getRepository: jest.Mock;
  };
  let eventTagsRepository: {
    create: jest.Mock;
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
    domainEvent.assignTags([
      EventTag.create({ tag: 'developer tools', confidence: 0.95 }),
    ]);

    eventTagsRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    transactionManager = {
      save: jest.fn(),
      getRepository: jest.fn().mockReturnValue(eventTagsRepository),
    };
    events = {
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (work: (manager: EntityManager) => unknown) =>
        work(transactionManager as unknown as EntityManager),
      ),
    };

    repository = new TypeOrmEventRepository(
      events as unknown as Repository<EventOrmEntity>,
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
    expect(result!.getTags()).toHaveLength(1);
    expect(result!.getTags()[0].getTag()).toBe('developer tools');
    expect(result!.getTags()[0].getConfidence()).toBe(0.95);
  });

  it('creates an event and persists domain tags inside a transaction', async () => {
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
    };

    const savedTags = [
      {
        id: '880e8400-e29b-41d4-a716-446655440003',
        eventId: persisted.id,
        tag: 'developer tools',
        confidence: '0.9500',
        createdAt: new Date(),
      },
    ];

    transactionManager.save.mockResolvedValue(persisted);
    eventTagsRepository.save.mockResolvedValue(savedTags);

    const result = await repository.create(domainEvent);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.save).toHaveBeenCalled();
    expect(transactionManager.getRepository).toHaveBeenCalledWith(
      EventTagOrmEntity,
    );
    expect(eventTagsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: persisted.id,
        tag: 'developer tools',
        confidence: '0.9500',
      }),
    );
    expect(eventTagsRepository.save).toHaveBeenCalled();
    expect(result.getId().toString()).toBe(persisted.id);
    expect(result.getTags()).toHaveLength(1);
    expect(result.getTags()[0].getTag()).toBe('developer tools');
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
    };

    transactionManager.save.mockResolvedValue(persisted);
    eventTagsRepository.save.mockRejectedValue(
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
