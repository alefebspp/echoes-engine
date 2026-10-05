export type EventEmbeddingRecord = {
  eventId: string;
  userId: string;
  model: string;
  dimensions: number;
  contentHash: string;
  embeddedAt: Date;
};

export type SimilarEventHit = {
  eventId: string;
  userId: string;
  similarity: number;
  occurredAt: Date;
  eventType: string;
  metadata: Record<string, unknown>;
  tags: string[];
};

export type RetrievalFilters = {
  from?: Date;
  to?: Date;
  tags?: string[];
  domain?: string;
};

export type UpsertEventEmbeddingParams = {
  eventId: string;
  userId: string;
  vector: number[];
  model: string;
  dimensions: number;
  contentHash: string;
};

/**
 * Persistence + similarity for event embeddings. Every query must scope by userId.
 */
export interface EventEmbeddingStore {
  findByEventId(
    eventId: string,
    userId: string,
  ): Promise<EventEmbeddingRecord | null>;

  upsert(params: UpsertEventEmbeddingParams): Promise<void>;

  findSimilarByVector(params: {
    userId: string;
    vector: number[];
    model: string;
    limit: number;
    excludeEventId?: string;
    filters?: RetrievalFilters;
    minSimilarity?: number;
  }): Promise<SimilarEventHit[]>;

  findSimilarByEventId(params: {
    userId: string;
    eventId: string;
    limit: number;
    minSimilarity?: number;
  }): Promise<SimilarEventHit[]>;

  findRecentBySharedTags(params: {
    userId: string;
    eventId: string;
    tags: string[];
    limit: number;
  }): Promise<SimilarEventHit[]>;

  findRecentByDomain(params: {
    userId: string;
    eventId: string;
    domain: string;
    limit: number;
  }): Promise<SimilarEventHit[]>;
}
