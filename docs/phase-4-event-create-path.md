# Phase 4 — Exact path of `POST /api/v1/events`

Companion docs: [phase-4-concepts.md](./phase-4-concepts.md) · [learning-walkthrough.md](./learning-walkthrough.md) · [ADR 0004](./adr/0004-async-tagging-outbox.md)

This document walks **one create-event request** from the HTTP call to tagged rows in Postgres, explains **how Nest wires and runs** each piece, and shows **how to watch every step locally**.

---

## Big picture (two timelines)

Creating an event is **not one continuous HTTP call**. It splits into:

| Timeline | When | Goal |
|----------|------|------|
| **A — Sync (request)** | During the HTTP request | Validate, persist event + outbox, return `201 accepted` |
| **B — Async (background)** | After the response, same Nest process | Publish outbox → BullMQ → enrich tags |

```text
Timeline A (HTTP thread)                    Timeline B (same Node process)
─────────────────────────                   ────────────────────────────────
Browser / curl
   │
   ▼
Nest HTTP pipeline
   │
   ▼
SubmitEventUseCase
   │
   ▼
Postgres TX: events + outbox_messages
   │
   ▼
201 { id, status: "accepted" }  ──────────►  (client done)

                                            OutboxPublisher (@Interval 2s)
                                               │
                                               ▼
                                            Redis / BullMQ queue "enrichment"
                                               │
                                               ▼
                                            EnrichmentProcessor
                                               │
                                               ▼
                                            EnrichEventTagsUseCase
                                               │
                                               ▼
                                            Postgres: tags + tags_assigned
```

Everything below lives in **one Nest process** started with `npm run start:dev`. There is no separate worker terminal today.

---

## How Nest starts and wires this

### Bootstrap

`src/main.ts`:

1. `NestFactory.create(AppModule)` builds the DI container from `@Module` graphs.
2. Global prefix `api/v1` → controller `@Controller('events')` becomes `POST /api/v1/events`.
3. Global `ValidationPipe` validates/transforms the body against `SubmitEventDto` **before** the controller method runs.
4. `app.listen(PORT ?? 3000)`.

### Module graph (what Nest loads)

```text
AppModule
├── AlsModule + correlation middleware (forRoutes '*')
├── TypeOrmModule (Postgres)
├── EventModule
│   ├── EventController
│   ├── SubmitEventUseCase          (factory provider)
│   ├── EnrichEventTagsUseCase      (factory provider)
│   ├── TypeOrmEventRepository      (EVENT_REPOSITORY + OUTBOX_STORE)
│   └── EventTypeHandlerRegistry    (WEB_VISIT / APP_VISIT handlers)
└── EnrichmentQueueModule
    ├── ScheduleModule              → enables @Interval
    ├── BullModule (Redis)          → queues "enrichment" + "enrichment-dlq"
    ├── OutboxPublisher             → polls outbox every 2s
    └── EnrichmentProcessor         → BullMQ worker for "enrichment"
```

**Dependency injection (ports & adapters):** use cases depend on **tokens** (`EVENT_REPOSITORY`, `OUTBOX_STORE`, …), not on TypeORM classes directly. `EventModule` binds those tokens to `TypeOrmEventRepository`. That is how Nest keeps application code free of infrastructure imports while still injecting concrete adapters at runtime.

**Same process, two Nest mechanisms for async work:**

| Piece | Nest / library hook | Role |
|-------|---------------------|------|
| `OutboxPublisher` | `@Injectable` + `@Interval(2000)` (`@nestjs/schedule`) | Cron-like poll of Postgres outbox |
| `EnrichmentProcessor` | `@Processor('enrichment')` extends `WorkerHost` (`@nestjs/bullmq`) | Redis-backed job consumer |

Neither is called from the controller. Nest instantiates them as providers when `EnrichmentQueueModule` loads; the scheduler and BullMQ worker start with the app.

---

## Timeline A — Sync request path (step by step)

### Step 0 — You send the request

```bash
# 1) login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}' \
  | jq -r '.access_token // .token')

# 2) create event (optional client idempotency key: "id")
curl -i -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H "x-correlation-id: demo-corr-001" \
  -d '{
    "type": "WEB_VISIT",
    "timestamp": "2026-08-06T15:30:00.000Z",
    "source": "browser_extension",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "metadata": {
      "url": "https://github.com",
      "title": "GitHub",
      "browser": "chrome"
    }
  }'
```

**What you should see immediately**

- HTTP `2xx` with body like `{ "id": "<uuid>", "status": "accepted" }`.
- Response header `x-correlation-id: demo-corr-001` (or a generated UUID if you omitted the header).
- Tags are **not** required in this response — enrichment is async.

---

### Step 1 — Correlation middleware (`AppModule`)

File: `src/app.module.ts` → `configure(consumer)`.

Nest runs this Express middleware for every route:

1. Reads `x-correlation-id` or generates a UUID.
2. Sets the same value on the response header.
3. Wraps the rest of the request in `AsyncLocalStorage.run({ correlationId }, next)`.

Later, `AlsCorrelationIdProvider` reads that ALS store so `EventIngested` carries the same id into the outbox / job payload. That is how you correlate HTTP logs with worker logs.

**How Nest handles it:** `AppModule implements NestModule` + `MiddlewareConsumer`. This is Express middleware registered by Nest, not a guard or interceptor.

---

### Step 2 — Guards, pipes, controller

File: `src/presentation/event/event.controller.ts`.

Nest pipeline order for this route:

1. **Guards** — `@UseGuards(JwtAuthGuard)` validates the Bearer JWT and attaches `request.user` (`userId`, …). Fail → `401`, never hits the use case.
2. **Pipes** — global `ValidationPipe` validates `SubmitEventDto` (type, timestamp, source, metadata, optional `id`). Fail → `400`.
3. **Controller method** — thin: maps DTO → use case input, returns `SubmitEventResponseDto`.
4. **Filters** — `@UseFilters(DomainExceptionFilter)` maps domain/application exceptions to HTTP responses if thrown.

```text
HTTP → Middleware (ALS) → JwtAuthGuard → ValidationPipe → EventController.submit
                                                              │
                                                              ▼
                                                    SubmitEventUseCase.execute
```

The controller does **not** talk to Redis, outbox, or taggers. Nest injects `SubmitEventUseCase` via the constructor because `EventModule` registered it as a provider.

---

### Step 3 — `SubmitEventUseCase` (application orchestration)

File: `src/application/event/submit-event-use-case.ts`.

Exact sequence inside `execute(userId, props)`:

| # | Action | Why |
|---|--------|-----|
| 1 | `eventSourceLookup.findIdByCode(props.source)` | Resolve `browser_extension` → source UUID; missing → `EventSourceNotFoundException` |
| 2 | If `props.id` present: `findByUserIdAndExternalEventId` | Client idempotency — duplicate client id returns same accepted id without rewriting |
| 3 | `eventTypeHandlerRegistry.getHandler(props.type)` | **Fail-fast only** — ensure `WEB_VISIT` / `APP_VISIT` exists; does **not** call `suggestTags` here |
| 4 | Log `event.create.started` | Observability |
| 5 | `Event.create(...)` | Domain aggregate with `tagsAssigned = false` (no tags yet) |
| 6 | `new EventIngested(eventId, userId, type, correlationId)` | Domain event = past fact |
| 7 | `OutboxMessage.createFromDomainEvent(domainEvent)` | Durable message for the publisher |
| 8 | `eventRepository.create(event, [outboxMessage])` | Same DB transaction |
| 9 | Log `event.create.succeeded` | Includes `eventId` + `outboxType` |
| 10 | Return `{ id, status: 'accepted' }` | HTTP ends |

**Mental model:** the use case says “this event was ingested.” It does **not** enrich. Enrichment reacts later to `EventIngested`.

---

### Step 4 — Repository transaction (Postgres)

File: `src/infrastructure/typeorm/event-repository.ts` → `create`.

Inside `dataSource.transaction`:

1. `INSERT` into `events` (`tags_assigned = false`, no tag rows yet in the happy path).
2. `INSERT` into `outbox_messages` (`type = 'EventIngested'`, `published_at = NULL`, JSON payload with `eventId`, `userId`, `eventType`, `correlationId`).
3. Commit both or neither.

If Redis is down at this moment, **nothing is lost**: the outbox row stays unpublished until the publisher can enqueue.

Unique violation on `(user_id, external_event_id)` → `DuplicateExternalEventException` → use case may still return `accepted` with the existing id (idempotent client retries).

**How Nest handles it:** `TypeOrmEventRepository` is `@Injectable()`. Nest injects TypeORM repositories + `DataSource` via `@InjectRepository` / constructor DI. The use case only sees the `EventRepository` port.

---

### Step 5 — HTTP response

Controller maps the result to:

```json
{ "id": "<server event uuid>", "status": "accepted" }
```

**Timeline A is done.** Tags are not ready yet.

---

## Timeline B — Async enrichment path

These steps run in the **same Nest process**, outside the HTTP request lifecycle.

### Step 6 — `OutboxPublisher` polls every 2 seconds

File: `src/infrastructure/queue/outbox-publisher.service.ts`.

How Nest triggers it:

- `ScheduleModule.forRoot()` in `EnrichmentQueueModule`.
- Method annotated `@Interval(2000)` → Nest’s scheduler calls `handleInterval()` every 2s.
- If `OUTBOX_PUBLISHER_ENABLED=false`, it no-ops (useful to freeze the pipeline and inspect the outbox).

Inside `publishPending()`:

1. Guard with `publishing` flag so overlapping ticks do not double-claim.
2. `outboxStore.claimUnpublished(batchSize)` — Postgres `SELECT … FOR UPDATE SKIP LOCKED` on rows with `published_at IS NULL`.
3. For each `EventIngested` message, build `EnrichEventJobPayload`.
4. `enrichmentQueue.add('enrich-event', payload, { jobId: 'outbox:<outboxId>', attempts: 5, backoff: exponential })`.
5. Log `outbox.published`.
6. `markPublished(ids)` — set `published_at`.
7. Log `queue.depth` (waiting / active / delayed / failed + unpublished outbox count).

Stable `jobId: outbox:<id>` means republishing the same outbox row does not create a second parallel BullMQ job.

**How Nest handles it:** `@InjectQueue(ENRICHMENT_QUEUE)` injects a BullMQ `Queue` connected to Redis (configured in `BullModule.forRootAsync`). The publisher is a Nest provider, not an HTTP route.

---

### Step 7 — Job sits in Redis (BullMQ)

Queues registered in `EnrichmentQueueModule`:

| Queue name | Purpose |
|------------|---------|
| `enrichment` | Main enrichment jobs |
| `enrichment-dlq` | Dead letters after attempts are exhausted |

Job name: `enrich-event`  
Payload shape (`enrichment-queue.constants.ts`): `outboxMessageId`, `eventId`, `userId`, `eventType`, `correlationId`, `domainEventType`.

Delivery semantics: **at-least-once**. Retries can redeliver; consumers must be idempotent.

---

### Step 8 — `EnrichmentProcessor` consumes the job

File: `src/infrastructure/queue/enrichment.processor.ts`.

How Nest / BullMQ handles it:

- `@Processor(ENRICHMENT_QUEUE)` registers a worker for queue `enrichment`.
- Class extends `WorkerHost`; Nest creates the BullMQ Worker when the module initializes.
- `process(job)` runs for each job (not inside an HTTP request; no JWT, no ALS from the original request — correlation comes from **job payload**).

Inside `process`:

1. Log `enrichment.started` (includes `jobId`, `eventId`, `correlationId`, attempt).
2. `enrichEventTagsUseCase.execute(eventId)`.
3. If status `not_found` → throw (retry / eventually DLQ).
4. Log `enrichment.completed`.

On failure after max attempts, `@OnWorkerEvent('failed')` moves a copy to `enrichment-dlq` and logs `enrichment.dead_lettered`.

---

### Step 9 — `EnrichEventTagsUseCase` (idempotent consumer)

File: `src/application/event/enrich-event-tags-use-case.ts`.

| # | Action | Outcome |
|---|--------|---------|
| 1 | `findById(eventId)` | Missing → `not_found` |
| 2 | `areTagsAssigned()` | Already true → `already_enriched` (safe retry) |
| 3 | `getHandler(eventType).suggestTags(metadata)` | Rule-based tags (URL / app name) |
| 4 | `event.assignTags(suggested)` | Domain: assign once |
| 5 | `persistAssignedTags(event)` | DB write |
| 6 | Log `event.enrich.succeeded` | Via use case logger |

`persistAssignedTags` (repository):

- Locks the event row (`pessimistic_write`).
- If `tags_assigned` already true → return as-is (second safety layer).
- Else set `tags_assigned = true` and insert `event_tags` rows.

Empty tag list still marks `tags_assigned = true`, so retries do not loop forever.

---

### Step 10 — End state in Postgres

For a successful `WEB_VISIT` to `https://github.com` you should eventually see:

- `events.tags_assigned = true`
- one or more rows in `event_tags` for that `event_id`
- matching `outbox_messages.published_at` set
- BullMQ job completed (or gone if `removeOnComplete` pruned it)

---

## Log sequence you should see

With `npm run start:dev` and a successful create, logs appear roughly in this order (structured JSON with an `event` / message field):

```text
event.create.started
event.create.succeeded          ← HTTP can already have returned
outbox.published                ← ≤ ~2s later
queue.depth
enrichment.started
event.enrich.succeeded          ← from EnrichEventTagsUseCase
enrichment.completed
```

If enrichment was already done (retry): `event.enrich.already_enriched` then `enrichment.completed` with `status: already_enriched`.

If Redis was down while publisher runs: `outbox.publish.failed`; outbox rows stay with `published_at IS NULL` until Redis recovers.

---

## How Nest “handles the logic” (short mental model)

Nest is the **composition root + runtime**, not the place where business rules live.

| Concern | Who owns it | Nest’s job |
|---------|-------------|------------|
| HTTP routing / JWT / DTO validation | Presentation | Controllers, guards, pipes |
| “Accept event + record EventIngested” | `SubmitEventUseCase` + domain | Inject ports into the use case |
| “Tag this event once” | `EnrichEventTagsUseCase` + domain | Inject same ports into worker path |
| Persist event + outbox atomically | `TypeOrmEventRepository` | Provide TypeORM + bind tokens |
| Poll outbox | `OutboxPublisher` | Instantiate + run `@Interval` |
| Run jobs | `EnrichmentProcessor` | Register BullMQ `@Processor` |
| Correlation across async boundary | ALS middleware + payload field | Middleware stores id; worker reads job data |

Business rules (`Event.create`, `assignTags`, handler `suggestTags`) stay in domain / application. Nest only **discovers**, **injects**, and **schedules**.

---

## How to watch each step locally

### Prerequisites

```bash
docker compose up -d db redis
cp .env.example .env   # if needed
npm run migration:run
npm run start:dev
```

Confirm in `.env`: `OUTBOX_PUBLISHER_ENABLED=true`, Redis host/port match Docker.

---

### A) Watch Nest logs (easiest)

In the `start:dev` terminal, after `POST /api/v1/events`, grep mentally (or pipe logs) for the events listed above. Pass `x-correlation-id` and confirm the same value appears in `outbox.published` and `enrichment.*` logs.

---

### B) Freeze between sync and async (outbox inspection)

1. Set `OUTBOX_PUBLISHER_ENABLED=false` and restart.
2. `POST /api/v1/events` → you get `accepted`.
3. Inspect Postgres — event exists, tags not assigned, outbox unpublished:

```sql
-- latest events
SELECT id, event_type, tags_assigned, external_event_id, created_at
FROM events
ORDER BY created_at DESC
LIMIT 5;

-- unpublished outbox
SELECT id, type, payload, created_at, published_at
FROM outbox_messages
WHERE published_at IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- tags should be empty for that event until enrichment runs
SELECT * FROM event_tags WHERE event_id = '<paste-event-id>';
```

4. Set `OUTBOX_PUBLISHER_ENABLED=true`, restart (or call `publishPending()` from a test), then re-query: `published_at` set, `tags_assigned = true`, tag rows present.

---

### C) Watch Redis / BullMQ

With Redis from Docker:

```bash
docker compose exec redis redis-cli KEYS '*enrichment*'
docker compose exec redis redis-cli LLEN bull:enrichment:wait
docker compose exec redis redis-cli LLEN bull:enrichment:active
```

Counts move quickly under local load (jobs finish in milliseconds). `queue.depth` in Nest logs is usually clearer.

To force a dead letter: temporarily break enrichment (e.g. point at a missing event id in a crafted job) and watch `enrichment.failed` → after attempts → `enrichment.dead_lettered` and keys/jobs under `enrichment-dlq`.

---

### D) E2E path (automated)

```bash
npm run test:e2e -- test/events.e2e-spec.ts
```

That suite exercises ingest → outbox → publisher → tags (and double enrichment / idempotency). Useful when you change the pipeline and want a regression check without manual curl.

---

### E) Timeline cheat sheet

| Moment | What to check |
|--------|----------------|
| Right after HTTP 201 | `events` row; `outbox_messages` with `published_at IS NULL` (if you froze publisher) or already published (if publisher on) |
| Within ~2s | Log `outbox.published`; outbox `published_at` set |
| Immediately after publish | Log `enrichment.started` → `enrichment.completed` |
| After enrichment | `events.tags_assigned = true`; rows in `event_tags` |
| Same `id` posted twice | Same event id returned; no duplicate outbox storm / no duplicate tags |
| Redis down | HTTP still accepts; outbox accumulates; publisher logs failures until Redis returns |

---

## File map (follow in the IDE)

| Step | File |
|------|------|
| Bootstrap | `src/main.ts` |
| Modules + ALS middleware | `src/app.module.ts` |
| HTTP entry | `src/presentation/event/event.controller.ts` |
| Nest wiring for events | `src/presentation/event/event.module.ts` |
| Sync use case | `src/application/event/submit-event-use-case.ts` |
| Domain event | `src/domain/domain-event/event-ingested.ts` |
| Outbox value | `src/domain/outbox/outbox-message.ts` |
| Aggregate | `src/domain/event/event.ts` |
| TX + outbox store | `src/infrastructure/typeorm/event-repository.ts` |
| Queue module | `src/infrastructure/queue/enrichment-queue.module.ts` |
| Publisher | `src/infrastructure/queue/outbox-publisher.service.ts` |
| Worker | `src/infrastructure/queue/enrichment.processor.ts` |
| Async use case | `src/application/event/enrich-event-tags-use-case.ts` |

---

## One-sentence summary

**Nest accepts the HTTP request, the use case writes the event and an `EventIngested` outbox row in one Postgres transaction and returns `accepted`; then the same Nest process’s scheduler publishes that row to Redis/BullMQ and the BullMQ processor runs the enrichment use case to assign tags idempotently.**
