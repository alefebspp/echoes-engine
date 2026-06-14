import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  beforeEach(async () => {
    eventsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
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
          provide: EventSourcesService,
          useValue: eventSourcesService,
        },
        {
          provide: EventTagsService,
          useValue: eventTagsService,
        },
      ],
    }).compile();

    service = module.get(EventsService);
    jest.clearAllMocks();
  });

  it('stores a new event and returns accepted status', async () => {
    eventSourcesService.findByCode.mockResolvedValue(source);
    eventsRepository.findOneBy.mockResolvedValue(null);
    eventsRepository.create.mockReturnValue(savedEvent);
    eventsRepository.save.mockResolvedValue(savedEvent);
    eventTagsService.tagEventFromMetadata.mockResolvedValue([]);

    await expect(
      service.submit(savedEvent.userId, submitEventDto),
    ).resolves.toEqual({
      id: savedEvent.id,
      status: 'accepted',
    });
    expect(eventTagsService.tagEventFromMetadata).toHaveBeenCalledWith(
      savedEvent.id,
      savedEvent.metadata,
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
    expect(eventsRepository.save).not.toHaveBeenCalled();
  });

  it('throws when event source is missing', async () => {
    eventSourcesService.findByCode.mockResolvedValue(null);

    await expect(
      service.submit(savedEvent.userId, submitEventDto),
    ).rejects.toThrow(NotFoundException);
  });
});
