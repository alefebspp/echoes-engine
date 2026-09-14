# 04 — Materialized views

**Prerequisite mindset:** Phase 5a = application-maintained projection tables updated from `EventIngested`. Phase 5b = materialized views **when** aggregations hurt. Do not start here.

---

## Concept

A **materialized view (MV)** is a database object that stores the **result** of a query as a physical table-like snapshot. Clients (or your query handlers) `SELECT` from the MV instead of re-running an expensive aggregation every request.

```sql
CREATE MATERIALIZED VIEW user_weekly_stats AS
SELECT
  user_id,
  date_trunc('week', occurred_at AT TIME ZONE 'UTC') AS week_start,
  COUNT(*)::int AS event_count
FROM events
GROUP BY user_id, date_trunc('week', occurred_at AT TIME ZONE 'UTC');

-- Later, on a schedule:
REFRESH MATERIALIZED VIEW user_weekly_stats;
```

Contrast with a normal **view**: a view is only a saved query definition — every read recomputes. An MV **persists** rows until you refresh.

---

## Refresh models

| Mode | Behavior | Use when |
|------|----------|----------|
| `REFRESH MATERIALIZED VIEW name;` | Rewrites the snapshot; **blocks reads** of the MV during refresh (simple form) | Small MVs, maintenance windows |
| `REFRESH MATERIALIZED VIEW CONCURRENTLY name;` | Allows reads during refresh; requires a **UNIQUE index** on the MV | Dashboards that must stay available |

**Wrong:** refresh on every event insert. That turns ingest into “recompute the world” and defeats both Phase 4 async and Phase 5a incremental projections.

**Right for Echoes:** cron / `@nestjs/schedule` / system cron — e.g. hourly or nightly — matching the staleness you document on the API.

---

## MV vs projection table (preview)

You already understand projections ([02](./02-read-models-projections.md)). Quick contrast (judgment deep-dive in [08](./08-table-vs-mv-judgment.md)):

| | App projection (`user_daily_stats`) | Materialized view |
|---|-------------------------------------|-------------------|
| Updated by | Handler on domain events (upsert/increment) | `REFRESH` re-runs defining SQL |
| Best for | Per-event incremental counters | Heavy multi-join / multi-week rollups |
| Consistency | Eventual, event-driven | Eventual, schedule-driven |
| Idempotency | Your handler’s problem | Refresh replaces snapshot |
| Flexibility | Easy custom merge logic (e.g. react to tags) | Logic lives in SQL definition |

Daily/tag counters that react to `EventIngested` (and maybe tag assignment) → **projection first**.  
Weekly rollup over large history that is fine hours stale → **MV candidate**.

---

## Echoes placement

```
Event ingest (fast)
  → outbox → workers
      → projection: user_daily_stats, tag rollups     // Phase 5a

Scheduled job (slow, background)
  → REFRESH MATERIALIZED VIEW user_weekly_stats       // Phase 5b if needed

GET /analytics/daily  → query handler → projection
GET /analytics/weekly → query handler → MV
GET /dashboard        → may compose both
```

Staleness contract examples:

- Daily projection: “usually within seconds of ingest (after async handlers).”
- Weekly MV: “refreshed every N hours; `generatedAt` = last refresh time.”

Expose freshness when useful (`asOf` / `generatedAt`) so the UI does not pretend real-time.

---

## Defining SQL tips

1. **Scope the grain** — week + user_id, not “everything anyone might want.”
2. **Timezone** — weekly buckets need a defined zone (user setting vs UTC). Document it; wrong truncation is a silent product bug.
3. **Indexes on the MV** — after create, add indexes used by the read API (and UNIQUE for `CONCURRENTLY`).
4. **Permissions** — same as tables; query handlers read only.

Concurrent refresh requirement (Postgres):

```sql
CREATE UNIQUE INDEX uq_user_weekly_stats
ON user_weekly_stats (user_id, week_start);
```

---

## Scheduling in Nest (mental model)

You do not need to implement this while studying, but know the shape:

```typescript
// Conceptual
@Cron('0 * * * *') // hourly
async refreshWeeklyStats() {
  await this.dataSource.query(
    'REFRESH MATERIALIZED VIEW CONCURRENTLY user_weekly_stats',
  );
}
```

Ops concerns: overlapping refreshes (lock / skip if previous still running), monitoring refresh duration, alerting on failure.

---

## Common mistakes

1. Jumping to MVs before projection tables for simple counters.
2. Refreshing per insert or inside the HTTP ingest path.
3. No UNIQUE index then wondering why `CONCURRENTLY` fails.
4. Undocumented staleness — users think weekly chart is live.
5. Duplicating the same grain in both a projection and an MV without a reason.

---

## Exit criteria

- [ ] You can define what an MV stores vs a normal view.
- [ ] You know why refresh-per-insert is wrong and what to use instead.
- [ ] You can contrast MV refresh with an idempotent `EventIngested` projection upsert.

## Explain-back (5 minutes)

> “A materialized view is a stored query snapshot. Echoes uses handler-updated tables for incremental daily stats, and only adds MVs for heavy rollups refreshed on a schedule. Concurrent refresh needs a unique index; the API documents how stale the snapshot may be.”

## Next

[08-table-vs-mv-judgment.md](./08-table-vs-mv-judgment.md) — decide and lock it in an ADR.
