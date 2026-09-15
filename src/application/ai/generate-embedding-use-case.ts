import { structuredLog } from 'src/common/logging/structured-log';
import type { EventRepository } from 'src/domain/event/event-repository';
import type { EmbeddingPort } from 'src/domain/ports/embedding-port';
import type { EventEmbeddingStore } from 'src/domain/ports/event-embedding-store';
import {
  buildEventEmbeddingText,
  hashEmbeddingContent,
} from './embedding-text';

export type GenerateEmbeddingLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
  error(message: unknown, stack?: string): void;
};

export type GenerateEmbeddingResult = {
  eventId: string;
  status: 'embedded' | 'skipped' | 'not_found' | 'no_text';
  model?: string;
};

/**
 * Idempotent async consumer: embed event text once per content hash + model.
 */
export class GenerateEmbeddingUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly embeddingPort: EmbeddingPort,
    private readonly eventEmbeddingStore: EventEmbeddingStore,
    private readonly logger: GenerateEmbeddingLogger,
  ) {}

  async execute(eventId: string): Promise<GenerateEmbeddingResult> {
    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      this.logger.warn(
        structuredLog('embedding.generate.not_found', { eventId }),
      );
      return { eventId, status: 'not_found' };
    }

    const userId = event.getUserId().toString();
    const text = buildEventEmbeddingText(
      event.getEventType(),
      event.getMetadata(),
    );

    if (!text) {
      this.logger.warn(
        structuredLog('embedding.generate.no_text', {
          eventId,
          userId,
          eventType: event.getEventType(),
        }),
      );
      return { eventId, status: 'no_text' };
    }

    const contentHash = hashEmbeddingContent(text);
    const existing = await this.eventEmbeddingStore.findByEventId(
      eventId,
      userId,
    );

    if (
      existing &&
      existing.contentHash === contentHash &&
      existing.model === this.embeddingPort.model
    ) {
      this.logger.log(
        structuredLog('embedding.generate.skipped', {
          eventId,
          userId,
          model: existing.model,
          contentHash,
        }),
      );
      return { eventId, status: 'skipped', model: existing.model };
    }

    const embedded = await this.embeddingPort.embed(text);

    await this.eventEmbeddingStore.upsert({
      eventId,
      userId,
      vector: embedded.vector,
      model: embedded.model,
      dimensions: embedded.dimensions,
      contentHash,
    });

    this.logger.log(
      structuredLog('embedding.generate.succeeded', {
        eventId,
        userId,
        model: embedded.model,
        dimensions: embedded.dimensions,
        contentHash,
      }),
    );

    return { eventId, status: 'embedded', model: embedded.model };
  }
}
