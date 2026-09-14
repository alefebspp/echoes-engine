# Phase 5 — CQRS, read models & analytics concepts

Teaching notes for **Phase 5 (Analytics)** of Echoes Engine: CQRS, projections, eventual consistency, query handlers, pagination, indexes, materialized views, and judgment calls.

Companion: [phase-5-study-plan.md](../phase-5-study-plan.md) · [learning-walkthrough.md — Phase 5](../learning-walkthrough.md#phase-5--analytics) · [api-endpoints.md](../api-endpoints.md) · [initial-sql.md](../initial-sql.md)

---

## How to use this folder

Read in order. Each note is self-contained, Echoes-flavored, and ends with exit criteria and a short explain-back.

| # | File | Concept | Study plan week |
|---|------|---------|-----------------|
| 1 | [01-cqrs.md](./01-cqrs.md) | CQRS (light vs heavy) | Week 1 |
| 2 | [02-read-models-projections.md](./02-read-models-projections.md) | Read models / projections | Week 2 |
| 3 | [03-eventual-consistency.md](./03-eventual-consistency.md) | Eventual consistency (read side) | Week 2 |
| 4 | [04-query-handlers.md](./04-query-handlers.md) | Query handlers / query objects | Week 1 |
| 5 | [05-cursor-pagination.md](./05-cursor-pagination.md) | Cursor-based pagination | Week 3 |
| 6 | [06-index-design.md](./06-index-design.md) | Index design for query patterns | Week 3 |
| 7 | [07-materialized-views.md](./07-materialized-views.md) | Materialized views + scheduled refresh | Week 4 |
| 8 | [08-table-vs-mv-judgment.md](./08-table-vs-mv-judgment.md) | Projection table vs MV + ADR | Week 4 |
| 9 | [09-emerging-topics.md](./09-emerging-topics.md) | Cache-aside, retention, export, recursive CTEs | Week 4 optional |

If you already know CQRS / projections / eventual consistency, skim **01–03** as a refresh, then continue from **04**.

**Implementation (code):** [implementation/](./implementation/) — maps each concept to files in this repo after Phase 5 build-out.

---

## Mental model

```
WRITE (command)                         READ (query)
───────────────                         ────────────
POST /events                            GET /events
  → SubmitEventUseCase                    → ListEventsQueryHandler   ← query handler
  → Event + outbox EventIngested           → cursor (occurred_at, id) ← pagination
  → async projection updater               → indexes match WHERE/ORDER ← indexes
                                         GET /analytics/daily
                                           → reads user_daily_stats   ← projection
                                         GET /analytics/weekly (later)
                                           → reads MV snapshot        ← materialized view
```

**Implementation order when you code** (do not invert):

1. Query handlers for reads  
2. Projection tables + idempotent `EventIngested` handlers  
3. Analytics GETs reading projections  
4. Events list with cursor + indexes  
5. MV only if measured pain + scheduled refresh  
6. ADR documenting table vs MV  

---

## Progress checklist

- [ ] CQRS: light form; Echoes command vs query map  
- [ ] Projections: schema from UI; idempotent async updates  
- [ ] Eventual consistency: staleness contract written  
- [ ] Query handlers: name 2–3; none mutate domain state  
- [ ] Cursor pagination: offset failure + `(occurred_at, id)` SQL  
- [ ] Indexes: justify composite + when GIN helps  
- [ ] Materialized views: refresh on schedule, not per insert  
- [ ] Judgment: ADR-ready daily vs weekly choice  
- [ ] Emerging: skim all four; deep-dive one if time  

---

*Aug 2026 · Phase 5 analytics concept notes*
