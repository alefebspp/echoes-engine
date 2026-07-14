import { EventSourceNotFoundException } from './exceptions/event-source-not-found-exception';
import { UnableToStoreEventException } from './exceptions/unable-to-store-event-exception';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import {
  SubmitEventUseCase,
  type SubmitEventLogger,
} from './submit-event-use-case';

describe('SubmitEventUseCase', () => {
  let useCase: SubmitEventUseCase;
  let eventRepository: jest.Mocked<EventRepository>;
  let eventSourceLookup: jest.Mocked<EventSourceLookup>;
  let logger: jest.Mocked<SubmitEventLogger>;

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const sourceId = '660e8400-e29b-41d4-a716-446655440001';

  const submitProps = {
    type: 'WEB_VISIT',
    timestamp: '2026-06-12T15:30:00.000Z',
    source: 'browser_extension',
    metadata: {
      url: 'https://kafka.apache.org',
      title: 'Apache Kafka',
      browser: 'chrome',
    },
  };

  const savedEvent = Event.reconstitute({
    id: '770e8400-e29b-41d4-a716-446655440002',
    userId,
    sourceId,
    eventType: submitProps.type,
    occurredAt: new Date(submitProps.timestamp),
    receivedAt: new Date(),
    metadata: submitProps.metadata,
    externalEventId: null,
    createdAt: new Date(),
  });

  beforeEach(() => {
    eventRepository = {
      findByUserIdAndExternalEventId: jest.fn(),
      create: jest.fn(),
    };
    eventSourceLookup = {
      findIdByCode: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    useCase = new SubmitEventUseCase(
      eventRepository,
      eventSourceLookup,
      logger,
    );
  });

  it('stores a new event', async () => {
    eventSourceLookup.findIdByCode.mockResolvedValue(sourceId);
    eventRepository.create.mockResolvedValue(savedEvent);

    await expect(useCase.execute(userId, submitProps)).resolves.toEqual({
      id: savedEvent.getId().toString(),
      status: 'accepted',
    });

    expect(eventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        getUserId: expect.any(Function),
        getSourceId: expect.any(Function),
        getEventType: expect.any(Function),
      }),
    );

    const createdEvent = eventRepository.create.mock.calls[0][0];
    expect(createdEvent.getUserId().toString()).toBe(userId);
    expect(createdEvent.getSourceId()).toBe(sourceId);
    expect(createdEvent.getEventType()).toBe(submitProps.type);
    expect(createdEvent.getOccurredAt()).toEqual(
      new Date(submitProps.timestamp),
    );
    expect(createdEvent.getMetadata()).toEqual(submitProps.metadata);
    expect(createdEvent.getExternalEventId()).toBeNull();
  });

  it('throws UnableToStoreEventException when create fails', async () => {
    eventSourceLookup.findIdByCode.mockResolvedValue(sourceId);
    eventRepository.create.mockRejectedValue(new Error('tag persistence failed'));

    await expect(useCase.execute(userId, submitProps)).rejects.toThrow(
      UnableToStoreEventException,
    );
  });

  it('returns existing event when idempotency key matches', async () => {
    const externalEventId = '880e8400-e29b-41d4-a716-446655440003';
    const existing = Event.reconstitute({
      id: savedEvent.getId().toString(),
      userId,
      sourceId,
      eventType: submitProps.type,
      occurredAt: new Date(submitProps.timestamp),
      receivedAt: new Date(),
      metadata: submitProps.metadata,
      externalEventId,
      createdAt: new Date(),
    });

    eventSourceLookup.findIdByCode.mockResolvedValue(sourceId);
    eventRepository.findByUserIdAndExternalEventId.mockResolvedValue(existing);

    await expect(
      useCase.execute(userId, { ...submitProps, id: externalEventId }),
    ).resolves.toEqual({
      id: savedEvent.getId().toString(),
      status: 'accepted',
    });

    expect(eventRepository.create).not.toHaveBeenCalled();
  });

  it('returns existing event when unique index conflict occurs', async () => {
    const externalEventId = '880e8400-e29b-41d4-a716-446655440003';
    const existing = Event.reconstitute({
      id: savedEvent.getId().toString(),
      userId,
      sourceId,
      eventType: submitProps.type,
      occurredAt: new Date(submitProps.timestamp),
      receivedAt: new Date(),
      metadata: submitProps.metadata,
      externalEventId,
      createdAt: new Date(),
    });

    eventSourceLookup.findIdByCode.mockResolvedValue(sourceId);
    eventRepository.findByUserIdAndExternalEventId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    eventRepository.create.mockRejectedValue(
      new DuplicateExternalEventException(),
    );

    await expect(
      useCase.execute(userId, { ...submitProps, id: externalEventId }),
    ).resolves.toEqual({
      id: savedEvent.getId().toString(),
      status: 'accepted',
    });
  });

  it('throws when event source is missing', async () => {
    eventSourceLookup.findIdByCode.mockResolvedValue(null);

    await expect(useCase.execute(userId, submitProps)).rejects.toThrow(
      EventSourceNotFoundException,
    );
  });
});
