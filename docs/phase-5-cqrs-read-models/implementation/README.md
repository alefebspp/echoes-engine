# Phase 5 implementation index

Implementation reference for each study topic. Each document maps the concept to concrete code in this repository.

| Topic | Implementation doc | Study notes |
|-------|-------------------|-------------|
| CQRS | [01-cqrs](./01-cqrs.md) | [01-cqrs.md](../01-cqrs.md) |
| Read models / projections | [02-read-models-projections](./02-read-models-projections.md) | [02-read-models-projections.md](../02-read-models-projections.md) |
| Eventual consistency | [03-eventual-consistency](./03-eventual-consistency.md) | [03-eventual-consistency.md](../03-eventual-consistency.md) |
| Query handlers | [04-query-handlers](./04-query-handlers.md) | [04-query-handlers.md](../04-query-handlers.md) |
| Cursor pagination | [05-cursor-pagination](./05-cursor-pagination.md) | [05-cursor-pagination.md](../05-cursor-pagination.md) |
| Index design | [06-index-design](./06-index-design.md) | [06-index-design.md](../06-index-design.md) |
| Materialized views | [07-materialized-views](./07-materialized-views.md) | [07-materialized-views.md](../07-materialized-views.md) |
| Table vs MV judgment | [08-table-vs-mv-judgment](./08-table-vs-mv-judgment.md) | [08-table-vs-mv-judgment.md](../08-table-vs-mv-judgment.md) |

ADR: [docs/adr/0005-read-model-strategy.md](../../adr/0005-read-model-strategy.md)

Migration: `src/migrations/1781465656565-Phase5ReadModelsAndIndexes.ts`

Module wiring: `src/presentation/read-models/read-models.module.ts`
