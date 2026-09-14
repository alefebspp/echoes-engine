# 01 — CQRS (Command Query Responsibility Segregation)

**Theme:** Separate *changing state* from *asking questions*.

---

## Concept

**CQRS** means you treat writes and reads as different responsibilities:

| | Commands | Queries |
|---|----------|---------|
| Purpose | Change system state | Answer a question |
| Side effects | Persist aggregates, outbox, jobs | None (read only) |
| Model | Write model optimized for invariants | Read model optimized for UI/API shape |
| Echoes examples | `SubmitEvent`, enrich tags | List events, daily stats, tag stats |

You do **not** need two databases, Kafka, or Redis to claim CQRS. The segregation is of **paths and models**. Same PostgreSQL with separate tables/handlers is **light CQRS** — enough for Echoes.

**Heavy CQRS** (separate read DB, async replication, different stores) is an optimization you earn with scale — premature here.

---

## Why it matters in Echoes

- Browser extension **only writes** (`POST /events`).
- Dashboard **only reads** (`GET /dashboard`, events list, analytics).
- Mixing both in one service method couples ingest latency to dashboard shape and tempts synchronous analytics updates (undoing Phase 4).

One paragraph without tools:

> Commands mutate domain state; queries never do. Echoes keeps a write path that accepts events and emits `EventIngested`, and a read path that serves lists and stats from models shaped for those questions — even if both live in one Postgres.

---

## Light vs heavy

| | Light (Echoes default) | Heavy |
|---|------------------------|-------|
| Storage | Same PostgreSQL | Separate read DB / warehouse |
| Sync | Handlers / outbox update read tables | Replication, stream processors |
| Ops cost | Low | High |
| When | Personal/MVP scale, clear read/write split | Read load or model divergence demands it |

**Anti-pattern:** “We do CQRS” by adding a second database on day one of analytics.

---

## Echoes mental model

```
WRITE (command)                         READ (query)
───────────────                         ────────────
POST /events                            GET /events
  → SubmitEventUseCase                    → ListEventsQueryHandler
  → Event aggregate                       → reads list store
  → outbox EventIngested                  → never writes domain state
  → HTTP accept

                                        GET /analytics/daily
                                          → GetDailyStatsQueryHandler
                                          → reads user_daily_stats
                                          (not SUM(*) on every request forever)
```

Commands may **indirectly** cause read-model updates via async handlers. That is still CQRS: the HTTP command path does not run the dashboard aggregate.

---

## What CQRS is not

- Not “never join tables.”
- Not “every query is a separate microservice.”
- Not incompatible with DDD — aggregates stay on the write side; read models are not aggregates.

---

## Common mistakes

1. Two databases too early.
2. Aggregating heavy stats inside `SubmitEventUseCase`.
3. A “query” that refreshes stats or writes outbox rows.
4. Calling every repository method CQRS because you renamed folders.

---

## Exit criteria

- [ ] Explain CQRS in one paragraph without Redis/Kafka/two DBs.
- [ ] Map Echoes: command = `SubmitEvent`; queries = list / daily / tags.
- [ ] Explain why light CQRS is enough for this project.

## Explain-back (5 minutes)

> “CQRS separates commands that change state from queries that only read. In Echoes, ingest is a command; dashboard and event list are queries with their own handlers and often their own tables. We use one Postgres — separate paths, not separate infrastructure.”

## Next

[02-read-models-projections.md](./02-read-models-projections.md) — tables shaped for those queries.
