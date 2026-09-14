# 08 — Table vs MV judgment implementation

**Concept:** Choose read-model mechanism on purpose; document the split.

## Decision (implemented)

Documented in [ADR 0005](../../adr/0005-read-model-strategy.md).

| Product need | Mechanism | Code |
|--------------|-----------|------|
| Events per day | Projection `user_daily_stats` | `UpdateEventIngestProjectionsUseCase` |
| Tag breakdown | Projection `user_tag_stats` | `UpdateTagStatsProjectionUseCase` |
| Domain / browser / source / hour | Projection tables | `TypeOrmProjectionStore.applyIngestProjection` |
| Paginated history | Indexed `events` + cursor | `ListEventsQueryHandler` |
| Weekly rollups | MV + hourly refresh | `user_weekly_stats` + `WeeklyStatsRefreshService` |
| Full dashboard | Compose query handlers | `GetDashboardQueryHandler` |

## Heuristic applied

```
One event → increment a few rows?     → projection + idempotent handler
Heavy weekly rollup + hours lag OK?   → materialized view on schedule
Point lookups / timeline?             → indexed events table
```

## Why not MV for daily/tag?

- Updates are **incremental** (`+1` per event) — natural fit for `EventIngested` handlers.
- Tag stats must react **after enrichment** (T2/T3) — awkward as a single static MV definition.
- Idempotency is explicit via `projection_processed_events`.

## Why MV for weekly?

- Full re-aggregate over long history is acceptable on a timer.
- Staleness of hours matches product expectations for weekly charts.
- `generatedAt` + `refreshNote` on weekly API expose freshness.

## No duplicate grains

Daily counts live **only** in `user_daily_stats`, not also in `user_weekly_stats` for the same API surface. Weekly MV is a separate endpoint (`/analytics/weekly`).

## How the concept applies

The codebase implements **both** mechanisms where each earns its keep — not MV-for-everything, not projections-for-weekly-without-measurement. The ADR locks the split for future contributors.

## Related files

- `docs/adr/0005-read-model-strategy.md`
- `src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts`
- `src/infrastructure/queue/weekly-stats-refresh.service.ts`
- `src/application/projection/*`
