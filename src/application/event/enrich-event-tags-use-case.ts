import { structuredLog } from 'src/common/logging/structured-log';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { EventTypeHandlerRegistry } from 'src/domain/ports/event-type-handler-registry';

export type EnrichEventTagsLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
  error(message: unknown, stack?: string): void;
};

export type EnrichEventTagsResult = {
  eventId: string;
  status: 'enriched' | 'already_enriched' | 'not_found';
  tagCount: number;
};

/**
 * Idempotent consumer for EventIngested: assign tags once per event.
 */
export class EnrichEventTagsUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventTypeHandlerRegistry: EventTypeHandlerRegistry,
    private readonly logger: EnrichEventTagsLogger,
  ) {}

  async execute(eventId: string): Promise<EnrichEventTagsResult> {
    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      this.logger.warn(
        structuredLog('event.enrich.not_found', { eventId }),
      );
      return { eventId, status: 'not_found', tagCount: 0 };
    }

    if (event.areTagsAssigned()) {
      this.logger.log(
        structuredLog('event.enrich.already_enriched', {
          eventId,
          userId: event.getUserId().toString(),
          tagCount: event.getTags().length,
        }),
      );
      return {
        eventId,
        status: 'already_enriched',
        tagCount: event.getTags().length,
      };
    }

    const handler = this.eventTypeHandlerRegistry.getHandler(
      event.getEventType(),
    );
    const suggested = handler.suggestTags(event.getMetadata());
    event.assignTags(suggested);

    const saved = await this.eventRepository.persistAssignedTags(event);

    this.logger.log(
      structuredLog('event.enrich.succeeded', {
        eventId,
        userId: saved.getUserId().toString(),
        eventType: saved.getEventType(),
        tagCount: saved.getTags().length,
      }),
    );

    return {
      eventId,
      status: 'enriched',
      tagCount: saved.getTags().length,
    };
  }
}
