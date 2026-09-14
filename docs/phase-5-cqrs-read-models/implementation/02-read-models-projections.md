# 02 — Read models / projections implementation

**Concept:** Denormalized tables shaped for dashboard questions, updated asynchronously and idempotently from `EventIngested`.

## Schema (migration)

`src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts` creates:

| Table | Grain | Feeds |
|-------|-------|-------|
| `user_daily_stats` | `(user_id, date)` | `eventsByDay`, rolling counts |
| `user_tag_stats` | `(user_id, tag)` | `categoryBreakdown` |
| `user_domain_stats` | `(user_id, domain)` | `topDomains` |
| `user_browser_stats` | `(user_id, browser)` | `topBrowsers` |
| `user_source_stats` | `(user_id, source_id)` | `eventsBySource` |
| `user_hourly_stats` | `(user_id, hour)` | `activityByHour` |
| `user_event_summary` | `user_id` | totals, untagged, first/last tracked |
| `projection_processed_events` | `(event_id, kind)` | idempotency ledger |

TypeORM entities live under `src/infrastructure/typeorm/entities/user-*.entity.ts`.

## Projection updaters (application)

| Use case | When | File |
|----------|------|------|
| `UpdateEventIngestProjectionsUseCase` | On each `EventIngested` job, **before** tagging | `src/application/projection/update-event-ingest-projections-use-case.ts` |
| `UpdateTagStatsProjectionUseCase` | **After** tag enrichment | `src/application/projection/update-tag-stats-projection-use-case.ts` |

## Infrastructure

| Piece | File |
|-------|------|
| Upsert / increment SQL | `src/infrastructure/typeorm/projection-store.ts` |
| Domain/browser extraction | `src/infrastructure/common/event-metadata-extractors.ts` |
| Timezone-aware date/hour | `src/infrastructure/common/event-cursor.ts` (`formatDateInTimezone`, `extractHourInTimezone`) |

## Worker pipeline

`src/infrastructure/queue/enrichment.processor.ts`:

1. `updateEventIngestProjectionsUseCase.execute(eventId)`
2. `enrichEventTagsUseCase.execute(eventId)`
3. `updateTagStatsProjectionUseCase.execute(eventId)`

## Idempotency

`projection_processed_events` uses `INSERT … ON CONFLICT DO NOTHING` per `(event_id, kind)`:

- `kind = 'ingest'` — daily, domain, browser, source, hour, summary
- `kind = 'tags'` — tag rollups + decrement untagged counter

Retries do not double-count.

## How the concept applies

- Projections are **pre-aggregated counters**, not one row per event per dashboard slice.
- Updates are **async** (worker), not inside `SubmitEventUseCase`.
- Schema follows **UI questions** (counts per day/tag/domain), not a mirror of `events` columns.

## Read side

Query handlers read these tables via:

- `TypeOrmDailyStatsReadStore`
- `TypeOrmTagStatsReadStore`
- `TypeOrmRollupStatsReadStore`

See [04-query-handlers](./04-query-handlers.md).
