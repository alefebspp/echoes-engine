# 07 — Materialized views implementation

**Concept:** Store expensive aggregation snapshots; refresh on a **schedule**, not per insert.

## Object

**Migration:** `user_weekly_stats` materialized view in `src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts`

```sql
CREATE MATERIALIZED VIEW user_weekly_stats AS
SELECT user_id, date_trunc('week', occurred_at AT TIME ZONE 'UTC')::date AS week_start,
       COUNT(*)::int AS event_count
FROM events
GROUP BY user_id, week_start;

CREATE UNIQUE INDEX UQ_user_weekly_stats ON user_weekly_stats (user_id, week_start);
```

`WITH NO DATA` — populated on first refresh.

## Scheduled refresh

| Piece | File |
|-------|------|
| `WeeklyStatsRefreshService` | `src/infrastructure/queue/weekly-stats-refresh.service.ts` |
| Cron | `@Cron(CronExpression.EVERY_HOUR)` |
| Mode | `REFRESH MATERIALIZED VIEW CONCURRENTLY` (falls back to non-concurrent) |
| Disable | `WEEKLY_STATS_REFRESH_ENABLED=false` |

Registered in `EnrichmentQueueModule` alongside outbox publisher.

## Read path

| Piece | File |
|-------|------|
| `GetWeeklyStatsQueryHandler` | `src/application/queries/get-weekly-stats-query-handler.ts` |
| `TypeOrmWeeklyStatsReadStore` | `src/infrastructure/typeorm/weekly-stats-read-store.ts` |
| API | `GET /api/v1/analytics/weekly` — `AnalyticsController` |

Read store tries MV first; falls back to live `GROUP BY` if MV missing (e.g. dev synchronize without migration).

Response includes `refreshNote` documenting schedule-driven staleness.

## How the concept applies

- **Not** refreshed on each `EventIngested` — that would defeat incremental projections.
- **CONCURRENTLY** requires unique index on MV — created in migration.
- Weekly grain is **coarser** than daily projections; hourly refresh interval is documented in API.

Daily/tag counters remain on handler-updated tables — see [08-table-vs-mv-judgment](./08-table-vs-mv-judgment.md).

## Tests

E2E setup disables weekly refresh cron: `test/setup-e2e.ts` sets `WEEKLY_STATS_REFRESH_ENABLED=false`.
