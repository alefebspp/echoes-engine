import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  EventEmbeddingRecord,
  EventEmbeddingStore,
  SimilarEventHit,
  UpsertEventEmbeddingParams,
} from 'src/domain/ports/event-embedding-store';

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

type SimilarRow = {
  event_id: string;
  user_id: string;
  similarity: string | number;
  occurred_at: Date;
  event_type: string;
  metadata: Record<string, unknown>;
  tags: string[] | null;
};

@Injectable()
export class TypeOrmEventEmbeddingStore
  implements EventEmbeddingStore, OnModuleInit
{
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS event_embeddings (
        event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        embedding vector(1536) NOT NULL,
        model character varying(100) NOT NULL,
        dimensions integer NOT NULL,
        content_hash character varying(64) NOT NULL,
        embedded_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS IDX_event_embeddings_user
      ON event_embeddings (user_id)
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'idx_event_embeddings_hnsw'
        ) THEN
          CREATE INDEX IDX_event_embeddings_hnsw
          ON event_embeddings
          USING hnsw (embedding vector_cosine_ops);
        END IF;
      END
      $$;
    `);
  }

  async findByEventId(
    eventId: string,
    userId: string,
  ): Promise<EventEmbeddingRecord | null> {
    const rows = await this.dataSource.query(
      `
      SELECT event_id, user_id, model, dimensions, content_hash, embedded_at
      FROM event_embeddings
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [eventId, userId],
    );

    const row = rows[0] as
      | {
          event_id: string;
          user_id: string;
          model: string;
          dimensions: number;
          content_hash: string;
          embedded_at: Date;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      eventId: row.event_id,
      userId: row.user_id,
      model: row.model,
      dimensions: Number(row.dimensions),
      contentHash: row.content_hash,
      embeddedAt: new Date(row.embedded_at),
    };
  }

  async upsert(params: UpsertEventEmbeddingParams): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO event_embeddings (
        event_id, user_id, embedding, model, dimensions, content_hash, embedded_at
      ) VALUES (
        $1, $2, $3::vector, $4, $5, $6, NOW()
      )
      ON CONFLICT (event_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        embedding = EXCLUDED.embedding,
        model = EXCLUDED.model,
        dimensions = EXCLUDED.dimensions,
        content_hash = EXCLUDED.content_hash,
        embedded_at = NOW()
      `,
      [
        params.eventId,
        params.userId,
        toVectorLiteral(params.vector),
        params.model,
        params.dimensions,
        params.contentHash,
      ],
    );
  }

  async findSimilarByVector(params: {
    userId: string;
    vector: number[];
    model: string;
    limit: number;
    excludeEventId?: string;
    filters?: {
      from?: Date;
      to?: Date;
      tags?: string[];
      domain?: string;
    };
    minSimilarity?: number;
  }): Promise<SimilarEventHit[]> {
    const vectorLiteral = toVectorLiteral(params.vector);
    const conditions = [
      'ee.user_id = $1',
      'ee.model = $2',
      'e.user_id = $1',
    ];
    const values: unknown[] = [params.userId, params.model, vectorLiteral];
    let paramIndex = 4;

    if (params.excludeEventId) {
      conditions.push(`ee.event_id <> $${paramIndex}`);
      values.push(params.excludeEventId);
      paramIndex += 1;
    }

    if (params.filters?.from) {
      conditions.push(`e.occurred_at >= $${paramIndex}`);
      values.push(params.filters.from);
      paramIndex += 1;
    }

    if (params.filters?.to) {
      conditions.push(`e.occurred_at <= $${paramIndex}`);
      values.push(params.filters.to);
      paramIndex += 1;
    }

    if (params.filters?.domain) {
      conditions.push(
        `LOWER(regexp_replace(e.metadata->>'url', '^https?://(www\\.)?', '', 'i')) LIKE $${paramIndex}`,
      );
      values.push(`${params.filters.domain.toLowerCase()}%`);
      paramIndex += 1;
    }

    if (params.filters?.tags && params.filters.tags.length > 0) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM event_tags et
          WHERE et.event_id = e.id
            AND et.tag = ANY($${paramIndex}::text[])
        )
      `);
      values.push(params.filters.tags);
      paramIndex += 1;
    }

    if (params.minSimilarity !== undefined) {
      conditions.push(`(1 - (ee.embedding <=> $3::vector)) >= $${paramIndex}`);
      values.push(params.minSimilarity);
      paramIndex += 1;
    }

    values.push(params.limit);

    const rows = (await this.dataSource.query(
      `
      SELECT
        e.id AS event_id,
        e.user_id AS user_id,
        (1 - (ee.embedding <=> $3::vector)) AS similarity,
        e.occurred_at,
        e.event_type,
        e.metadata,
        COALESCE(
          (
            SELECT array_agg(et.tag ORDER BY et.tag)
            FROM event_tags et
            WHERE et.event_id = e.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM event_embeddings ee
      JOIN events e ON e.id = ee.event_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ee.embedding <=> $3::vector
      LIMIT $${paramIndex}
      `,
      values,
    )) as SimilarRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async findSimilarByEventId(params: {
    userId: string;
    eventId: string;
    limit: number;
    minSimilarity?: number;
  }): Promise<SimilarEventHit[]> {
    const conditions = [
      'ee.user_id = $1',
      'ref.user_id = $1',
      'ref.event_id = $2',
      'ee.event_id <> $2',
      'ee.model = ref.model',
      'e.user_id = $1',
    ];
    const values: unknown[] = [params.userId, params.eventId];
    let paramIndex = 3;

    if (params.minSimilarity !== undefined) {
      conditions.push(
        `(1 - (ee.embedding <=> ref.embedding)) >= $${paramIndex}`,
      );
      values.push(params.minSimilarity);
      paramIndex += 1;
    }

    values.push(params.limit);

    const rows = (await this.dataSource.query(
      `
      SELECT
        e.id AS event_id,
        e.user_id AS user_id,
        (1 - (ee.embedding <=> ref.embedding)) AS similarity,
        e.occurred_at,
        e.event_type,
        e.metadata,
        COALESCE(
          (
            SELECT array_agg(et.tag ORDER BY et.tag)
            FROM event_tags et
            WHERE et.event_id = e.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM event_embeddings ee
      JOIN events e ON e.id = ee.event_id
      JOIN event_embeddings ref ON ref.event_id = $2
      WHERE ${conditions.join(' AND ')}
      ORDER BY ee.embedding <=> ref.embedding
      LIMIT $${paramIndex}
      `,
      values,
    )) as SimilarRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async findRecentBySharedTags(params: {
    userId: string;
    eventId: string;
    tags: string[];
    limit: number;
  }): Promise<SimilarEventHit[]> {
    const rows = (await this.dataSource.query(
      `
      SELECT
        e.id AS event_id,
        e.user_id AS user_id,
        NULL::float AS similarity,
        e.occurred_at,
        e.event_type,
        e.metadata,
        COALESCE(
          (
            SELECT array_agg(et2.tag ORDER BY et2.tag)
            FROM event_tags et2
            WHERE et2.event_id = e.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM events e
      WHERE e.user_id = $1
        AND e.id <> $2
        AND EXISTS (
          SELECT 1 FROM event_tags et
          WHERE et.event_id = e.id
            AND et.tag = ANY($3::text[])
        )
      ORDER BY e.occurred_at DESC
      LIMIT $4
      `,
      [params.userId, params.eventId, params.tags, params.limit],
    )) as SimilarRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async findRecentByDomain(params: {
    userId: string;
    eventId: string;
    domain: string;
    limit: number;
  }): Promise<SimilarEventHit[]> {
    const rows = (await this.dataSource.query(
      `
      SELECT
        e.id AS event_id,
        e.user_id AS user_id,
        NULL::float AS similarity,
        e.occurred_at,
        e.event_type,
        e.metadata,
        COALESCE(
          (
            SELECT array_agg(et.tag ORDER BY et.tag)
            FROM event_tags et
            WHERE et.event_id = e.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM events e
      WHERE e.user_id = $1
        AND e.id <> $2
        AND LOWER(
          regexp_replace(
            COALESCE(e.metadata->>'url', ''),
            '^https?://(www\\.)?',
            '',
            'i'
          )
        ) LIKE $3
      ORDER BY e.occurred_at DESC
      LIMIT $4
      `,
      [
        params.userId,
        params.eventId,
        `${params.domain.toLowerCase()}%`,
        params.limit,
      ],
    )) as SimilarRow[];

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: SimilarRow): SimilarEventHit {
    const similarity =
      row.similarity === null || row.similarity === undefined
        ? Number.NaN
        : Number(row.similarity);

    return {
      eventId: row.event_id,
      userId: row.user_id,
      similarity,
      occurredAt: new Date(row.occurred_at),
      eventType: row.event_type,
      metadata: row.metadata ?? {},
      tags: row.tags ?? [],
    };
  }
}
