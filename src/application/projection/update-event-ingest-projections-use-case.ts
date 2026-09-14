import { structuredLog } from 'src/common/logging/structured-log';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { ProjectionStore } from 'src/domain/ports/projection-store';
import {
  extractBrowserFromMetadata,
  extractDomainFromMetadata,
} from 'src/infrastructure/common/event-metadata-extractors';
import {
  extractHourInTimezone,
  formatDateInTimezone,
} from 'src/infrastructure/common/event-cursor';
export type UpdateEventIngestProjectionsLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
};

export type UpdateEventIngestProjectionsResult = {
  eventId: string;
  status: 'applied' | 'skipped' | 'not_found';
};

/**
 * Idempotent ingest-side projection updater for EventIngested.
 */
export class UpdateEventIngestProjectionsUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly projectionStore: ProjectionStore,
    private readonly logger: UpdateEventIngestProjectionsLogger,
  ) {}

  async execute(eventId: string): Promise<UpdateEventIngestProjectionsResult> {
    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      this.logger.warn(
        structuredLog('projection.ingest.not_found', { eventId }),
      );
      return { eventId, status: 'not_found' };
    }

    const userId = event.getUserId().toString();
    const timezone = await this.projectionStore.resolveTimezone(userId);
    const occurredAt = event.getOccurredAt();

    const status = await this.projectionStore.applyIngestProjection({
      eventId,
      userId,
      sourceId: event.getSourceId(),
      occurredAt,
      localDate: formatDateInTimezone(occurredAt, timezone),
      localHour: extractHourInTimezone(occurredAt, timezone),
      domain: extractDomainFromMetadata(event.getMetadata()),
      browser: extractBrowserFromMetadata(event.getMetadata()),
    });

    this.logger.log(
      structuredLog('projection.ingest.completed', {
        eventId,
        userId,
        status,
      }),
    );

    return { eventId, status };
  }
}
