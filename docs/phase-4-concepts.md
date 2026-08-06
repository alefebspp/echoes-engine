# Phase 4 Concepts — Async Scale (with code from this repo)

This document explains every Phase 4 concept as implemented in Echoes Engine, with pointers into the real code.

Companion: [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md) · [ADR 0004](./adr/0004-async-tagging-outbox.md)

---

## Target pipeline

```
HTTP POST /events
  → SubmitEventUseCase
  → Event.create (no tags yet)
  → DB TX: events row + outbox_messages(EventIngested)
  → 201 accepted

OutboxPublisher (poll)
  → BullMQ enrichment queue

EnrichmentProcessor
  → EnrichEventTagsUseCase
  → EventTypeHandler.suggestTags
  → persist tags (idempotent)
```

---

## 1. Domain events

**Concept:** A domain event is a past-tense fact about something that already happened in the domain. Producers emit facts; consumers react. The emitter does not call enrichment services directly.

**Why it matters:** Tagging, embeddings, graph sync, and read models should all react to ingest without a god use case importing every module.

**In this codebase:**

```typescript
// src/domain/domain-event/event-ingested.ts
export class EventIngested implements DomainEvent {
  readonly type = EventIngested.TYPE; // 'EventIngested'

  constructor(
    readonly eventId: string,
    readonly userId: string,
    readonly eventType: string,
    readonly correlationId: string | null = null,
  ) {}

  toPayload(): EventIngestedPayload { /* ... */ }
}
```

Raised in the submit use case **after** building the aggregate, then written to the outbox (not published to Redis inline):

```typescript
// src/application/event/submit-event-use-case.ts
const domainEvent = new EventIngested(
  event.getId().toString(),
  userId,
  event.getEventType(),
  this.correlationIdProvider.getCorrelationId(),
);
const outboxMessage = OutboxMessage.createFromDomainEvent(domainEvent);
const saved = await this.eventRepository.create(event, [outboxMessage]);
```

**What it must not do:** HTTP calls, queue SDKs, or “call five services.” It is data about a fact.

---

## 2. Async processing / background jobs

**Concept:** The HTTP handler finishes as soon as the durable write succeeds. Heavy or retryable work runs outside the request lifecycle (workers).

**Why it matters:** The browser extension only needs “accepted.” Tagging latency and failures should not block or roll back ingest.

**Sync vs async split here:**

| Sync (request path) | Async (worker) |
|---------------------|----------------|
| Validate source / type | `suggestTags` |
| `Event.create` | Persist tags |
| Save event + outbox | Retries / DLQ |

```typescript
// Before Phase 4 (sync tagging on the request path):
event.assignTags(handler.suggestTags(event.getMetadata()));
await this.eventRepository.create(event);

// After Phase 4:
this.eventTypeHandlerRegistry.getHandler(props.type); // fail-fast only
await this.eventRepository.create(event, [outboxMessage]);
```

Worker entry point:

```typescript
// src/infrastructure/queue/enrichment.processor.ts
const result = await this.enrichEventTagsUseCase.execute(eventId);
```

---

## 3. Transactional outbox

**Concept:** Persist outbound messages in the **same database transaction** as domain changes. A separate publisher pushes them to the broker and marks them published.

**Failure mode without outbox:**

1. `INSERT event` commits.
2. `queue.add` fails (Redis down).
3. Message is gone forever → event never enriched.

**Recovery with outbox:**

1. `INSERT event` + `INSERT outbox` commit together.
2. Publisher retries until `queue.add` succeeds, then sets `published_at`.
3. Broker restart is fine: unpublished rows remain in PostgreSQL.

**Schema:**

```sql
-- src/migrations/1781465656564-OutboxAndAsyncEnrichment.ts
CREATE TABLE outbox_messages (
  id uuid PRIMARY KEY,
  type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
```

**Same-transaction write:**

```typescript
// src/infrastructure/typeorm/event-repository.ts
await this.dataSource.transaction(async (manager) => {
  const persisted = await manager.save(EventMapper.toOrm(event));
  await manager.getRepository(OutboxMessageOrmEntity).save(
    outboxMessages.map((message) => this.toOutboxOrm(message)),
  );
  return persisted;
});
```

**Publisher:**

```typescript
// src/infrastructure/queue/outbox-publisher.service.ts
const messages = await this.outboxStore.claimUnpublished(this.batchSize);
await this.enrichmentQueue.add(ENRICH_EVENT_JOB, jobPayload, {
  jobId: `outbox:${message.getId()}`, // dedupe if republished
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});
await this.outboxStore.markPublished(publishedIds);
```

---

## 4. Message queues and at-least-once delivery

**Concept:** Producers and consumers communicate through a buffer (here: Redis + BullMQ). Delivery is **at-least-once**: retries can re-deliver the same logical job. Exactly-once across DB + broker is hard; systems choose at-least-once + **idempotent consumers**.

| Guarantee | Meaning |
|-----------|---------|
| At-most-once | May lose messages; no duplicates |
| At-least-once | No silent loss; duplicates possible |
| Exactly-once | Ideal, expensive/fragile across two systems |

**In this codebase:** BullMQ `attempts` + exponential backoff. Job identity uses stable `jobId`s so republishing the same outbox row does not create parallel duplicate jobs.

```typescript
await this.enrichmentQueue.add(ENRICH_EVENT_JOB, jobPayload, {
  jobId: `outbox:${message.getId()}`,
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});
```

---

## 5. Idempotent consumers

**Concept:** Running the handler twice for the same `EventIngested` must not create duplicate side effects.

**Two layers in Echoes:**

1. **Client ingest idempotency** (Phase 2): unique `(user_id, external_event_id)` so extension retries do not duplicate events.
2. **Consumer idempotency** (Phase 4): enrichment skips when tags were already assigned; unique `(event_id, tag)` at the DB.

```typescript
// Domain: assign once
assignTags(tags: EventTag[]): EventTag[] {
  if (this.tagsDefined) {
    return this.getTags();
  }
  this.tags = [...tags];
  this.tagsDefined = true;
  return this.getTags();
}
```

```typescript
// Application: EnrichEventTagsUseCase
if (event.areTagsAssigned()) {
  return { eventId, status: 'already_enriched', tagCount: event.getTags().length };
}
event.assignTags(handler.suggestTags(event.getMetadata()));
await this.eventRepository.persistAssignedTags(event);
```

```typescript
// Infrastructure: persistAssignedTags short-circuits if tags_assigned is already true
if (existing.tagsAssigned) {
  return existing;
}
```

Empty enrichment is still “done”: `tags_assigned = true` with zero tag rows, so retries do not loop forever.

---

## 6. Dead letter queue (DLQ)

**Concept:** Poison messages that fail after N retries leave the main queue so they stop blocking healthy work. Operators inspect / replay from the DLQ.

```typescript
// src/infrastructure/queue/enrichment.processor.ts
@OnWorkerEvent('failed')
async onFailed(job, error) {
  if (job.attemptsMade >= maxAttempts) {
    await this.deadLetterQueue.add(ENRICHMENT_DEAD_LETTER_JOB, {
      ...job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade,
    }, { jobId: `dlq:${job.data.outboxMessageId}` });
  }
}
```

Queues: `enrichment` (main) and `enrichment-dlq` (dead letters).

---

## 7. Backpressure

**Concept:** When consumers are slower than producers, the buffer grows. Without visibility, you only notice when Redis memory is exhausted.

**In this codebase:** After each publish batch, the publisher logs queue depth:

```typescript
structuredLog('queue.depth', {
  queue: ENRICHMENT_QUEUE,
  waiting,
  active,
  delayed,
  failed,
  outboxUnpublished: unpublished ?? null,
});
```

That signal is how you detect lag (outbox backlog or BullMQ `waiting` growth) before it becomes an outage.

---

## 8. Observability across the async boundary

**Concept:** One logical ingest spans HTTP → DB → outbox → Redis → worker. Correlation / event ids must appear in both halves.

**Flow:**

1. Middleware sets `x-correlation-id` into AsyncLocalStorage.
2. `AlsCorrelationIdProvider` reads it into `EventIngested` / outbox payload.
3. Worker logs include `eventId`, `correlationId`, `jobId`, attempt number.

Example log events: `event.create.succeeded`, `outbox.published`, `enrichment.started`, `enrichment.completed`, `enrichment.dead_lettered`.

---

## 9. Event-driven architecture (within a modular monolith)

**Concept:** Modules communicate via facts (`EventIngested`) rather than direct service imports for side effects. Still one deployable Nest app — not microservices yet.

**Open/Closed preserved:** Workers reuse `EventTypeHandlerRegistry`. Adding `SPOTIFY_PLAY` still means register a handler; neither submit nor the enrichment use case gains a new `if (type === ...)`.

---

## 10. Client idempotency vs consumer idempotency

| | Client ingest | Consumer enrichment |
|--|---------------|---------------------|
| Trigger | Extension retries same `id` | Queue redelivers same job |
| Key | `(user_id, external_event_id)` | `tags_assigned` + `(event_id, tag)` |
| Goal | One event row | One enrichment outcome |

Both are required. Outbox + queue retries make consumer idempotency mandatory even when the client never retries.

---

## How to run (API + worker)

Publisher and enrichment worker start **inside the same Nest process** as the HTTP API (`EnrichmentQueueModule`).

```bash
# 1. Infrastructure
docker compose up -d db redis

# 2. Env
cp .env.example .env

# 3. Schema
npm run migration:run

# 4. API + outbox publisher + BullMQ worker
npm run start:dev
```

| Piece | Where it runs |
|-------|----------------|
| HTTP API | Nest HTTP server |
| `OutboxPublisher` | `@Interval(2000)` in the same process |
| `EnrichmentProcessor` | BullMQ `@Processor('enrichment')` in the same process |

Optional: `OUTBOX_PUBLISHER_ENABLED=false` accepts events into the outbox without publishing (tags stay pending).

See also the [README](../README.md#5-executar-a-api-com-o-worker).

## How to verify locally

1. With the stack above running, `POST /api/v1/events` with a JWT.
2. Response is immediate (`status: "accepted"`); tags appear shortly after.
3. Logs should show `event.create.succeeded` → `outbox.published` → `enrichment.completed`.
4. E2E: `test/events.e2e-spec.ts` covers ingest → outbox → publisher → tags, plus double enrichment.

---

## Mental model checklist

- Publish-after-commit without outbox loses messages when Redis fails.
- `EventIngested` is a fact, not a job API.
- At-least-once + idempotent handler ≈ practical reliability.
- Exactly-once across two systems is not the design goal.
- Phase 5 read models can hang off the same `EventIngested` stream without rewriting ingest.
