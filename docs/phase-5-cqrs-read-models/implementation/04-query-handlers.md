# 04 — Query handlers implementation

**Concept:** Application-layer read units: input → read store → DTO out. Never mutate domain state.

## Handlers

| Handler | File | Read store / source |
|---------|------|---------------------|
| `ListEventsQueryHandler` | `src/application/queries/list-events-query-handler.ts` | `EventsListReadStore` → indexed `events` |
| `GetDailyStatsQueryHandler` | `src/application/queries/analytics-query-handlers.ts` | `DailyStatsReadStore` → projection tables |
| `GetTagStatsQueryHandler` | same | `TagStatsReadStore` → `user_tag_stats` |
| `GetDashboardQueryHandler` | same | composes daily + tag + rollup stores |
| `GetWeeklyStatsQueryHandler` | `src/application/queries/get-weekly-stats-query-handler.ts` | `WeeklyStatsReadStore` → MV or fallback |

## Ports (domain)

| Port | File |
|------|------|
| `EventsListReadStore` | `src/domain/ports/events-list-read-store.ts` |
| `DailyStatsReadStore` | `src/domain/ports/daily-stats-read-store.ts` |
| `TagStatsReadStore` | `src/domain/ports/tag-stats-read-store.ts` |
| `RollupStatsReadStore` | `src/domain/ports/rollup-stats-read-store.ts` |
| `WeeklyStatsReadStore` | `src/domain/ports/weekly-stats-read-store.ts` |

## Infrastructure adapters

| Adapter | File |
|---------|------|
| `TypeOrmEventsListReadStore` | `src/infrastructure/typeorm/events-list-read-store.ts` |
| `TypeOrmDailyStatsReadStore` | `src/infrastructure/typeorm/daily-stats-read-store.ts` |
| `TypeOrmTagStatsReadStore` | `src/infrastructure/typeorm/tag-stats-read-store.ts` |
| `TypeOrmRollupStatsReadStore` | `src/infrastructure/typeorm/rollup-stats-read-store.ts` |
| `TypeOrmWeeklyStatsReadStore` | `src/infrastructure/typeorm/weekly-stats-read-store.ts` |

## DI module

`src/presentation/read-models/read-models.module.ts` registers handlers and binds ports to TypeORM adapters.

## Controllers (interface layer)

| Controller | Handlers used |
|------------|---------------|
| `EventController` GET | `ListEventsQueryHandler` |
| `DashboardController` | `GetDashboardQueryHandler` |
| `AnalyticsController` | `GetDailyStatsQueryHandler`, `GetTagStatsQueryHandler`, `GetWeeklyStatsQueryHandler` |

## What handlers never do

- No `EventRepository.create` / `persistAssignedTags`
- No outbox writes
- No projection increments (that belongs to projection use cases in the worker)

## Removed (pre-Phase 5)

Live aggregation dashboard query (`TypeOrmDashboardStatsQuery`) was removed. `GetDashboardStatsUseCase` replaced by `GetDashboardQueryHandler`.

## How the concept applies

Query handlers make the CQRS split **visible in folder names** (`application/queries/` vs command use cases). Controllers stay thin: validate DTO → call handler → return result.
