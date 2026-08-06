# ADR 0004: Async tagging via transactional outbox

## Status

Accepted (supersedes sync tagging in the ingest transaction)

## Context

Until Phase 4, `SubmitEventUseCase` called `handler.suggestTags` and persisted tags in the same HTTP request / DB transaction as the event insert. That kept tags strongly consistent with ingest, but:

1. Tagging latency was on the critical path for every ingest.
2. Enrichment failure rolled back the entire accept (extension retries for a rule bug).
3. Future side effects (embeddings, graph sync, read models) would inflate the same use case into a god orchestrator.

We need reliable async side effects: if PostgreSQL commits and Redis is briefly down, enrichment work must not be lost.

## Decision

1. **Domain event:** After accepting an `Event`, raise `EventIngested` (payload: `eventId`, `userId`, `eventType`, `correlationId`).
2. **Transactional outbox:** Persist the event and an `outbox_messages` row in the **same** DB transaction. Do not call the queue from the use case.
3. **Publisher:** A poller (`OutboxPublisher`) reads unpublished outbox rows, `queue.add`s to BullMQ, then marks `published_at`.
4. **Worker:** `EnrichmentProcessor` runs `EnrichEventTagsUseCase` — load event, `suggestTags` via the existing `EventTypeHandler` registry, persist tags.
5. **At-least-once + idempotency:** BullMQ retries; consumers skip when `tags_assigned` is already true; unique `(event_id, tag)` backs the DB.
6. **DLQ:** After max attempts, jobs are copied to `enrichment-dlq` for inspection.
7. **Eventual consistency:** Readers may briefly see events without tags.

## Consequences

### Positive

- Ingest latency no longer includes enrichment.
- Redis outages after DB commit do not lose work (outbox buffers).
- Tagging, and later Phase 5–7 handlers, subscribe to the same `EventIngested` stream without rewriting ingest.
- Correlation id flows HTTP → outbox payload → worker logs.

### Negative / trade-offs

- Tags are eventually consistent (seconds under normal load).
- Operational surface grows: Redis, publisher, worker, DLQ.
- Exactly-once delivery is not claimed; handlers must stay idempotent.

### Supersedes

Any prior “sync tagging in the same transaction as ingest” rationale from Phase 2/3. Ingest atomicity now covers **event + outbox** only; tags are a separate transaction owned by the enrichment worker.
