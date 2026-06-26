import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AppLogger } from '../common/logging/app-logger.service';
import { EventSource } from '../event-sources/event-source.entity';
import { EventSourcesService } from '../event-sources/event-sources.service';
import { EventTagsService } from '../event-tags/event-tags.service';
import { SubmitEventDto } from './dto/submit-event.dto';
import { Event } from './event.entity';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let eventsRepository: jest.Mocked<
    Pick<Repository<Event>, 'create' | 'save' | 'findOneBy'>
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let eventSourcesService: jest.Mocked<Pick<EventSourcesService, 'findByCode'>>;
  let eventTagsService: jest.Mocked<
    Pick<EventTagsService, 'tagEventFromMetadata'>
  >;

  const source: EventSource = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    code: 'browser_extension',
    name: 'Browser Extension',
    createdAt: new Date(),
  };

  const submitEventDto: SubmitEventDto = {
    type: 'WEB_VISIT',
    timestamp: '2026-06-12T15:30:00.000Z',
    source: 'browser_extension',
    metadata: {
      url: 'https://kafka.apache.org',
      title: 'Apache Kafka',
      browser: 'chrome',
    },
  };

  const savedEvent: Event = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    user: {} as Event['user'],
    sourceId: source.id,
    source,
    eventType: 'WEB_VISIT',
    occurredAt: new Date(submitEventDto.timestamp),
    receivedAt: new Date(),
    metadata: submitEventDto.metadata,
    externalEventId: null,
    createdAt: new Date(),
  };

  let transactionManager: jest.Mocked<
    Pick<EntityManager, 'create' | 'save'>
  >;

  beforeEach(async () => {
    transactionManager = {
      create: jest.fn(),
      save: jest.fn(),
    };
    eventsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (work) => work(transactionManager as EntityManager)),
    };
    eventSourcesService = {
      findByCode: jest.fn(),
    };
    eventTagsService = {
      tagEventFromMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: eventsRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: EventSourcesService,
          useValue: eventSourcesService,
        },
        {
          provide: EventTagsService,
          useValue: eventTagsService,
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            fatal: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EventsService);
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(async (work) =>
      work(transactionManager as EntityManager),
    );
  });

  it('stores a new event and tags inside a transaction', async () => {
    eventSourcesService.findByCode.mockResolvedValue(source);
    eventsRepository.findOneBy.mockResolvedValue(null);
    transactionManager.create.mockReturnValue(savedEvent);
    transactionManager.save.mockResolvedValue(savedEvent);
    eventTagsService.tagEventFromMetadata.mockResolvedValue([]);

    await expect(
      service.submit(savedEvent.userId, submitEventDto),
    ).resolves.toEqual({
      id: savedEvent.id,
      status: 'accepted',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.create).toHaveBeenCalledWith(Event, {
      userId: savedEvent.userId,
      sourceId: source.id,
      eventType: submitEventDto.type,
      occurredAt: new Date(submitEventDto.timestamp),
      metadata: submitEventDto.metadata,
      externalEventId: null,
    });
    expect(transactionManager.save).toHaveBeenCalledWith(savedEvent);
    expect(eventTagsService.tagEventFromMetadata).toHaveBeenCalledWith(
      savedEvent.id,
      savedEvent.metadata,
      transactionManager,
    );
    expect(eventsRepository.save).not.toHaveBeenCalled();
  });

  it('rolls back when tag creation fails inside the transaction', async () => {
    eventSourcesService.findByCode.mockResolvedValue(source);
    eventsRepository.findOneBy.mockResolvedValue(null);
    transactionManager.create.mockReturnValue(savedEvent);
    transactionManager.save.mockResolvedValue(savedEvent);
    eventTagsService.tagEventFromMetadata.mockRejectedValue(
      new Error('tag persistence failed'),
    );

    await expect(
      service.submit(savedEvent.userId, submitEventDto),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(eventTagsService.tagEventFromMetadata).toHaveBeenCalledWith(
      savedEvent.id,
      savedEvent.metadata,
      transactionManager,
    );
  });

  it('returns existing event when idempotency key matches', async () => {
    eventSourcesService.findByCode.mockResolvedValue(source);
    eventsRepository.findOneBy.mockResolvedValue({
      ...savedEvent,
      externalEventId: '880e8400-e29b-41d4-a716-446655440003',
    });

    await expect(
      service.submit(savedEvent.userId, {
        ...submitEventDto,
        id: '880e8400-e29b-41d4-a716-446655440003',
      }),
    ).resolves.toEqual({
      id: savedEvent.id,
      status: 'accepted',
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(eventsRepository.save).not.toHaveBeenCalled();
  });

  it('returns existing event when unique index conflict occurs', async () => {
    const idempotencyKey = '880e8400-e29b-41d4-a716-446655440003';
    const existingEvent = {
      ...savedEvent,
      externalEventId: idempotencyKey,
    };

    eventSourcesService.findByCode.mockResolvedValue(source);
    eventsRepository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingEvent);
    transactionManager.create.mockReturnValue(existingEvent);
    transactionManager.save.mockRejectedValue({ code: '23505' });

    await expect(
      service.submit(savedEvent.userId, {
        ...submitEventDto,
        id: idempotencyKey,
      }),
    ).resolves.toEqual({
      id: savedEvent.id,
      status: 'accepted',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('throws when event source is missing', async () => {
    eventSourcesService.findByCode.mockResolvedValue(null);

    await expect(
      service.submit(savedEvent.userId, submitEventDto),
    ).rejects.toThrow(NotFoundException);
  });
});
