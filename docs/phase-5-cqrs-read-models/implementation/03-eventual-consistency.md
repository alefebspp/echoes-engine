# 03 — Eventual consistency implementation

**Concept:** After ingest, the write model is durable immediately; read projections catch up asynchronously (seconds), with tag-dependent data lagging until enrichment.

## API contract

`GET /api/v1/dashboard` now returns:

```json
{
  "generatedAt": "2026-08-28T18:00:00.000Z",
  "consistency": {
    "note": "Analytics aggregates are eventually consistent with ingest..."
  }
}
```

Implemented in `GetDashboardQueryHandler` (`src/application/queries/analytics-query-handlers.ts`).

Analytics sub-routes expose per-snapshot freshness:

| Endpoint | Freshness field |
|----------|-----------------|
| `GET /analytics/daily` | `generatedAt` on `DailyStatsSnapshot` |
| `GET /analytics/tags` | `generatedAt` on `TagStatsSnapshot` |
| `GET /analytics/weekly` | `generatedAt` + `refreshNote` on `WeeklyStatsSnapshot` |

Ports: `src/domain/ports/daily-stats-read-store.ts`, `tag-stats-read-store.ts`, `weekly-stats-read-store.ts`.

## Lag timeline in code

```
T0  POST /events → events row + outbox (durable)
T1  EnrichmentProcessor → UpdateEventIngestProjectionsUseCase
                         daily/domain/browser/source/hour +1
T2  EnrichEventTagsUseCase → tags on event
T3  UpdateTagStatsProjectionUseCase → tag stats +1
```

`EnrichmentProcessor` order: `src/infrastructure/queue/enrichment.processor.ts`.

## What is OK vs a bug

| Observation | Expected? |
|-------------|-----------|
| Event in `GET /events`, dashboard count not +1 yet | Yes — if worker has not run |
| Daily +1, `categoryBreakdown` empty | Yes — waiting on T3 |
| POST 201 but event missing from DB | **No** — write bug |
| Double count after retry | **No** — idempotency bug (`projection_processed_events`) |

## How the concept applies

- Clients must not assume POST → immediate dashboard truth.
- `generatedAt` tells the UI **when** the snapshot was built.
- Weekly analytics adds schedule-driven staleness — see [07-materialized-views](./07-materialized-views.md).

## Tests

Dashboard e2e waits for `tagsAssigned` before asserting stats (`test/dashboard.e2e-spec.ts`), matching the T2/T3 window.
