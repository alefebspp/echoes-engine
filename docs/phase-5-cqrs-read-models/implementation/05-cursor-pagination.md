# 05 — Cursor pagination implementation

**Concept:** Keyset pagination on `(occurred_at DESC, id DESC)` for stable, scalable event history.

## API

`GET /api/v1/events`

| Query param | Purpose |
|-------------|---------|
| `limit` | Page size (1–100, default 20) |
| `cursor` | Opaque base64url token |
| `from` / `to` | ISO date bounds |
| `tag` | Filter by tag |

DTO: `src/presentation/event/dto/list-events-query.dto.ts`

Controller: `src/presentation/event/event.controller.ts` (GET handler decodes cursor, returns 400 on invalid).

## Handler

`ListEventsQueryHandler` clamps limit and delegates to `TypeOrmEventsListReadStore`.

## SQL (keyset)

`src/infrastructure/typeorm/events-list-read-store.ts`:

```sql
WHERE e.user_id = $1
  AND (e.occurred_at, e.id) < ($cursorTime, $cursorId)  -- next page
ORDER BY e.occurred_at DESC, e.id DESC
LIMIT $limit
```

First page omits the tuple predicate. Filters (`from`, `to`, `tag`) apply on every page.

## Cursor encoding

| Function | File |
|----------|------|
| `encodeEventCursor` | `src/infrastructure/common/event-cursor.ts` |
| `decodeEventCursor` | same |
| `InvalidEventCursorException` | same |

Payload: `{ occurredAt: ISO string, id: uuid }` → base64url.

Tests: `src/infrastructure/common/event-cursor.spec.ts`.

## Response shape

```json
{
  "items": [ { "id", "type", "occurredAt", "source", "metadata", "tags" } ],
  "nextCursor": "..." | null
}
```

`nextCursor` is `null` when fewer than `limit` rows returned (end of list).

## How the concept applies

- **Offset avoided** for main event history — deep pages would scan/skip and duplicate under concurrent ingest.
- **`id` tie-breaks** non-unique `occurred_at` timestamps.
- Cursor is **opaque** so sort internals can evolve without breaking clients.

See [06-index-design](./06-index-design.md) for the matching composite index.
