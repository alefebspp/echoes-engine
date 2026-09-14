# 02 — Cursor-based pagination

**Goal for Echoes:** `GET /api/v1/events` (and similar lists) must stay fast and stable as a user accumulates months of browsing history.

---

## Concept

**Pagination** = return a slice of a large ordered result set, plus a way to ask for the next slice.

Two common strategies:

| | Offset (`LIMIT 20 OFFSET 10000`) | Cursor / keyset |
|---|----------------------------------|-----------------|
| Idea | Skip N rows, take M | “Give me M rows **after** this last key” |
| Cost | Skip work grows with page depth | Index seek to the key, then scan M rows |
| Stability | Concurrent inserts can skip/duplicate rows across pages | Stable if sort key is unique and monotonic for the query |
| API | `?page=500` | `?cursor=...&limit=20` |

**Cursor-based (keyset) pagination** encodes the sort position of the last item you saw (for Echoes: `occurred_at` + `id`) and uses that in `WHERE` for the next page.

---

## Why offset fails (intuition)

Imagine events ordered newest-first. You fetch page 1 (`OFFSET 0 LIMIT 20`). While the client reads, 5 new events insert at the top. Page 2 (`OFFSET 20`) skips a different set of rows — the client may **miss** or **repeat** events.

Worse at scale: `OFFSET 100000` still makes the database walk/skip ~100k index entries before returning 20 rows. Deep pages get slower even when page size is small.

---

## Echoes cursor design

**Stable order (newest first):**

```sql
ORDER BY occurred_at DESC, id DESC
```

Why both columns?

- `occurred_at` alone is **not unique** (many events can share a timestamp).
- `id` (UUID) breaks ties so each row has a unique position in the sort.
- Together they form a **seek key**.

**Next page predicate** (after the client saw a row with `(occurred_at, id) = (:t, :id)`):

```sql
SELECT *
FROM events
WHERE user_id = :userId
  AND (occurred_at, id) < (:t, :id)   -- tuple comparison, DESC order
ORDER BY occurred_at DESC, id DESC
LIMIT :limit;
```

For **oldest-first** lists, flip the comparison and `ASC`.

**First page:** no cursor → omit the tuple predicate, same `ORDER BY` + `LIMIT`.

**`nextCursor`:** if you got `limit` rows, encode the last row’s `(occurred_at, id)`; if fewer than `limit`, `nextCursor = null` (end of list).

---

## Encoding the cursor

Two valid styles:

1. **Opaque** — Base64(JSON/`occurredAt|id`). Client treats it as a black box. Prefer this in public APIs so you can change internals.
2. **Structured** — explicit query params (`occurredAt` + `id`). Easier to debug; couples clients to sort shape.

Always:

- Validate/decode server-side; reject garbage with `400`.
- Scope every query by **authenticated `user_id`** (never trust a cursor from another user without checking).
- Cap `limit` (e.g. max 100).

Example response shape:

```json
{
  "items": [ /* EventListItemDto */ ],
  "nextCursor": "eyJvY2N1cnJlZEF0IjoiMjAyNi0wOC0yMFQxMiowMDowMC4wMDBaIiwiaWQiOiIuLi4ifQ"
}
```

---

## Filters + cursors

Date range, tag, type filters must appear in **both** the first page and subsequent pages. The cursor only encodes position **within that filtered order**.

```sql
WHERE user_id = :userId
  AND occurred_at >= :from
  AND occurred_at < :to
  AND (occurred_at, id) < (:cursorTime, :cursorId)
ORDER BY occurred_at DESC, id DESC
LIMIT :limit;
```

If the client **changes filters**, they must start over (no cursor, or a cursor from the old filter is invalid — detect and reject or ignore).

Tag filter usually needs a join to `event_tags`. Same rule: fixed filter set + keyset on the ordered event keys.

---

## Concurrent inserts (why cursor is stabler)

With keyset “rows strictly older than the last key”:

- New events with **newer** `occurred_at` appear on a **later refresh of page 1**, not as duplicates mid-scroll of an older page.
- You do not “skip ahead” the way growing `OFFSET` does when rows are inserted above the window.

Document for the UI: infinite scroll follows history; a pull-to-refresh reloads from the head.

---

## Relation to indexes

Cursor pagination without a matching index still scans. Echoes already sketches:

```sql
CREATE INDEX idx_events_user_occurred_at
ON events(user_id, occurred_at DESC);
```

For keyset on `(occurred_at, id)`, prefer including `id` in the index (see [06-index-design.md](./06-index-design.md)):

```sql
CREATE INDEX idx_events_user_occurred_at_id
ON events (user_id, occurred_at DESC, id DESC);
```

---

## Offset is not forbidden forever

Offset is fine for:

- Tiny admin lists.
- “Jump to page 7 of 10” UIs with small totals.

For the **personal event history** product surface, default to cursor. Do not use offset for the main `GET /events` contract.

---

## Common mistakes

1. Ordering by `occurred_at` only → duplicate/missing rows when timestamps collide.
2. Using `OFFSET` because “it’s simpler” before measuring — then shipping it.
3. Mutable cursors (encoding page number) — that is offset in disguise.
4. Forgetting `user_id` in `WHERE` when seeking by cursor.
5. Returning a `nextCursor` when the last page was short (false “maybe more”).

---

## Exit criteria

- [ ] You can explain why deep `OFFSET` gets expensive and unstable under inserts.
- [ ] You can write next-page SQL with `(occurred_at, id)` for newest-first Echoes lists.
- [ ] You know how `nextCursor` is produced and when it is `null`.

## Explain-back (5 minutes)

> “We page events with a keyset on `occurred_at DESC, id DESC`. The client sends an opaque cursor of the last row; we seek with tuple comparison and the composite index. Offset would skip/duplicate under concurrent ingest and slow down deep pages.”

## Practice

Write the request/response contract for `GET /api/v1/events`:

- query params: `limit`, `cursor`, optional `from` / `to` / `tag`
- max limit
- empty list vs end of list (`nextCursor: null`)

## Next

[06-index-design.md](./06-index-design.md) — indexes that make this query (and filters) cheap.
