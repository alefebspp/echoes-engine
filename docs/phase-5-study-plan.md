# Phase 5 — Week-by-week study plan

Study plan for **Phase 5 (Analytics)** of Echoes Engine: learn every concept from the walkthrough before (and while) you build dashboard read APIs.

Companion: [learning-walkthrough.md — Phase 5](./learning-walkthrough.md#phase-5--analytics) · [concepts-still-to-learn.md](./concepts-still-to-learn.md) · [api-endpoints.md](./api-endpoints.md)

**Assumes:** Phase 4 concepts are known and ideally implemented (`EventIngested` → outbox → workers). Read models hang off that same event stream.

**Pace:** ~4 weeks, ~6–10 hours/week. Adjust if you already know SQL indexing or CQRS theory.

**Status legend:** ✅ Done · 🟡 In progress · ⬜ Not started

---

## What you must learn (checklist)

| # | Concept | Walkthrough role |
|---|---------|------------------|
| 1 | **CQRS** | Separate write (commands) vs read (queries) paths |
| 2 | **Read models / projections** | Denormalized tables updated by `EventIngested` handlers |
| 3 | **Eventual consistency (read side)** | Dashboard may lag writes/tags; document staleness |
| 4 | **Cursor-based pagination** | Stable paging (`occurred_at + id`) vs offset |
| 5 | **Index design for query patterns** | `user_id + occurred_at DESC`, GIN on metadata |
| 6 | **Materialized views** | Scheduled/on-demand snapshots for heavy aggregations |
| 7 | **Query handlers / query objects** | Reads that never mutate state |
| 8 | **Table vs MV judgment** | App-maintained projections first; MVs when SQL aggregations hurt |

**Emerging (Week 4 optional depth):** cache-aside, data retention, export API, recursive CTEs as a Neo4j warm-up.

---

## Prerequisites (before Week 1)

Confirm you can answer yes:

- [ ] You understand `EventIngested` and that multiple handlers can subscribe (tagging, later analytics)
- [ ] You know why projections should **not** update synchronously on the ingest HTTP path
- [ ] You can describe at-least-once delivery → projection handlers must be **idempotent**
- [ ] You have skimmed current dashboard contract in [api-endpoints.md](./api-endpoints.md) (`GET /dashboard`, event list needs)

If Phase 4 code is incomplete, you can still **study** Weeks 1–2 as theory. Do not implement projections until ingest emits a durable domain event (or a temporary in-process stub you plan to replace).

---

## Week 1 — CQRS and the query side

**Theme:** Separate *changing state* from *asking questions*.

### Goals

- Explain CQRS in one paragraph without mentioning Redis, Kafka, or two databases.
- Map Echoes: **command** = `SubmitEvent`; **queries** = list events, daily stats, tag stats.
- Know why “light CQRS” (same PostgreSQL, separate paths/models) is enough here.

### Concepts

| Concept | Learn | Done when |
|---------|-------|-----------|
| CQRS | Commands mutate; queries never do. Separate models/paths for write vs read. | You can draw write path vs read path for Echoes on paper. |
| Query handler / query object | Application layer for reads: input → load from read store → DTO out. No domain mutation. | You can name 2–3 query handlers Echoes will need. |
| Light vs heavy CQRS | Same DB + separate tables/paths vs separate read DB. | You can explain why two databases are premature for this project. |

### Study activities

1. **Read** Phase 5 “Concepts Learned” + “Common Mistakes” in the walkthrough (CQRS bullets and mistakes about dual DBs / sync projections).
2. **Write** (half page): *Why does the extension-only-write / dashboard-only-read split motivate CQRS in Echoes?*
3. **Inventory** existing code:
   - Which use cases today are commands?
   - Does `GET /dashboard` (if any) aggregate on the fly from `events`?
4. **Sketch** target folders (no code required yet):
   - `application/.../queries/` vs existing command use cases
   - Controllers that only call query handlers for reads

### Echoes mental model (Week 1)

```
WRITE (command)                         READ (query)
───────────────                         ────────────
POST /events                            GET /events
  → SubmitEventUseCase                    → ListEventsQueryHandler
  → Event aggregate                       → reads list/projection store
  → outbox EventIngested                  → never writes domain state
  → HTTP accept

                                        GET /analytics/daily
                                          → GetDailyStatsQueryHandler
                                          → reads user_daily_stats (not SUM(*) live)
```

### Week 1 exit criteria

- [ ] You can explain CQRS and why Echoes uses the light form
- [ ] You listed concrete query handlers for events list + daily + tags
- [ ] You know the anti-pattern: aggregating heavy stats inside the ingest use case or on every dashboard request without a plan

---

## Week 2 — Read models, projections, eventual consistency

**Theme:** Shape tables for the UI; update them from events; accept lag.

### Goals

- Design `user_daily_stats` (or equivalent) from **concrete dashboard questions**, not from the write schema.
- Understand projection = denormalized read table maintained by a handler on `EventIngested` (and possibly tag-assigned events).
- Define what “eventually consistent” means for the dashboard API.

### Concepts

| Concept | Learn | Done when |
|---------|-------|-----------|
| Read model / projection | Table shaped for one (or few) query patterns; not 3NF for writes. | You can write the columns for daily stats and tag stats from UI needs. |
| Projection updater | Handler consumes domain event → upsert/increment read row. Idempotent under retry. | You can describe failure + retry without double-counting. |
| Eventual consistency (read side) | Read lag behind write/enrichment is OK if documented. | You can state a staleness guarantee in API language (e.g. “seconds”). |

### Study activities

1. **List UI questions** the Phase 5 APIs must answer:
   - Events by date / paginated history
   - Time (or count) per tag
   - Weekly activity summaries
2. **Design on paper** (then optional SQL draft):
   - `user_daily_stats(user_id, date, event_count, …)` PK / unique key
   - Tag rollup table or columns driven by how `GET /analytics/tags` should look
3. **Trace consistency:**
   - T0: ingest accepted
   - T1: projection updated (event exists, maybe untagged)
   - T2: tagging worker finishes → does the projection need a second update?
4. **Document staleness** in a short note: what the client should assume; whether responses expose `asOf` / `generatedAt`.
5. **Idempotency drill:** same `EventIngested` delivered twice — how does the projection stay correct? (natural keys, upsert, processed-event table, etc.)

### Order reminder (from walkthrough)

> Build **read model tables updated by handlers first** (Phase 5a), then add materialized views when SQL aggregations become slow (Phase 5b).

Do **not** jump to MVs this week.

### Week 2 exit criteria

- [ ] Projection schema sketched from queries, not from `events` columns alone
- [ ] You can explain how `EventIngested` (and tag updates, if needed) keep projections honest
- [ ] You wrote a one-paragraph consistency / staleness contract for the read API
- [ ] You know why updating the read model inside `SubmitEventUseCase` defeats Phase 4

---

## Week 3 — Pagination, indexes, and the events list API

**Theme:** Serve large history without full scans or offset cliffs.

### Goals

- Prefer **cursor-based** pagination (`occurred_at + id`) over `OFFSET` for the events list.
- Design indexes from real `WHERE` / `ORDER BY` patterns.
- Implement or specify `GET /api/v1/events` (paginated, filterable) as a pure query path.

### Concepts

| Concept | Learn | Done when |
|---------|-------|-----------|
| Offset vs cursor pagination | Offset cost grows with page depth; cursors stay stable and cheap with the right index. | You can explain a broken page under concurrent inserts with naive offset. |
| Cursor design | Opaque or structured cursor encoding `occurred_at` + `id`; stable `ORDER BY`. | You can walk through “next page” SQL with `WHERE (occurred_at, id) < (...)`. |
| Index design | Indexes follow filters + sort, e.g. `(user_id, occurred_at DESC, id DESC)`; GIN when filtering JSONB metadata. | You can name indexes for list + any metadata filter you commit to. |

### Study activities

1. **Compare** offset vs keyset/cursor (read one solid article or Postgres docs on keyset pagination).
2. **Write** the list query contract:
   - filters (date range, tag, type?)
   - page size limits
   - cursor request/response shape
3. **Plan indexes** against [initial-sql.md](./initial-sql.md) and your filters — only indexes you can justify with a query.
4. **Seed mindset:** how you will load 10k+ events later to prove the list stays fast (script or fixture plan; run in Week 4).
5. **Optional implement:** `ListEventsQueryHandler` + controller + tests (empty projection lag is fine; list can read write model initially if documented as interim — prefer indexed `events` for list, projections for aggregates).

### Week 3 exit criteria

- [ ] You can explain why offset pagination fails at scale
- [ ] Cursor strategy is written down (`occurred_at + id`)
- [ ] Index list matches committed query patterns
- [ ] You know which reads hit raw `events` vs projection tables

---

## Week 4 — Materialized views, judgment, ADR, emerging topics

**Theme:** Pre-compute heavy rollups; choose table vs MV; lock the decision in an ADR.

### Goals

- Know what a **materialized view** is, how refresh works (schedule vs concurrent), and when it beats an app-maintained table.
- Schedule refresh mentally with `@nestjs/schedule` (or cron) — not “refresh on every insert.”
- Pass the Phase 5 readiness check in judgment even if some code is still thin.
- Skim emerging concepts so Phase 6/7 do not surprise you.

### Concepts

| Concept | Learn | Done when |
|---------|-------|-----------|
| Materialized views | Stored query result; refresh on schedule/demand; good for weekly rollups over large history. | You can contrast MV vs `user_daily_stats` handler upsert. |
| Scheduled refresh | Cost moves to background; dashboard reads the snapshot. | You know why refresh-per-insert is wrong. |
| Table vs MV decision | Handlers for incremental per-event updates; MVs for expensive multi-table rollups refreshed periodically. | ADR draft exists. |
| Staleness in API contract | Clients see freshness expectations (and optional timestamps). | Contract note matches Week 2 + MV refresh interval. |

### Emerging concepts (study lightly — do not block Phase 5)

| Topic | One-liner | Why it appears here |
|-------|-----------|---------------------|
| Cache-aside | Redis cache for hot dashboard keys; invalidate or TTL. | Hot `GET /analytics/daily` after projections exist. |
| Data retention | Archive/purge old events; projections must stay coherent. | Volume makes analytics expensive. |
| Export API | GDPR-ish `GET /users/me/export`. | Analytics surface raises “my data” questions. |
| Recursive CTEs | Session/sequence queries in SQL before Neo4j. | Walkthrough Phase 5.5 hint — validate graph need. |

Pick **one** emerging topic to read for 1–2 hours; park the rest.

### Study activities

1. **Read** Postgres docs: `CREATE MATERIALIZED VIEW`, `REFRESH MATERIALIZED VIEW` (and concurrent refresh constraints).
2. **Decide** for Echoes:
   - Daily/tag counters → application projection tables (Phase 5a)
   - Weekly rollup → candidate for MV (Phase 5b) *if* measured pain
3. **Write ADR:** read model strategy (projection tables vs MV, consistency, refresh).
4. **Load test or EXPLAIN:** seed ~10k events; compare aggregate-on-read vs projection/MV read. Note numbers in the ADR or a short perf note.
5. **Readiness dry-run:** walk the checklist below out loud.

### Week 4 exit criteria

- [ ] You can explain MVs and when you would *not* use them yet
- [ ] ADR documents read model strategy
- [ ] You measured or reasoned about query cost with realistic volume
- [ ] Emerging topics: at least aware; one optionally explored

---

## Suggested weekly rhythm

| Day | Focus |
|-----|--------|
| 1–2 | Theory + walkthrough + notes |
| 3–4 | Paper design / SQL / ADR drafts |
| 5 | Small Echoes spike or test (handler, query, index migration) |
| 6 | Explain-back: teach the week’s concept in 5 minutes (rubber duck / notes) |
| 7 | Buffer or catch-up |

---

## Implementation order (when you code)

Align coding with study weeks; do not invert 5a/5b:

1. **Query handlers** for reads (Week 1 shape)
2. **Projection table(s)** + idempotent `EventIngested` handler (Week 2)
3. **`GET` analytics** reading projections (Week 2–3)
4. **`GET /events`** with cursor pagination + indexes (Week 3)
5. **MV** for weekly rollups only if needed + scheduled refresh (Week 4)
6. **ADR** + tests: ingest → (async) → daily stats updated; pagination stability

---

## Phase 5 readiness check

Move toward Phase 6 when:

- [ ] Dashboard queries read from projections or MVs, not raw aggregation on every request
- [ ] Ingesting an event eventually updates daily stats (test with async handler)
- [ ] Pagination works correctly across pages with stable ordering
- [ ] You can explain why CQRS was chosen and what consistency guarantee the read API offers
- [ ] Query performance is acceptable with realistic data volume (seed 10k+ events)
- [ ] ADR documents read model strategy (table vs materialized view)

### Skills you should be able to demonstrate

- Design read models from concrete UI query requirements
- Implement query handlers that never mutate state
- Build projection updaters triggered by domain events
- Choose between application-maintained read tables vs database materialized views
- Index for real query patterns
- Explain eventual consistency to a consumer of the read API
- Load-test a dashboard query and identify when to pre-compute

### Mistakes to avoid (keep visible)

- CQRS with two databases too early
- Updating read models synchronously on the ingest request path
- Offset pagination on large tables
- Refreshing MVs on every insert
- No staleness signal/docs while users assume real-time
- Aggregating in app vs SQL without measurement
- Skipping indexes because “Postgres is fast” with tiny dev data

---

## Deliverables summary

| Week | Main deliverable |
|------|------------------|
| 1 | CQRS explain-back + query handler inventory |
| 2 | Projection schema + staleness note + idempotent update plan |
| 3 | Cursor pagination + index plan (+ optional list API) |
| 4 | MV judgment + ADR + volume check (+ optional emerging deep-dive) |

---

## Related docs

- [learning-walkthrough.md](./learning-walkthrough.md) — full Phase 5 section
- [concepts-still-to-learn.md](./concepts-still-to-learn.md) — Phase 5 concept table
- [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md) — prerequisite async stream
- [api-endpoints.md](./api-endpoints.md) — dashboard / API shapes
- [initial-sql.md](./initial-sql.md) — schema and index starting point

---

*Created: Aug 2026 · Derived from Phase 5 of learning-walkthrough.md*
