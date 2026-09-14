# ADR 0005 — Read model strategy for analytics

## Status

Accepted

## Context

The dashboard and analytics APIs must serve daily, tag, domain, browser, source, and hourly breakdowns without running heavy `COUNT` / `GROUP BY` on the write-model `events` table on every request.

Phase 4 already emits `EventIngested` through the transactional outbox (ADR 0004). Analytics read models hang off that same async stream.

## Decision

### Phase 5a — Application projection tables (default)

Maintain handler-updated projection tables, updated idempotently from the enrichment worker after outbox delivery:

| Table | Purpose |
|-------|---------|
| `user_daily_stats` | Events per day |
| `user_tag_stats` | Tag rollups (after enrichment) |
| `user_domain_stats` | Top domains |
| `user_browser_stats` | Top browsers |
| `user_source_stats` | Events by source |
| `user_hourly_stats` | Activity by hour |
| `user_event_summary` | Totals, untagged count, first/last tracked |
| `projection_processed_events` | Idempotency ledger `(event_id, kind)` |

Ingest projections run **before** tag enrichment; tag projections run **after**.

### Event list — indexed write model

`GET /api/v1/events` reads indexed `events` with cursor pagination `(occurred_at DESC, id DESC)`. Not materialized into a separate table.

Index: `IDX_events_user_occurred_at_id (user_id, occurred_at DESC, id DESC)`.

### Phase 5b — Materialized view for weekly rollups

`user_weekly_stats` MV refreshed on an hourly schedule via `WeeklyStatsRefreshService`. Used by `GET /api/v1/analytics/weekly`.

Daily/tag counters stay on projection tables — not duplicated in the MV.

### Query handlers (read path)

Controllers call query handlers only; handlers never mutate domain state:

- `ListEventsQueryHandler`
- `GetDailyStatsQueryHandler`
- `GetTagStatsQueryHandler`
- `GetDashboardQueryHandler` (composes the above + rollups)
- `GetWeeklyStatsQueryHandler`

### Eventual consistency

API responses include `generatedAt` and a `consistency.note` on the dashboard. Clients must assume seconds of lag after ingest; tag breakdowns may lag until enrichment completes.

## Consequences

- Ingest HTTP path stays free of analytics writes.
- Read path is eventually consistent; documented in API payloads.
- Two mechanisms coexist: incremental projections (5a) + scheduled MV (5b).
- Operational cost stays low — same PostgreSQL, light CQRS.

## References

- `src/application/projection/*`
- `src/application/queries/*`
- `src/infrastructure/typeorm/projection-store.ts`
- `src/infrastructure/queue/enrichment.processor.ts`
- `src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts`
