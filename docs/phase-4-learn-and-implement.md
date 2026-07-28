# Phase 4 — What to learn and implement

Study guide for **Phase 4 (Escala)** of Echoes Engine: move enrichment off the HTTP request path without losing messages or duplicating side effects.

Companion: [learning-walkthrough.md — Phase 4](./learning-walkthrough.md#phase-4--escala) · [api-endpoints.md](./api-endpoints.md)

**Status legend:** ✅ Done · 🟡 Partial · ⬜ Not started

---

## Starting point (today)

Ingest is still **synchronous end-to-end**:

```
SubmitEventUseCase
  → Event.create
  → EventTypeHandler.suggestTags   // Enrichment on the request path
  → Event.assignTags
  → EventRepository.create         // event + tags in one DB transaction
  → HTTP 201
```

Phase 3 already gave you the boundaries that make Phase 4 safe:

| Phase 3 asset | Why Phase 4 needs it |
|---------------|----------------------|
| `SubmitEventUseCase` | Thin orchestration; side effects can leave the use case |
| `Event` aggregate + ports | Persist facts without embedding queue SDKs in domain |
| `EventTypeHandler` registry | Workers can reuse the same enrichment strategies |
| Client ingest idempotency | Separate from **consumer** idempotency you will add now |

**Not in the project yet:** Redis, BullMQ, outbox table, domain event types, workers, DLQ.

---

## Business goal

Decouple **accepting an event** from **enriching it** so that:

1. The API answers quickly (ingest does not wait for tagging).
2. Enrichment can retry independently when it fails.
3. If the broker dies after the DB commit, work is **not lost** (outbox).
4. Retries do **not** create duplicate tags (idempotent consumers).

---

## Concepts to learn (priority order)

Learn judgment first; install Redis second.

### 1. Domain events (model before transport)

- **Learn:** A domain event is a past-tense fact (`EventIngested`), not a job API. Handlers react; the aggregate / use case does not call Enrichment directly.
- **Why here:** Tagging (and later embeddings / graph / read models) should subscribe to ingest, not be hard-wired in `SubmitEventUseCase`.
- **Done when:** You can list who emits `EventIngested`, when (relative to commit), and who may consume it — without mentioning Redis.

### 2. At-least-once delivery vs exactly-once

- **Learn:** Queues almost always give *at-least-once*. Exactly-once across DB + broker is hard; systems choose at-least-once + **idempotent consumers**.
- **Why here:** Worker retries will re-deliver the same `EventIngested`. Duplicate tag rows must be impossible or no-ops.
- **Done when:** You can explain why “exactly once” is not your design goal and what makes a tagging handler safe to run twice.

### 3. Transactional outbox

- **Learn:** Write domain state + outbox row in the **same** DB transaction. A separate publisher reads unpublished rows and pushes to the queue, then marks them published.
- **Why here:** `commit event` then `queue.add` can lose messages if Redis fails between the two. Outbox removes that hole.
- **Done when:** You can draw the failure mode *without* outbox and the recovery path *with* outbox.

### 4. Async processing / workers

- **Learn:** HTTP path enqueues (or only writes outbox); workers run outside the request lifecycle (retry, concurrency, isolation).
- **Why here:** Extension clients care that ingest was accepted; tagging latency is not on the critical path.
- **Done when:** You can say what stays sync (persist event, write outbox) vs async (suggest tags, persist tags).

### 5. Message queues (BullMQ + Redis as the vehicle)

- **Learn:** Buffer between producer and consumer; retries; job identity; backoff.
- **Why here:** Teaches buffering and failure isolation without Kafka operational cost.
- **Done when:** You can configure a job name, attempts, and what happens after max failures.

### 6. Dead letter queue (DLQ) and backpressure

- **Learn:** Poison messages go to a DLQ after N failures; queue depth is a first-class signal.
- **Why here:** A bad payload or categorizer bug must not block the whole queue forever; spikes must be visible.
- **Done when:** You know how a failed job is inspected/replayed and how you would notice Redis filling up.

### 7. Observability across the async boundary

- **Learn:** Correlation / request IDs from HTTP → outbox → job → worker logs.
- **Why here:** Debugging “event accepted but no tags” spans two processes.
- **Done when:** One `eventId` (and ideally a correlation id) appears in ingest and worker logs.

### Optional depth (later in Phase 4 or Phase 5)

| Concept | When |
|---------|------|
| Saga / process manager | Multiple chained side effects (tag → embed → graph) |
| Separate queues per job type | Slow embedding must not starve tagging |
| In-process EventEmitter first | Optional stepping stone before Redis — still use outbox mindset |
| OpenTelemetry | When traces across HTTP + worker become painful with logs alone |

### Suggested study order

1. Domain events + at-least-once / idempotent consumers (paper).
2. Transactional outbox pattern (diagram the race without it).
3. BullMQ basics (queue, worker, retries, jobId).
4. Wire outbox → publisher → worker in the repo.
5. ADR that **supersedes** “sync tagging in the same transaction.”

---

## What to implement

Implementation order matters. Prefer **correctness (outbox)** over “queue in the use case.”

### Must implement

| # | Item | Responsibility |
|---|------|----------------|
| 1 | **`EventIngested` domain event** | Fact raised after a new event is accepted (payload: event id, user id, type, enough data for enrichment — or id-only + reload). |
| 2 | **Outbox table + migration** | Columns such as `id`, `type`, `payload`, `created_at`, `published_at` (null until published). Written in the **same transaction** as the event insert. |
| 3 | **Change ingest transaction** | Persist `Event` **without** requiring tags on the request path (tags may be empty at accept time). Write outbox row for `EventIngested`. |
| 4 | **Outbox publisher** | Polls/claims unpublished rows → `queue.add` → marks published. Survives Redis blips (rows stay until success). |
| 5 | **Redis + BullMQ** | Queue for enrichment jobs; Nest worker or separate process. |
| 6 | **Enrichment worker** | Load event → `EventTypeHandlerRegistry.getHandler` → `suggestTags` → persist tags **idempotently**. |
| 7 | **Consumer idempotency** | e.g. unique `(event_id, tag)` or “skip if tags already defined”; safe under duplicate jobs. |
| 8 | **Retries + DLQ** | Bounded attempts; failed jobs inspectable; structured error logs. |
| 9 | **ADR(s)** | Async tagging + outbox (supersede sync-tagging decision); note at-least-once + idempotent handlers. |
| 10 | **Tests** | Unit: outbox written with event; handler idempotent. Integration/E2E: ingest → outbox → worker → tags present. |

### Target flow

```
Controller → SubmitEventUseCase
  → Event.create                    // no sync tagging
  → DB transaction: save Event + outbox(EventIngested)
  → HTTP 201/202 accepted

Outbox publisher → BullMQ job

Worker
  → load Event
  → registry handler.suggestTags
  → assign/persist tags (idempotent)
```

### Nice-to-have (still Phase 4)

- Dedicated queues: `enrichment` vs future `embedding`
- Queue depth / lag metrics or health signal
- Graceful worker shutdown
- Correlation id propagated into job payload
- Optional: keep sync tagging behind a feature flag for local/dev only

### Explicitly do **not** implement yet (Phase 5+)

- CQRS read-model tables as the main goal (handlers can *prepare* for them later)
- Materialized views, pgvector, Neo4j
- Kafka / RabbitMQ (Redis + BullMQ is enough to learn the concepts)

### Carry-over from earlier phases (do in parallel if cheap)

- Phase 3 ADRs if still missing (monolith, ingest idempotency) — Phase 4 ADR should reference them
- CI: run migrations before E2E; avoid `synchronize: true` in shared envs

---

## How this changes Phase 3 code (intentionally)

| Today | Phase 4 |
|-------|---------|
| `handler.suggestTags` inside `SubmitEventUseCase` | Move to worker |
| `EventRepository.create` saves event + tags together | Save event (+ empty tags); tags in a later transaction |
| Enrichment failure fails HTTP ingest | Enrichment failure retries in worker; ingest already accepted |
| One request = full enrichment | Eventual consistency: tags appear shortly after accept |

Dashboard / “tags on event” readers must tolerate **brief** missing tags — document that in the ADR.

---

## Learning checklist (explain-it-back)

Check only when you can answer without opening the repo:

- [ ] Why publish-after-commit without outbox loses messages
- [ ] Difference between **client ingest idempotency** and **consumer idempotency**
- [ ] What `EventIngested` contains and what it must not do (no HTTP, no “call five services”)
- [ ] Why the worker uses the same `EventTypeHandler` registry instead of new `if (type)` logic
- [ ] At-least-once vs exactly-once in one sentence each
- [ ] What Phase 5 will hang off the same domain event (read models) without rewriting ingest

---

## Implementation readiness / done-when

Phase 4 is complete when:

- [ ] Ingest responds without waiting for tagging
- [ ] Outbox + worker survive broker restart (unpublished rows still publish)
- [ ] Duplicate jobs do not duplicate tags
- [ ] You can explain at-least-once vs exactly-once and why exactly-once is hard
- [ ] Failures and (at least) queue/job errors are visible in logs
- [ ] Automated test covers ingest → outbox → worker → tag created
- [ ] ADR documents the async decision and supersedes sync tagging

---

## Suggested implementation loop

1. **Paper:** draw sync path vs outbox path; list failure cases.
2. Add `EventIngested` type in domain (no queue yet).
3. Migration: `outbox` table; adjust persist so tags are optional at insert.
4. Write outbox row in the same transaction as the event.
5. Add Redis + BullMQ; publisher moves outbox → queue.
6. Worker runs existing type handlers; idempotent tag persist.
7. Retries + DLQ + logging with `eventId`.
8. E2E/integration proof; write ADR.
9. Only then open Phase 5 (CQRS / read models) using the same `EventIngested` stream.

---

## Common mistakes to avoid

| Mistake | Why it fails Phase 4 |
|---------|----------------------|
| `queue.add` in use case with no outbox | Lost jobs when Redis is down after DB commit |
| Emit domain event before transaction commits | Handlers read missing rows |
| Non-idempotent tag insert | Duplicates on retry |
| Worker imports TypeORM entities as “domain” | Rebuilds Phase 2 coupling |
| One giant job that tags + embeds + graphs | Hard retries; split by concern later |
| Kafka on day one | Ops cost before concepts are solid |

---

## Verdict

Phase 4 is not “add Redis.” It is **reliable async side effects**: domain event → outbox → queue → idempotent worker, while ingest stays a fast, correct write of the `Event` fact.

**Start here:** understand outbox + idempotent consumers on paper, then change `SubmitEventUseCase` so tagging leaves the request path.
