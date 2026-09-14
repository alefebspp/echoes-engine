# Phase 5 — Study answers

Companion: [README](./README.md) · teaching notes [01](./01-cqrs.md)–[09](./09-emerging-topics.md)

---

## CQRS: light form; Echoes command vs query map

**My answer**

We use the light form because echoes dont need yet a database dedicated to commands or queries.
Everything related to mutation is a command. So, the endpoint to create a event is a command. The creation of a read model can be placed on the command, but the processing must be async so the http request dont get lazy because of a process that could be delayed. A Decicade query must be created so the dashboard endpoint get the data from the new table created from the read model.

**Observations**

- **Mostly correct.** Light CQRS (one Postgres, separate paths) is the right default for Echoes at current scale.
- **Async insight is good** — ingest must not wait for analytics. That matches Phase 4 boundaries.
- **Refine one phrase:** read-model updates should not run inside the HTTP command handler. The command path persists the event and emits `EventIngested`; **projection handlers** (workers) update read tables asynchronously. The command *causes* updates indirectly, but does not *perform* them on the request thread.
- **Name concrete examples** from the notes: command = `SubmitEventUseCase`; queries = `ListEventsQueryHandler`, `GetDailyStatsQueryHandler`, `GetTagStatsQueryHandler`, `GetDashboardQueryHandler`.
- Minor typo: "Decicade" → "Dedicated".

---

## Projections: schema from UI; idempotent async updates

**My answer**

About the schema, i think i would convert the current endpoint response:

```typescript
export type DashboardStats = {
  timezone: string;
  periodDays: number;
  summary: {
    totalEvents: number;
    eventsToday: number;
    eventsLast7Days: number;
    eventsLast30Days: number;
    activeDays: number;
    currentStreak: number;
    untaggedEvents: number;
    firstTrackedAt: string | null;
    lastTrackedAt: string | null;
    averageEventsPerActiveDay: number;
  };
  eventsByDay: Array<{ date: string; count: number }>;
  categoryBreakdown: Array<{ tag: string; count: number; percentage: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  topBrowsers: Array<{ browser: string; count: number }>;
  eventsBySource: Array<{
    sourceCode: string;
    sourceName: string;
    count: number;
  }>;
  activityByHour: Array<{ hour: number; count: number }>;
};
```

Into a table for each property. For example, topDomains, topBrowsers, eventsBySource, would become a read model with a event_id attached to it to garantee the idempotency. The event_id column would have a unique constraint. Would not return the periodDays, because this is only a filter param.

**Observations**

- **Good:** starting from the current `DashboardStats` response and treating `periodDays` as a filter param (not stored) is correct.
- **Good:** thinking about idempotency under retries — important for async handlers.
- **Main gap — schema shape:** a projection is **not** a denormalized copy of events with one row per event per domain/browser. It is a **pre-aggregated** table shaped for a query pattern. Example:

  ```text
  user_daily_stats     (user_id, date, event_count)           — eventsByDay, summary counts
  user_tag_stats       (user_id, tag, event_count)             — categoryBreakdown
  user_domain_stats    (user_id, domain, event_count)          — topDomains
  user_browser_stats   (user_id, browser, event_count)       — topBrowsers
  ```

- **Idempotency nuance:** attaching `event_id` to every rollup row does not match how aggregations work. Idempotency means a **duplicate `EventIngested`** must not double-count. Common strategies: processed-event ledger `(event_id)` unique; upsert on natural key `(user_id, date)` with careful increment; recompute for a narrow key (heavier).
- **Missing timeline:** T0 ingest accepted → T1 daily count +1 (tags maybe empty) → T2 tagging finishes → tag/category projections catch up. Tag stats often need a **second handler** when tags land.
- **Do not** update projections inside `SubmitEventUseCase` on the HTTP path — same async boundary as enrichment.

---

## Eventual consistency: staleness contract written

**My answer**

Dashboard data can be delayed

**Observations**

- **Too thin** for the exit criteria. The study asks for a contract a frontend can implement against, not just a one-liner.
- **Expand to something like:**

  > Analytics and dashboard aggregates are eventually consistent with ingest. After `POST /events`, daily and tag stats usually update within a few seconds once async handlers run. Tag-dependent breakdowns may lag until enrichment completes. Responses may include `asOf` / `generatedAt`. The events list may show a row before projections reflect it.

- **Distinguish lag from bugs:**

  | Observation | OK? |
  |-------------|-----|
  | New event in list, daily count not +1 yet | Yes — projection lag |
  | Daily count +1, tag breakdown unchanged | Yes — waiting on tagging |
  | POST succeeded but event missing from DB | No — write-path bug |
  | Double-count after retries | No — idempotency bug |

- Eventual consistency is **not** "the database might lose your event." The write is durable immediately; only read projections lag.

---

## Query handlers: name 2–3; none mutate domain state

**My answer**

Looking to the current dashboard response, i would have the following query handlers:

GetTotalEventsQueryHandler -> That would return the value of totalEvents, eventsToday, eventsLast7Days and eventLast30Days
ListEventsQueryHandler -> eventsBySource

As i understand, a query handler will have the purpose of returning the data of a read model in way that no data gets mutated. We have dedicated SQL queries for that query handler.

**Observations**

- **Correct core rule:** query handlers read only; they never mutate domain state, outbox, or queues. Dedicated SQL against a read store is the right model.
- **Handler inventory needs fixing.** Target map from the notes:

  | Handler | Reads from | Serves |
  |---------|------------|--------|
  | `ListEventsQueryHandler` | Indexed `events` (+ tag join if filtered) | `GET /events` — paginated event **history** |
  | `GetDailyStatsQueryHandler` | `user_daily_stats` projection | Daily counts, `eventsByDay` |
  | `GetTagStatsQueryHandler` | Tag rollup projection | `categoryBreakdown` |
  | `GetDashboardQueryHandler` | Composes the above | `GET /dashboard` |

- **`ListEventsQueryHandler` → `eventsBySource` is wrong.** `eventsBySource` is an analytics breakdown. The list handler serves paginated browsing history with cursor pagination on `events`.
- **`GetTotalEventsQueryHandler` is not in the target inventory.** Prefer `GetDailyStatsQueryHandler` reading from `user_daily_stats`; summary rollups (`totalEvents`, `eventsToday`, etc.) can be derived from that projection or composed by `GetDashboardQueryHandler`.
- **Need at least three handlers** named with correct table mappings.

---

## Cursor pagination: offset failure + `(occurred_at, id)` SQL

**My answer**

Offset is good to a limited amount of data. When we have a big amount of data, the database needs to pass through all data to get to a specific point. Cursor pagination is better because we have a reference. With the help of indexes, the database will start returning data after the point the cursor pagination used as reference.

CREATE INDEX idx_events ON events (occurred_at, id)

**Observations**

- **Correct on performance:** deep `OFFSET` forces the database to skip many rows; cost grows with page depth.
- **Missing stability problem:** concurrent inserts at the top can cause **skipped or duplicated rows** across offset pages. Keyset pagination avoids that — important for Echoes ingest while the user scrolls history.
- **Missing why both columns:** `occurred_at` alone is not unique (many events share a timestamp). `id` breaks ties for a stable sort position.
- **Add next-page SQL** (newest first):

  ```sql
  WHERE user_id = :userId
    AND (occurred_at, id) < (:t, :id)
  ORDER BY occurred_at DESC, id DESC
  LIMIT :limit;
  ```

- **Index is incomplete.** Echoes list API always scopes by authenticated user — leading column must be `user_id`:

  ```sql
  CREATE INDEX idx_events_user_occurred_at_id
  ON events (user_id, occurred_at DESC, id DESC);
  ```

- Also worth noting: `nextCursor` encodes the last row's `(occurred_at, id)`; `null` when the page is shorter than `limit` (end of list).

---

## Indexes: justify composite + when GIN helps

**My answer**

Indexes are a additional data structure that gets created in the database. They help improve the performance of the search. A index must be created analyzing first the query we want to improve. We cant create index for each column of a table, because the insert operations gets heavier since the data structure of the index must be updated. Use statements like EXPLAIN ANALISE will help to understand exactly what we need for the index. We can choose a composite index when our SQL demands it. A SQL that involves a WHERE, ORDER BY or GROUP BY will have the necessity to involve the columns that are used in those statements in the composite index. About the GIN, this type of index is recommended for columns that use JSONB.

**Observations**

- **Solid conceptual foundation:** design from real queries, weigh read benefit vs write cost, use `EXPLAIN ANALYZE`, composite indexes match `WHERE`/`ORDER BY`/`GROUP BY`.
- **Add Echoes-specific example:** `(user_id, occurred_at DESC, id DESC)` earns its keep for cursor pagination on `GET /events`.
- **GIN nuance:** GIN on JSONB helps `@>` containment and key-existence (`?`, `?&`). Bare `metadata->>'domain' = ?` often needs an **expression btree index** — or, better for dashboard "top domains", a **projection table** instead of scanning events on every request.
- **Left-prefix rule:** `(user_id, occurred_at, id)` cannot efficiently serve `WHERE occurred_at > ?` without a `user_id` filter.
- **Projection PKs are indexes:** `(user_id, date)` primary key on `user_daily_stats` is enough — do not add a duplicate index.
- Minor typo: "ANALISE" → "ANALYZE".

---

## Materialized views: refresh on schedule, not per insert

**My answer**

Materialized views are a already constructured SQL query that calculates a data and persists that calculation. The database has a refresh time of that data and it does not occurs on every insert of new data. Comparing the Projections tables, i would say that we do not have the full control of the sync of the data. The advantage of using Projections table is that we will have this control. Having control means that we eventualy and soon will have the data updated. With materialized views, a good use case is to use this mechanism if the data dont have to be updated fast, but we have something that updates like for 1 or 2h or so.

**Observations**

- **Good overall understanding:** MV = persisted query snapshot; refresh on schedule, not per insert; projections give finer incremental control; MV fits slower staleness (1–2h).
- **Echoes placement:** daily/tag counters → projection tables (Phase 5a); weekly rollups over long history → MV candidate (Phase 5b) only if measured query cost justifies it.
- **Optional depth:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a **UNIQUE index** on the MV. Without it, refresh blocks reads (simple refresh) or `CONCURRENTLY` fails.
- **Do not refresh per insert** — that turns ingest into "recompute the world" and defeats both Phase 4 async and Phase 5a incremental projections.

---

## Table vs MV judgment: ADR-ready daily vs weekly choice

**My answer**

*(not answered yet)*

**Observations**

- **Still open** on the README checklist. Draft when ready:

  | Product need | Mechanism |
  |--------------|-----------|
  | Events per day | Projection `user_daily_stats` |
  | Time/count per tag | Projection tag rollup |
  | Paginated event history | Indexed `events` + cursor (not MV) |
  | Weekly activity over long history | MV if live aggregate is slow |

- **Decision heuristic:**

  ```
  One event → touch a few rows?  → projection + idempotent handler
  Heavy multi-table rollup + hours of lag OK?  → MV on a schedule
  ```

- See [08-table-vs-mv-judgment.md](./08-table-vs-mv-judgment.md) for ADR outline (`docs/adr/0005-read-model-strategy.md`).
