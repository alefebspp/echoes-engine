import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  EventsListReadStore,
  ListEventsQuery,
  ListEventsResult,
} from 'src/domain/ports/events-list-read-store';
import { encodeEventCursor } from 'src/infrastructure/common/event-cursor';
import { EventOrmEntity } from './entities/event.entity';

type EventListRow = {
  id: string;
  eventType: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  sourceCode: string;
  tags: string[] | null;
};

@Injectable()
export class TypeOrmEventsListReadStore implements EventsListReadStore {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly eventsRepository: Repository<EventOrmEntity>,
  ) {}

  async list(query: ListEventsQuery): Promise<ListEventsResult> {
    const params: unknown[] = [query.userId];
    let paramIndex = 2;

    let sql = `
      SELECT
        e.id AS id,
        e.event_type AS "eventType",
        e.occurred_at AS "occurredAt",
        e.metadata AS metadata,
        es.code AS "sourceCode",
        COALESCE(
          array_agg(DISTINCT et.tag) FILTER (WHERE et.tag IS NOT NULL),
          '{}'
        ) AS tags
      FROM events e
      INNER JOIN event_sources es ON es.id = e.source_id
      LEFT JOIN event_tags et ON et.event_id = e.id
      WHERE e.user_id = $1
    `;

    if (query.from) {
      sql += ` AND e.occurred_at >= $${paramIndex}`;
      params.push(query.from.toISOString());
      paramIndex += 1;
    }

    if (query.to) {
      sql += ` AND e.occurred_at < $${paramIndex}`;
      params.push(query.to.toISOString());
      paramIndex += 1;
    }

    if (query.tag) {
      sql += ` AND EXISTS (
        SELECT 1 FROM event_tags tag_filter
        WHERE tag_filter.event_id = e.id AND tag_filter.tag = $${paramIndex}
      )`;
      params.push(query.tag);
      paramIndex += 1;
    }

    if (query.cursor) {
      sql += ` AND (e.occurred_at, e.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(
        query.cursor.occurredAt.toISOString(),
        query.cursor.id,
      );
      paramIndex += 2;
    }

    sql += `
      GROUP BY e.id, e.event_type, e.occurred_at, e.metadata, es.code
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT $${paramIndex}
    `;
    params.push(query.limit);

    const rows = (await this.eventsRepository.query(sql, params)) as EventListRow[];

    const items = rows.map((row) => ({
      id: row.id,
      type: row.eventType,
      occurredAt: row.occurredAt.toISOString(),
      source: row.sourceCode,
      metadata: row.metadata,
      tags: row.tags ?? [],
    }));

    let nextCursor: string | null = null;
    if (rows.length === query.limit) {
      const last = rows[rows.length - 1];
      nextCursor = encodeEventCursor({
        occurredAt: last.occurredAt.toISOString(),
        id: last.id,
      });
    }

    return { items, nextCursor };
  }
}
