# 05 — Table vs MV judgment (+ ADR)

**Theme:** Choose the read-model mechanism on purpose; write it down so Phase 6+ does not thrash.

---

## The decision

Echoes has two honest ways to pre-compute analytics:

1. **Application-maintained projection tables** — rows upserted/incremented by handlers on `EventIngested` (and related events).
2. **Materialized views** — snapshots refreshed by scheduled SQL.

Both are **eventually consistent**. They differ in *how* freshness advances and *what* work is easy.

---

## Decision heuristic

```
Is the update naturally "one event → touch a few rows"?
  YES → projection table + idempotent handler
  NO  → is the query a heavy multi-table / large-history rollup?
          YES, and seconds/hours of lag OK → MV (+ schedule)
          NO → maybe indexed live query (list) or simplify the product question
```

| Product need | Prefer | Why |
|--------------|--------|-----|
| Events per day for user | Projection `user_daily_stats` | Incremental `+1` / upsert; reacts to stream |
| Time/count per tag | Projection tag rollup | Needs tag-assigned updates, not only ingest |
| Paginated event history | Indexed `events` (not MV) | Point lookups / keyset; source of truth list |
| Weekly activity over long history | MV *if* measured pain | Full re-aggregate is OK on a timer |
| Dashboard compose | Query handler | Reads projections ± MV; no new storage by default |

**Walkthrough order reminder:** build **handler-updated tables first (5a)**, then MVs when SQL aggregations become slow (5b).

---

## Worked Echoes answers (default stance)

### Daily / tag counters → projection tables

- Driven by the same async stream you built in Phase 4.
- Can react when tags land later (second handler or same pipeline step) — awkward to express as a single static MV definition if enrichment is async.
- Idempotency is explicit (natural keys, upsert, processed-event ledger) — you already practice that for enrichment.

### Event list → indexed write/read of `events`

- Not an aggregation. Cursor + composite index ([05](./05-cursor-pagination.md), [06](./06-index-design.md)).
- Do not materialize “all events” into another full copy without a clear reason.

### Weekly rollups → MV candidate, not day-one requirement

- Only after you have volume and an `EXPLAIN` / timing that hurts.
- Refresh interval becomes part of the API staleness story.

---

## Consistency story (one paragraph you can reuse)

> Ingest accepts writes immediately. Projection handlers update daily/tag read models asynchronously; those endpoints may lag by seconds and may show untagged activity until enrichment finishes. Materialized weekly rollups (if introduced) lag by the refresh interval and expose `generatedAt`. List endpoints read indexed events and may appear before projections catch up.

That ties CQRS + eventual consistency (you know) to **table vs MV** (this week).

---

## ADR outline (write this as a deliverable)

Create something like `docs/adr/0005-read-model-strategy.md` when you implement (study draft is enough now):

```markdown
# ADR 0005 — Read model strategy for analytics

## Status
Proposed

## Context
Dashboard needs daily/tag/weekly stats without aggregating raw events on every request.
We already emit EventIngested via outbox (ADR 0004).

## Decision
- Phase 5a: application projection tables for daily and tag stats, updated by idempotent handlers.
- Event list: cursor pagination on events with composite index (user_id, occurred_at, id).
- Phase 5b: materialized view for weekly rollups only if measured query cost justifies it;
  refresh on schedule (not per insert); document staleness / generatedAt.

## Consequences
- Read path is eventually consistent; API docs state expectations.
- Ingest path stays free of analytics writes.
- Two mechanisms possible later — we accept operational clarity via this ADR.
```

Adjust after you seed 10k events and note timings.

---

## Measurement (minimum bar)

Before adding an MV:

1. Seed realistic volume (10k+ events for at least one user).
2. Time the live aggregate the MV would replace.
3. Time `SELECT` from projection or prototype MV.
4. Record numbers in the ADR or a short perf note.

No measurement → default stays **projection only**.

---

## Common mistakes

1. MV for daily counters “because it sounds advanced.”
2. Projection **and** MV for the same grain with no owner of truth.
3. ADR that only lists tables without consistency / refresh rules.
4. Refresh strategy omitted — the judgment is incomplete without it.

---

## Exit criteria

- [ ] You can decide daily vs weekly mechanism in one sentence each.
- [ ] You drafted an ADR-quality decision (even in notes).
- [ ] You know what evidence would justify introducing an MV.

## Explain-back (5 minutes)

> “We maintain daily and tag stats in projection tables from EventIngested because updates are incremental and tied to our async pipeline. Weekly rollups can become a materialized view refreshed on a schedule if aggregates get expensive. The list API stays on indexed events with cursors. An ADR records that split and the staleness contract.”

## Next

[09-emerging-topics.md](./09-emerging-topics.md) — optional depth that Phase 6/7 will touch.
