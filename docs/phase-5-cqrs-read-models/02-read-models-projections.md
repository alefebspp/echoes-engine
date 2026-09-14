# 02 — Read models / projections

**You already know:** CQRS splits write vs read paths.  
**This note:** how the read side is *stored* and *kept up to date*.

---

## Concept

A **read model** (or **projection**) is a data structure shaped for one (or a few) query patterns — usually denormalized — rather than for write invariants or 3NF purity.

A **projection updater** is a handler that listens to domain events (here: `EventIngested`, and often tag-related facts) and upserts/increments those tables.

| Write model (`events`) | Read model (`user_daily_stats`, …) |
|------------------------|-------------------------------------|
| Append/ingest friendly | Dashboard-question friendly |
| Normalized, rich metadata | Pre-aggregated columns |
| Source of truth for “what happened” | Source of truth for “what the UI asks fast” |
| Updated on command path | Updated by async handlers |

**Projection ≠ copying the whole `events` table.** It answers specific questions: counts per day, rollups per tag, etc.

---

## Why it matters in Echoes

Dashboard questions (from Phase 5):

- Events by date / paginated history  
- Time or count per tag  
- Weekly activity summaries  

`SELECT COUNT(*) … GROUP BY date` on every `GET /dashboard` does not scale with months of browsing. A row like `(user_id, date, event_count)` turns that into a cheap range read.

**Order from the walkthrough:** build **handler-updated tables first (Phase 5a)**; add materialized views later when aggregations hurt (Phase 5b). See [07](./07-materialized-views.md) and [08](./08-table-vs-mv-judgment.md).

---

## Design from UI questions, not from `events` columns

Example sketch:

```text
user_daily_stats
  user_id     UUID
  date        DATE          -- in a documented timezone policy
  event_count INT
  PRIMARY KEY (user_id, date)
```

Tag rollup (shape depends on `GET /analytics/tags`):

```text
user_tag_stats
  user_id UUID
  tag     VARCHAR
  event_count INT
  PRIMARY KEY (user_id, tag)
```

List endpoints often still read indexed `events` (see pagination notes). Projections shine for **aggregates**.

---

## How projections stay honest

```
T0  POST /events accepted → events row + outbox EventIngested
T1  Projection handler runs → daily count +1 (event may still be untagged)
T2  Tagging worker finishes → tag projection may need a second update
```

**Do not** update read models inside `SubmitEventUseCase` on the HTTP path — that defeats Phase 4 async boundaries and couples ingest to every analytics table.

Handlers must be **idempotent** under at-least-once delivery (retries):

- Upsert on natural key `(user_id, date)` with careful increments, or  
- Track processed `event_id`s so a duplicate `EventIngested` does not double-count, or  
- Idempotent “set absolute value from recompute” for a narrow key (usually heavier).

Same discipline you used for enrichment workers.

---

## Mental pipeline

```
EventIngested (from outbox / queue)
  → UpdateDailyStatsProjection (idempotent)
  → UpdateTagStatsProjection (when tags known)

GET /analytics/daily
  → query handler
  → SELECT FROM user_daily_stats
```

The projection write is allowed in a **worker**. The query path still never mutates domain state ([04-query-handlers.md](./04-query-handlers.md)).

---

## Common mistakes

1. Designing the read schema as a mirror of `events` “just denormalized somehow.”
2. Updating projections synchronously on ingest.
3. Non-idempotent `event_count = event_count + 1` on bare retries.
4. Jumping to materialized views before simple projection tables.

---

## Exit criteria

- [ ] Columns for daily (and tag) stats sketched from UI needs.
- [ ] You can describe T0→T1→T2 and when a second projection update is needed.
- [ ] You can explain one idempotent strategy for duplicate `EventIngested`.
- [ ] You know why projection updates do not belong in `SubmitEventUseCase`.

## Explain-back (5 minutes)

> “A read model is a table shaped for dashboard questions, maintained by handlers on EventIngested—not computed on every GET. Updates are async and idempotent. Ingest stays fast; the dashboard reads pre-aggregated rows that may briefly lag the write.”

## Next

[03-eventual-consistency.md](./03-eventual-consistency.md) — what that lag means for the API.
