import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { EventTag } from 'src/domain/event-tag/event-tag';
import type { EventTypeHandler } from 'src/domain/ports/event-type-handler';
import type { EventTypeHandlerRegistry } from 'src/domain/ports/event-type-handler-registry';
import {
  EnrichEventTagsUseCase,
  type EnrichEventTagsLogger,
} from './enrich-event-tags-use-case';

describe('EnrichEventTagsUseCase', () => {
  let useCase: EnrichEventTagsUseCase;
  let eventRepository: jest.Mocked<EventRepository>;
  let eventTypeHandlerRegistry: jest.Mocked<EventTypeHandlerRegistry>;
  let eventTypeHandler: jest.Mocked<EventTypeHandler>;
  let logger: jest.Mocked<EnrichEventTagsLogger>;

  const eventId = '770e8400-e29b-41d4-a716-446655440002';
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const sourceId = '660e8400-e29b-41d4-a716-446655440001';
  const suggestedTags = [
    EventTag.create({ tag: 'developer tools', confidence: 0.95 }),
  ];

  function createPendingEvent(): Event {
    return Event.reconstitute({
      id: eventId,
      userId,
      sourceId,
      eventType: 'WEB_VISIT',
      occurredAt: new Date('2026-06-12T15:30:00.000Z'),
      receivedAt: new Date(),
      metadata: { url: 'https://kafka.apache.org' },
      externalEventId: null,
      createdAt: new Date(),
      tagsAssigned: false,
    });
  }

  beforeEach(() => {
    eventRepository = {
      findById: jest.fn(),
      findByUserIdAndExternalEventId: jest.fn(),
      create: jest.fn(),
      persistAssignedTags: jest.fn(),
    };
    eventTypeHandler = {
      type: 'WEB_VISIT',
      suggestTags: jest.fn().mockReturnValue(suggestedTags),
    };
    eventTypeHandlerRegistry = {
      getHandler: jest.fn().mockReturnValue(eventTypeHandler),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    useCase = new EnrichEventTagsUseCase(
      eventRepository,
      eventTypeHandlerRegistry,
      logger,
    );
  });

  it('assigns tags through the type handler and persists them', async () => {
    const event = createPendingEvent();
    const enriched = Event.reconstitute({
      id: eventId,
      userId,
      sourceId,
      eventType: 'WEB_VISIT',
      occurredAt: event.getOccurredAt(),
      receivedAt: event.getReceivedAt(),
      metadata: event.getMetadata(),
      externalEventId: null,
      createdAt: event.getCreatedAt(),
      tags: suggestedTags,
      tagsAssigned: true,
    });

    eventRepository.findById.mockResolvedValue(event);
    eventRepository.persistAssignedTags.mockResolvedValue(enriched);

    await expect(useCase.execute(eventId)).resolves.toEqual({
      eventId,
      status: 'enriched',
      tagCount: 1,
    });

    expect(eventTypeHandler.suggestTags).toHaveBeenCalledWith(
      event.getMetadata(),
    );
    expect(eventRepository.persistAssignedTags).toHaveBeenCalled();
  });

  it('is idempotent when tags were already assigned', async () => {
    const event = Event.reconstitute({
      id: eventId,
      userId,
      sourceId,
      eventType: 'WEB_VISIT',
      occurredAt: new Date('2026-06-12T15:30:00.000Z'),
      receivedAt: new Date(),
      metadata: { url: 'https://kafka.apache.org' },
      externalEventId: null,
      createdAt: new Date(),
      tags: suggestedTags,
      tagsAssigned: true,
    });

    eventRepository.findById.mockResolvedValue(event);

    await expect(useCase.execute(eventId)).resolves.toEqual({
      eventId,
      status: 'already_enriched',
      tagCount: 1,
    });

    expect(eventTypeHandler.suggestTags).not.toHaveBeenCalled();
    expect(eventRepository.persistAssignedTags).not.toHaveBeenCalled();
  });

  it('returns not_found when the event does not exist', async () => {
    eventRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(eventId)).resolves.toEqual({
      eventId,
      status: 'not_found',
      tagCount: 0,
    });
  });
});
