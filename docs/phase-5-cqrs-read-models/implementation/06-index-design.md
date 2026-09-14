# 06 — Index design implementation

**Concept:** Indexes follow committed query patterns (`WHERE` + `ORDER BY`), not “index everything.”

## Events list index

**Migration:** `IDX_events_user_occurred_at_id` in `src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts`

```sql
CREATE INDEX IDX_events_user_occurred_at_id
ON events (user_id, occurred_at DESC, id DESC);
```

**Entity mirror (synchronize / tests):** `@Index('IDX_events_user_occurred_at_id', …)` on `EventOrmEntity` — `src/infrastructure/typeorm/entities/event.entity.ts`.

### Why this shape

| Query need | Index column |
|------------|--------------|
| Multi-tenant scope | Leading `user_id` |
| Newest-first timeline | `occurred_at DESC` |
| Stable keyset | `id DESC` |

Matches `TypeOrmEventsListReadStore` ORDER BY and tuple comparison.

## Projection table indexes

Projection primary keys **are** the read indexes — no duplicate indexes added:

| Table | PK = index for reads |
|-------|----------------------|
| `user_daily_stats` | `(user_id, date)` |
| `user_tag_stats` | `(user_id, tag)` |
| `user_domain_stats` | `(user_id, domain)` |
| … | … |

## GIN / metadata

Phase 5 **does not** add new GIN indexes. Dashboard “top domains” is served by `user_domain_stats` (projection), not `metadata->>'domain'` scans — matching the study note that analytics filters belong in read models.

Existing GIN on `events.metadata` (from initial schema) remains for ad-hoc containment queries on the write model.

## Verification habit

When seeding volume, run `EXPLAIN (ANALYZE, BUFFERS)` on the list SQL from `events-list-read-store.ts` and confirm `Index Scan` on `IDX_events_user_occurred_at_id`.

## How the concept applies

- One composite index earns its keep for `GET /events`.
- Projection PKs cover analytics reads without extra indexes.
- Write path (ingest) pays index maintenance on `events` — acceptable for one well-chosen composite vs many redundant indexes.
