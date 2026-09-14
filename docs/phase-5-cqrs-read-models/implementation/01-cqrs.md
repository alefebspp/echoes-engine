# 01 — CQRS implementation

**Concept:** Separate commands (mutate state) from queries (read only). Echoes uses **light CQRS** — one PostgreSQL, separate paths and models.

## What was implemented

### Write path (command)

| Piece | Location |
|-------|----------|
| `POST /api/v1/events` | `src/presentation/event/event.controller.ts` |
| `SubmitEventUseCase` | `src/application/event/submit-event-use-case.ts` |
| Persist event + outbox `EventIngested` | `src/infrastructure/typeorm/event-repository.ts` |

The HTTP handler only runs the command use case. It does **not** update analytics tables.

### Read path (query)

| Endpoint | Query handler | Location |
|----------|---------------|----------|
| `GET /api/v1/events` | `ListEventsQueryHandler` | `src/application/queries/list-events-query-handler.ts` |
| `GET /api/v1/dashboard` | `GetDashboardQueryHandler` | `src/application/queries/analytics-query-handlers.ts` |
| `GET /api/v1/analytics/daily` | `GetDailyStatsQueryHandler` | same |
| `GET /api/v1/analytics/tags` | `GetTagStatsQueryHandler` | same |
| `GET /api/v1/analytics/weekly` | `GetWeeklyStatsQueryHandler` | `src/application/queries/get-weekly-stats-query-handler.ts` |

Controllers in `src/presentation/dashboard/`, `src/presentation/analytics/`, and `GET` on `src/presentation/event/event.controller.ts` call **only** query handlers.

### Async bridge (still CQRS)

Projection updates run in the enrichment worker (`src/infrastructure/queue/enrichment.processor.ts`), triggered by `EventIngested` via outbox — not on the HTTP command thread.

```
POST /events → SubmitEventUseCase → outbox
                                      ↓
                              EnrichmentProcessor
                              → ingest projections
                              → tag enrichment
                              → tag projections
GET /dashboard → GetDashboardQueryHandler → projection tables
```

## How the concept applies

- **Commands** change durable write-model state and emit domain events.
- **Queries** load pre-shaped read data and return DTOs; they never call `Event.create`, outbox, or repositories that mutate aggregates.
- Same database, **different responsibilities** — no second DB, no Kafka required for light CQRS.

## Related

- [ADR 0005](../../adr/0005-read-model-strategy.md)
- [02-read-models-projections](./02-read-models-projections.md)
