# 03 — Index design for query patterns

**Rule:** indexes follow **real** `WHERE` + `ORDER BY` (+ join keys). Never index “because maybe later.”

---

## Concept

An **index** is a separate structure that lets PostgreSQL find rows without scanning the whole table. Cost:

- **Read benefit** when the planner can seek/filter via the index.
- **Write cost** on every `INSERT`/`UPDATE`/`DELETE` that touches indexed columns.
- **Storage** on disk.

Good design = each index earns its keep for a committed API query. Bad design = many overlapping indexes that slow ingest (your hottest write path).

---

## Start from queries, not from tables

For Phase 5, name the queries first:

| Query | Typical predicate / order |
|-------|---------------------------|
| List events (cursor) | `user_id = ?` + `ORDER BY occurred_at DESC, id DESC` + keyset |
| List by date range | same + `occurred_at` bounds |
| Filter by tag | join `event_tags` on `event_id` / filter `tag` |
| Filter JSON metadata | e.g. `metadata->>'domain' = ?` (only if product commits to it) |
| Daily stats read | `user_id + date` on **projection** table (PK/unique often enough) |

Then ask: “Which index makes this seek + ordered scan?”

---

## What you already have (`initial-sql.md`)

Relevant pieces today:

```sql
CREATE INDEX idx_events_user
ON events(user_id);

CREATE INDEX idx_events_occurred_at
ON events(occurred_at DESC);

CREATE INDEX idx_events_user_occurred_at
ON events(user_id, occurred_at DESC);

CREATE INDEX idx_events_metadata_gin
ON events USING GIN (metadata);

CREATE INDEX idx_event_tags_event ON event_tags(event_id);
CREATE INDEX idx_event_tags_tag ON event_tags(tag);
```

**How to read this:**

- `idx_events_user_occurred_at` is the workhorse for “this user’s timeline.”
- Standalone `idx_events_user` and `idx_events_occurred_at` may be **redundant** once the composite exists — candidates to drop later if `EXPLAIN` never uses them (measure before dropping).
- GIN on `metadata` helps **containment / key existence** style JSONB queries, not every `->>` equality. See below.

---

## Composite indexes and left-prefix

For `(user_id, occurred_at DESC, id DESC)`:

| Can use index | Query shape |
|---------------|-------------|
| Yes | `WHERE user_id = ? ORDER BY occurred_at DESC, id DESC` |
| Yes | `WHERE user_id = ? AND occurred_at < ? ...` |
| Poorly / no | `WHERE occurred_at > ?` alone (leading column missing) |
| Poorly / no | `ORDER BY occurred_at` without `user_id` filter |

**Echoes list API always filters by authenticated user** → leading `user_id` is correct.

**Upgrade for cursors:** include `id` so the planner can satisfy the full sort without a heap sort of a large set:

```sql
CREATE INDEX idx_events_user_occurred_at_id
ON events (user_id, occurred_at DESC, id DESC);
```

That matches [05-cursor-pagination.md](./05-cursor-pagination.md).

---

## GIN on JSONB `metadata`

```sql
CREATE INDEX idx_events_metadata_gin
ON events USING GIN (metadata);
```

**Good for:**

- `@>` containment: `metadata @> '{"browser":"chrome"}'::jsonb`
- Some `?` / `?&` key-exists operators

**Weak / wrong expectation:**

- Bare `metadata->>'domain' = 'github.com'` often wants a **expression (btree) index** if that filter is a first-class product filter:

```sql
CREATE INDEX idx_events_user_domain
ON events (user_id, (metadata->>'domain'));
```

Only add expression indexes for filters you **promise** in the API. Dashboard “top domains” is usually better served by a **projection** (pre-aggregated), not by scanning events with a domain index on every request.

---

## Tags

Listing “events with tag X for user U” typically:

```sql
FROM events e
JOIN event_tags t ON t.event_id = e.id
WHERE e.user_id = :userId AND t.tag = :tag
ORDER BY e.occurred_at DESC, e.id DESC
```

Indexes that help:

- `event_tags(tag)` or better `(tag, event_id)` depending on selectivity.
- Events side: `(user_id, occurred_at DESC, id DESC)` still matters after the join.

Alternatively, a **tag stats projection** answers analytics without joining every time; the list endpoint may still need the join.

---

## Projection tables need indexes too

Example daily stats:

```sql
-- conceptual
CREATE TABLE user_daily_stats (
  user_id UUID NOT NULL,
  date    DATE NOT NULL,
  event_count INT NOT NULL,
  PRIMARY KEY (user_id, date)
);
```

The primary key **is** the index for `WHERE user_id = ? AND date BETWEEN ? AND ?`. Do not add a duplicate `(user_id, date)` index.

---

## How to verify (habit)

1. Write the SQL the query handler will run.
2. `EXPLAIN (ANALYZE, BUFFERS)` with realistic volume (seed 10k+ events — Week 4 activity).
3. Look for `Index Scan` / `Index Only Scan` on your composite, not `Seq Scan` on `events` for a single user list.
4. If the planner ignores your index, check: wrong column order, low statistics, or query that does not match left-prefix.

Dev with 50 rows lies. “Postgres is fast” is not an index strategy.

---

## Common mistakes

1. Indexing every column “just in case” → slower ingest, little read gain.
2. Skipping indexes because local data is tiny.
3. GIN on JSONB assumed to optimize every metadata filter.
4. Ordering by columns not in the index → sort memory / slow pages.
5. Forgetting `user_id` as leading column on multi-tenant tables.

---

## Exit criteria

- [ ] You can justify each proposed index with a concrete Echoes query.
- [ ] You know why `(user_id, occurred_at DESC, id DESC)` fits cursor pagination.
- [ ] You know when GIN helps vs when you need an expression index or a projection instead.

## Explain-back (5 minutes)

> “Indexes are designed from the list and analytics queries. The events timeline uses a composite on user + time + id for keyset pagination. GIN supports JSONB containment; equality on one metadata field needs an expression index or, better, a read model. We prove with EXPLAIN on seeded volume.”

## Practice

Against [initial-sql.md](../initial-sql.md), write a short index plan:

- Keep / replace / drop for the list API.
- One sentence each for GIN and for `event_tags`.

## Next

[07-materialized-views.md](./07-materialized-views.md) — when precomputing moves into the database.
