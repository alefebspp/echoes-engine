# 01 — Query handlers / query objects

**Prerequisite:** [01-cqrs.md](./01-cqrs.md) — commands mutate; queries never do.  
**This note:** how the *query side* looks in the application layer for Echoes.

---

## Concept

A **query handler** (sometimes called a **query object**) is an application-layer unit that:

1. Accepts a read intent (filters, cursor, user id, date range).
2. Loads data from a **read store** (projection table, indexed `events`, or later an MV).
3. Returns a DTO / response shape.
4. **Never** mutates domain aggregates, never writes outbox rows, never enqueues jobs.

It is the read twin of a use case like `SubmitEventUseCase`. Same “application orchestrates” idea — different responsibility.

| | Command use case | Query handler |
|---|------------------|---------------|
| Verb | Submit, Enrich, Assign | List, Get, Search |
| Domain | Load aggregate → behavior → save | No aggregate mutation |
| Side effects | DB writes, outbox, queues | None (or metrics only) |
| Store | Write model (`events`, outbox) | Read model / indexed tables / MV |
| Failure meaning | Business rule or durability | Not found / empty page |

---

## Why it matters in Echoes

The browser extension **only writes**. The dashboard **only reads**. If you put `SUM(*)` / joins / “build dashboard blob” inside `SubmitEventUseCase` or a fat controller, you:

- Couple ingest latency to analytics shape.
- Tempt synchronous projection updates (undoing Phase 4).
- Hide the CQRS split so future contributors re-merge write and read.

Query handlers make the split **visible in folders and names**.

---

## Echoes inventory (target)

Concrete handlers you should be able to name without looking at code:

| Handler | API (target / related) | Reads from |
|---------|------------------------|------------|
| `ListEventsQueryHandler` | `GET /api/v1/events` | Indexed `events` (+ tags join if needed) |
| `GetDailyStatsQueryHandler` | `GET /api/v1/analytics/daily` (or part of dashboard) | `user_daily_stats` projection |
| `GetTagStatsQueryHandler` | `GET /api/v1/analytics/tags` | Tag rollup projection |
| `GetDashboardQueryHandler` | `GET /api/v1/dashboard` | Composes several read models / queries |

`GetDashboardQueryHandler` may **orchestrate** other queries or repositories — still no domain writes.

Suggested layout (sketch only):

```
src/application/
  event/
    submit-event-use-case.ts          # command (exists)
  queries/                            # or application/<area>/queries/
    list-events-query-handler.ts
    get-daily-stats-query-handler.ts
    get-tag-stats-query-handler.ts
```

Controllers for `GET` routes call **only** query handlers. Controllers for `POST /events` call **only** command use cases.

---

## Shape of a query handler

Think in inputs and outputs — not entities with setters.

```typescript
// Conceptual — not existing code yet
type ListEventsQuery = {
  userId: string;
  limit: number;          // capped, e.g. 1–100
  cursor?: string;        // opaque encoding of (occurredAt, id)
  from?: Date;
  to?: Date;
  tag?: string;
};

type ListEventsResult = {
  items: EventListItemDto[];
  nextCursor: string | null;
};

class ListEventsQueryHandler {
  constructor(private readonly eventsReadStore: EventsListReadStore) {}

  async execute(query: ListEventsQuery): Promise<ListEventsResult> {
    // 1. Decode/validate cursor + clamp limit
    // 2. Delegate to read store (SQL with keyset)
    // 3. Map rows → DTOs
    // 4. Return — no Event.create, no repository.create, no outbox
    return this.eventsReadStore.list(query);
  }
}
```

**Ports:** Prefer a read-side port (`EventsListReadStore`, `DailyStatsReadStore`) implemented in infrastructure. Do not force the write `EventRepository` to grow every dashboard join.

---

## What belongs where

| Concern | Layer |
|---------|--------|
| Clamp `limit`, parse dates, reject bad cursor format | Interface (controller/DTO) or start of query handler |
| “User may only see own events” | Query handler / auth context — always scope by `userId` from JWT |
| “How do we increment daily count?” | Domain/projection updater — **not** here |
| SQL / TypeORM | Infrastructure adapter behind a port |

Validation of **format** at the edge is fine. Business rules that change system state stay on the command path.

---

## Common mistakes

1. **“Query” that writes** — e.g. “get dashboard and refresh stats if stale.” That is a command or a scheduled job, not a query.
2. **Aggregating live in the handler forever** — OK as a short interim while projections do not exist; document it. The Phase 5 end state is: heavy aggregates come from projections/MVs.
3. **One mega `DashboardService`** that both ingests and reads — reintroduces the pre-CQRS blob.
4. **Returning domain aggregates** from queries — prefer DTOs shaped for the UI (`EventListItemDto`), not `Event` with mutation methods.

---

## Tie-back to what you know

```
EventIngested (async)
  → projection handler upserts user_daily_stats   // write to read model (allowed; separate worker)

GET /analytics/daily
  → GetDailyStatsQueryHandler
  → SELECT from user_daily_stats                  // query path never writes
```

Eventual consistency lives **between** those two paths. The query handler does not “wait for freshness”; the API contract documents lag.

---

## Exit criteria

- [ ] You can explain a query handler in one paragraph without saying “service.”
- [ ] You named at least three Echoes query handlers and what table each should hit.
- [ ] You can list three things a query handler must never do (mutate aggregate, write outbox, enqueue enrichment).

## Explain-back (5 minutes)

> “In Echoes, `SubmitEventUseCase` is a command. `ListEventsQueryHandler` is a query: it takes user id + cursor, reads indexed events, returns DTOs, and never touches the outbox. Controllers choose one or the other — never both in one method.”

## Next

[05-cursor-pagination.md](./05-cursor-pagination.md) — how `ListEventsQueryHandler` pages stably at scale.
