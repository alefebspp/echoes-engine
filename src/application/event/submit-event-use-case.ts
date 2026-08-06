import { structuredLog } from 'src/common/logging/structured-log';
import { EventIngested } from 'src/domain/domain-event/event-ingested';
import { Event } from 'src/domain/event/event';
import type { EventRepository } from 'src/domain/event/event-repository';
import { DuplicateExternalEventException } from 'src/domain/exceptions/duplicate-external-event-exception';
import { InvalidEventTypeException } from 'src/domain/exceptions/invalid-event-type-exception';
import { UnsupportedEventTypeHandlerException } from 'src/domain/exceptions/unsupported-event-type-handler-exception';
import { OutboxMessage } from 'src/domain/outbox/outbox-message';
import type { CorrelationIdProvider } from 'src/domain/ports/correlation-id-provider';
import type { EventTypeHandlerRegistry } from 'src/domain/ports/event-type-handler-registry';
import type { EventSourceLookup } from 'src/domain/ports/event-source-lookup';
import { EventSourceNotFoundException } from './exceptions/event-source-not-found-exception';
import { UnableToStoreEventException } from './exceptions/unable-to-store-event-exception';

export type SubmitEventResult = {
  id: string;
  status: 'accepted';
};

export type SubmitEventLogger = {
  log(message: unknown): void;
  error(message: unknown, stack?: string): void;
};

export class SubmitEventUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventSourceLookup: EventSourceLookup,
    private readonly eventTypeHandlerRegistry: EventTypeHandlerRegistry,
    private readonly correlationIdProvider: CorrelationIdProvider,
    private readonly logger: SubmitEventLogger,
  ) {}

  async execute(
    userId: string,
    props: {
      type: string;
      timestamp: string;
      source: string;
      metadata: Record<string, unknown>;
      id?: string;
    },
  ): Promise<SubmitEventResult> {
    const sourceId = await this.eventSourceLookup.findIdByCode(props.source);
    if (!sourceId) {
      throw new EventSourceNotFoundException(props.source);
    }

    if (props.id) {
      const existing = await this.eventRepository.findByUserIdAndExternalEventId(
        userId,
        props.id,
      );
      if (existing) {
        return { id: existing.getId().toString(), status: 'accepted' };
      }
    }

    // Fail fast on unsupported types; enrichment runs async via EventIngested.
    this.eventTypeHandlerRegistry.getHandler(props.type);

    try {
      this.logger.log(
        structuredLog('event.create.started', {
          userId,
          eventType: props.type,
          source: props.source,
          externalEventId: props.id ?? null,
        }),
      );

      const event = Event.create({
        userId,
        sourceId,
        eventType: props.type,
        occurredAt: new Date(props.timestamp),
        metadata: props.metadata,
        externalEventId: props.id ?? null,
      });

      const domainEvent = new EventIngested(
        event.getId().toString(),
        userId,
        event.getEventType(),
        this.correlationIdProvider.getCorrelationId(),
      );
      const outboxMessage = OutboxMessage.createFromDomainEvent(domainEvent);

      const saved = await this.eventRepository.create(event, [outboxMessage]);

      this.logger.log(
        structuredLog('event.create.succeeded', {
          userId,
          eventId: saved.getId().toString(),
          eventType: props.type,
          source: props.source,
          outboxType: domainEvent.type,
        }),
      );

      return { id: saved.getId().toString(), status: 'accepted' };
    } catch (error) {
      if (
        error instanceof InvalidEventTypeException ||
        error instanceof UnsupportedEventTypeHandlerException
      ) {
        throw error;
      }

      if (props.id && error instanceof DuplicateExternalEventException) {
        const existing =
          await this.eventRepository.findByUserIdAndExternalEventId(
            userId,
            props.id,
          );
        if (existing) {
          return { id: existing.getId().toString(), status: 'accepted' };
        }
      }

      this.logger.error(
        structuredLog('event.create.failed', {
          userId,
          eventType: props.type,
          source: props.source,
          externalEventId: props.id ?? null,
          ...(error instanceof Error && {
            errorName: error.name,
            errorMessage: error.message,
          }),
        }),
        error instanceof Error ? error.stack : undefined,
      );

      throw new UnableToStoreEventException();
    }
  }
}
