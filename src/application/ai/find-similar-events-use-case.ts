import { structuredLog } from 'src/common/logging/structured-log';
import type { EventRepository } from 'src/domain/event/event-repository';
import { extractDomainFromMetadata } from 'src/infrastructure/common/event-metadata-extractors';
import type {
  EventEmbeddingStore,
  SimilarEventHit,
} from 'src/domain/ports/event-embedding-store';

export type FindSimilarEventsLogger = {
  log(message: unknown): void;
  warn(message: unknown): void;
};

export type SimilarEventsMode =
  | 'vector'
  | 'tags'
  | 'domain'
  | 'semantic_index_not_ready';

export type FindSimilarEventsInput = {
  userId: string;
  eventId: string;
  limit?: number;
};

export type FindSimilarEventsResult = {
  eventId: string;
  mode: SimilarEventsMode;
  items: Array<{
    eventId: string;
    similarity: number | null;
    occurredAt: string;
    type: string;
    metadata: Record<string, unknown>;
    tags: string[];
  }>;
};

/**
 * Similar events: vector KNN first, then tag/domain fallbacks.
 */
export class FindSimilarEventsUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly eventEmbeddingStore: EventEmbeddingStore,
    private readonly logger: FindSimilarEventsLogger,
  ) {}

  async execute(
    input: FindSimilarEventsInput,
  ): Promise<FindSimilarEventsResult | null> {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const event = await this.eventRepository.findById(input.eventId);

    if (!event || event.getUserId().toString() !== input.userId) {
      return null;
    }

    const embedding = await this.eventEmbeddingStore.findByEventId(
      input.eventId,
      input.userId,
    );

    if (embedding) {
      const hits = await this.eventEmbeddingStore.findSimilarByEventId({
        userId: input.userId,
        eventId: input.eventId,
        limit,
      });

      if (hits.length > 0) {
        this.logger.log(
          structuredLog('similar.vector', {
            eventId: input.eventId,
            userId: input.userId,
            hitCount: hits.length,
          }),
        );
        return {
          eventId: input.eventId,
          mode: 'vector',
          items: this.mapHits(hits),
        };
      }
    }

    const tags = event.getTags().map((tag) => tag.getTag());
    if (tags.length > 0) {
      const tagHits = await this.eventEmbeddingStore.findRecentBySharedTags({
        userId: input.userId,
        eventId: input.eventId,
        tags,
        limit,
      });
      if (tagHits.length > 0) {
        this.logger.log(
          structuredLog('similar.tags_fallback', {
            eventId: input.eventId,
            userId: input.userId,
            hitCount: tagHits.length,
          }),
        );
        return {
          eventId: input.eventId,
          mode: 'tags',
          items: this.mapHits(tagHits),
        };
      }
    }

    const domain = extractDomainFromMetadata(event.getMetadata());
    if (domain) {
      const domainHits = await this.eventEmbeddingStore.findRecentByDomain({
        userId: input.userId,
        eventId: input.eventId,
        domain,
        limit,
      });
      if (domainHits.length > 0) {
        this.logger.log(
          structuredLog('similar.domain_fallback', {
            eventId: input.eventId,
            userId: input.userId,
            hitCount: domainHits.length,
          }),
        );
        return {
          eventId: input.eventId,
          mode: 'domain',
          items: this.mapHits(domainHits),
        };
      }
    }

    this.logger.warn(
      structuredLog('similar.not_ready', {
        eventId: input.eventId,
        userId: input.userId,
      }),
    );

    return {
      eventId: input.eventId,
      mode: 'semantic_index_not_ready',
      items: [],
    };
  }

  private mapHits(hits: SimilarEventHit[]) {
    return hits.map((hit) => ({
      eventId: hit.eventId,
      similarity: Number.isFinite(hit.similarity) ? hit.similarity : null,
      occurredAt: hit.occurredAt.toISOString(),
      type: hit.eventType,
      metadata: hit.metadata,
      tags: hit.tags,
    }));
  }
}
