# Echoes Engine — Learning Walkthrough

I am building a personal backend project called **Echoes Engine**. Its primary goal is to help me learn and practice **senior-level backend engineering** through incremental development.

Echoes Engine is a NestJS API that receives browsing events from a browser extension, authenticates users, and enriches those events (tagging, analytics, semantic search, recommendations). Each phase of the roadmap adds product capability *and* introduces engineering concepts in an order that mirrors how real systems evolve.

This document analyzes the roadmap from a **software engineering learning perspective** — what you are learning, why it matters at that stage, and how you know when to move on.

---

## Roadmap overview

```
1. MVP
   ├── Nest · PostgreSQL · JWT · Validation · Testes

2. Product Engineering
   ├── Idempotência · Transações · Migrations · Observabilidade · Segurança

3. Arquitetura
   ├── Modular Monolith · DDD · ADRs · Clean Architecture

4. Escala
   ├── Async Processing · Domain Events · Outbox · Filas

5. Analytics
   ├── CQRS · Read Models · Materialized Views

6. IA
   ├── Embeddings · pgvector · RAG

7. Memory Graph
   ├── Neo4j · Recommendation Engine
```

### Technology vs concept (read this once)

Technologies are **vehicles** for concepts. The goal is to learn the concept so you can swap the tool later.

| Technology in this project | Underlying concept it teaches |
|---------------------------|-------------------------------|
| NestJS | Modular application composition, dependency injection, request lifecycle |
| PostgreSQL | Relational modeling, ACID, constraints, indexing, schema evolution |
| JWT / Passport | Stateless authentication, credential verification, request guards |
| class-validator | Input validation at system boundaries, contract enforcement |
| Jest / Supertest | Test pyramid, isolation vs integration, regression safety |
| TypeORM migrations | Versioned schema change, deploy reproducibility |
| Redis / BullMQ | Message buffering, async decoupling, at-least-once delivery |
| pgvector | Vector similarity search, semantic retrieval |
| Neo4j | Graph traversal, relationship-centric modeling |
| OpenAI / LLM APIs | Retrieval-augmented generation, prompt grounding |

---

## Current project state (reference)

| Area | Status | Where to look |
|------|--------|---------------|
| User CRUD + JWT login | ✅ | `src/presentation/user/`, `src/presentation/auth/`, `src/application/user/`, `src/application/auth/` |
| Event ingest + idempotency | ✅ | `src/application/event/submit-event-use-case.ts`, unique index migration |
| URL + app rule-based tagging | ✅ | `src/domain/event-tag/url-tag-categorizer.ts`, `app-name-tag-categorizer.ts` |
| Unit + E2E tests + CI | ✅ | `src/**/*.spec.ts`, `test/`, `.github/workflows/` — 🟡 CI still missing migrations-before-E2E |
| DDD / Clean Architecture | 🟡 | Layers + use cases + ports in place; ADRs and a few ops/docs gaps remain |
| Event type registry (`WEB_VISIT` / `APP_VISIT`) | ✅ | `src/infrastructure/event-type/`, `EventTypeHandlerRegistry` |
| Async, CQRS, IA, Graph | ⬜ | Not started (Phase 4+) |

**Architecture today:**

```
Controller → UseCase → Domain aggregate + ports → Infrastructure adapters (TypeORM, JWT, handlers)
```

Example ingest path:

```
EventController → SubmitEventUseCase
  → EventSourceLookup
  → EventTypeHandlerRegistry.getHandler(type)
  → Event.create → handler.suggestTags → Event.assignTags
  → EventRepository.create
```

Domain has **zero** NestJS/TypeORM imports. Pure domain references: `src/domain/event-tag/url-tag-categorizer.ts`, `src/domain/event/event.ts`, `src/domain/value-objects/`.

**Phase 3 progress detail:** [phase-3-learn-and-implement.md](./phase-3-learn-and-implement.md) · [phase-3-architecture-summary.md](./phase-3-architecture-summary.md)

---

## Roadmap order evaluation

**Verdict: the order is sound.** It follows a natural progression from *make it work* → *make it reliable* → *make it maintainable* → *make it scale* → *make it insightful*.

| Phase transition | Why the order works |
|------------------|---------------------|
| MVP → Product Engineering | You cannot harden what does not exist. Reliability concepts (idempotency, transactions) need a running ingest path first. |
| Product Engineering → Arquitetura | Refactoring without production pain is abstract. After idempotency bugs and schema drift, layered architecture becomes motivated. |
| Arquitetura → Escala | Async patterns are easier to reason about once you have domain boundaries and use cases — otherwise events and queues become spaghetti. |
| Escala → Analytics | Read models and CQRS benefit from domain events and async handlers already in place. |
| Analytics → IA | Semantic search needs volume and query patterns; RAG needs retrieval infrastructure (indexes, user scoping). |
| IA → Memory Graph | Recommendations combine embeddings (similarity) with graph structure (relationships) — both prerequisites. |

**Suggested adjustments:**

| Issue | Recommendation |
|-------|----------------|
| Observabilidade in Phase 2 is slightly early for full tracing | Keep **structured logging + health checks** in Phase 2; defer **OpenTelemetry** to Phase 4 when async paths multiply debugging surface. |
| ADRs in Phase 3 | Write your **first ADR in Phase 2** when you decide idempotency strategy or transaction boundaries — decisions happen before the ADR folder exists. |
| Segurança RBAC before Arquitetura | Basic route protection belongs in **Phase 1**; rate limiting and audit logs fit **Phase 2**. RBAC can wait until Phase 3 when bounded contexts clarify roles. |
| Materialized Views before async read models | Build **read model tables updated by handlers first** (Phase 5a), then add materialized views when SQL aggregations become slow (Phase 5b). |
| Neo4j before proving graph need | Consider a **Phase 5.5**: graph-like queries in PostgreSQL (recursive CTEs, adjacency patterns) before adding Neo4j — teaches when a graph DB is actually warranted. |

---

### Phase 1 — MVP

**Business Goal**

Build a working API that satisfies the browser extension contract: users can register, log in, and submit `WEB_VISIT` events that are persisted and auto-tagged by URL.

Functionality delivered:
- `POST /api/v1/auth/login` → JWT token
- `POST /api/v1/events` → accepted event with optional idempotency via client `id`
- User registration and persistence
- Rule-based URL categorization

---

**Engineering Problems**

- How does an HTTP request flow through a modular server application?
- How do you persist structured and semi-structured data (relational columns + JSON metadata)?
- How do you authenticate a stateless client (browser extension) without sessions?
- How do you reject malformed input before it reaches business logic?
- How do you verify behavior without manual testing every change?

---

**Concepts Learned**

**Application composition and dependency injection**
- *Explanation:* Features are grouped into modules with explicit dependencies. Objects receive collaborators through constructors rather than constructing them internally.
- *Why it matters here:* Before reliability or scale, you need a structure that does not collapse under the first new feature. DI makes testing and swapping implementations possible later.

**Relational data modeling**
- *Explanation:* Entities, relationships, foreign keys, and JSONB for flexible payloads. Normalized storage with referential integrity.
- *Why it matters here:* Events belong to users and sources. You must model ownership and deletion behavior (`ON DELETE CASCADE`) from day one.

**Stateless authentication**
- *Explanation:* Server verifies identity via signed token on each request. No server-side session store.
- *Why it matters here:* The extension is offline-capable and retries requests. Session cookies are a poor fit; bearer tokens are the standard pattern.

**Boundary validation**
- *Explanation:* The HTTP layer validates shape and type of input. Invalid requests fail fast with 4xx responses.
- *Why it matters here:* The extension sends queue metadata (`attempts`, `createdAt`) alongside required fields. The API must define what it accepts and rejects explicitly.

**Testing pyramid**
- *Explanation:* Many fast unit tests (isolated logic), fewer integration/E2E tests (real database, full HTTP stack).
- *Why it matters here:* MVP velocity depends on confidence to refactor. Without tests, every later phase becomes risky.

**Technology mapping:** NestJS teaches composition/DI; PostgreSQL teaches relational modeling; JWT teaches stateless auth; class-validator teaches boundary validation; Jest teaches the testing pyramid.

**Missing concepts that naturally emerge here:**
- **Configuration validation** — fail at boot if `JWT_SECRET` is missing in production
- **API contract documentation** — OpenAPI derived from DTOs
- **Health/readiness endpoints** — minimum operability signal
- **Separation of DTO vs domain model** — hinted at but not yet enforced (Phase 3)

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | Layered request handling (controller → service → persistence) |
| Architectural | Feature modules with explicit import graph |
| Design | DTO pattern for API input/output |
| Design | Repository pattern (via TypeORM, implicit) |
| Design | Guard pattern for authentication |
| Engineering | Convention over configuration (global prefix, global validation pipe) |
| Engineering | Environment-based configuration |
| Engineering | Contract-first API design (`docs/mvp-endpoints.md`) |

---

**Skills Acquired**

- Bootstrap a modular HTTP API and wire database, config, and feature modules
- Model a multi-table schema with JSONB metadata
- Implement login + JWT-protected endpoints
- Write DTOs with declarative validation
- Write unit tests with mocks and E2E tests against a real Postgres instance
- Read and implement against an external client contract (the extension)
- Run the stack locally with Docker Compose

---

**Common Mistakes**

- Putting business rules in controllers or DTOs instead of services (or later, domain)
- Using `synchronize: true` in production because it is convenient in dev
- Exposing all CRUD endpoints without authentication (`GET /users` listing everyone)
- Confusing authentication (JWT present) with authorization (user allowed to do action)
- Skipping E2E tests and relying only on unit tests with mocked repositories
- Hardcoding secrets or using default `JWT_SECRET` outside local dev
- Treating ORM entities as domain models without questioning the coupling

---

**Readiness Check**

Move to Phase 2 when you can answer **yes** to all:

- [ ] Extension connects end-to-end: login → submit event → event persisted
- [ ] E2E tests cover auth, validation failures, and happy-path ingest
- [ ] You can explain the request path from `main.ts` to database save without looking at code
- [ ] Invalid payloads return 400; missing token returns 401
- [ ] You understand why password hash is never returned in API responses
- [ ] Health endpoint exists on the NestJS app (not only on the Cloudflare worker stub)

**Code to study:** `src/main.ts`, `src/app.module.ts`, `src/auth/`, `src/events/`, `test/events.e2e-spec.ts`, `docs/mvp-endpoints.md`

---

### Phase 2 — Product Engineering

**Business Goal**

Transform the MVP into something you would trust running continuously: duplicate events from client retries do not corrupt data, multi-step writes are atomic, schema changes are versioned, failures are diagnosable, and the API resists basic abuse.

Functionality delivered:
- Database-enforced idempotency for client event IDs
- Transactional event + tag persistence
- Migration-driven schema (no `synchronize` in deployed environments)
- Structured logging, correlation IDs, health/readiness
- Rate limiting, route protection, audit trail foundations

---

**Engineering Problems**

- The extension retries failed requests — how do you prevent duplicate events under concurrency?
- Saving an event and its tags are two writes — what happens if the second fails?
- How do you change the database schema in production without downtime or data loss?
- When ingest fails at 2 AM, how do you know what happened without reproducing locally?
- How do you protect login and ingest endpoints from abuse?

---

**Concepts Learned**

**Idempotency**
- *Explanation:* Repeating the same request produces the same outcome without duplicate side effects. Implemented via client-supplied key + unique constraint.
- *Why it matters here:* The extension queue retries up to 5 times. Without idempotency, every retry creates a duplicate row.

**ACID transactions**
- *Explanation:* Multiple database operations succeed or fail as a unit. Atomicity prevents partial state (event saved, tag missing).
- *Why it matters here:* Ingest + enrichment is a natural multi-step operation. Partial failure is a data integrity bug, not an edge case.

**Schema migration discipline**
- *Explanation:* Database changes are versioned, reviewed, and applied in order — not auto-synced from entity definitions.
- *Why it matters here:* Once data exists in production, `synchronize: true` can drop columns or indexes silently. Migrations make change auditable.

**Observability (logs, metrics, health)**
- *Explanation:* Systems emit structured signals about their behavior. Liveness tells you the process runs; readiness tells you it can serve traffic.
- *Why it matters here:* Retries and async clients make debugging hard with plain `console.log`. Correlation IDs link one logical operation across log lines.

**Defense in depth (security)**
- *Explanation:* Multiple layers — authentication, authorization, rate limiting, input validation, secure defaults.
- *Why it matters here:* Browsing data is sensitive. A public `GET /users` or unlimited login attempts are unacceptable even in a personal project.

**Technology mapping:** PostgreSQL unique indexes teach idempotency enforcement; TypeORM transactions teach ACID boundaries; TypeORM migrations teach schema evolution; Pino/Prometheus teach observability; Throttler teaches rate limiting.

**Missing concepts that naturally emerge here:**
- **Graceful shutdown** — finish in-flight requests before process exit
- **Configuration schema validation** — Zod/Joi at boot
- **Error contract normalization** — consistent `{ error, code }` across endpoints
- **First ADR** — document idempotency and transaction decisions when you make them
- **Privacy basics** — `trackingEnabled` flag enforced on ingest; user data export/delete sketched

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | Idempotent receiver (check-then-act + constraint fallback) |
| Architectural | Transaction script (explicit transaction boundary around use case) |
| Design | Fail-fast configuration |
| Design | Global exception filter |
| Engineering | Migration-first schema management |
| Engineering | Structured logging with correlation ID |
| Engineering | CI pipeline as quality gate (tests + lint + migrations) |
| Engineering | Principle of least privilege on routes |

---

**Skills Acquired**

- Design idempotency at application and database levels; explain race conditions under concurrent duplicate submits
- Wrap multi-table writes in transactions and test rollback behavior
- Author and run migrations; align migration with documented target schema
- Add structured logging and distinguish liveness from readiness
- Apply rate limiting and close public endpoints that leak data
- Write integration tests for concurrency and failure paths
- Document a significant decision in an ADR (idempotency strategy or sync tagging)

---

**Common Mistakes**

- Idempotency only in application code without a DB unique constraint — race conditions still duplicate rows
- Transactions that are too broad (locking unrelated rows) or too narrow (missing related writes)
- Running migrations manually in production without CI verification
- Logging unstructured strings that cannot be searched or correlated
- Adding observability only after a production incident instead of before scale
- Rate limiting only on login but not on ingest (or vice versa)
- Catching all errors and returning generic `400` — hides root cause from operators and clients

---

**Readiness Check**

Move to Phase 3 when:

- [X] Duplicate event submits (same client `id`) return the same server `id` under sequential and concurrent requests
- [X] Event + tags are atomic — you have a test proving rollback on tag failure
- [ ] CI runs migrations before E2E tests; no environment uses `synchronize` except local optional dev
- [X] Logs include request/correlation ID; `/ready` fails when Postgres is down
- [X] Login and ingest are rate-limited; user list is not publicly accessible
- [X] You can explain the difference between idempotency and deduplication

**Code to study:** `src/application/event/submit-event-use-case.ts`, `docs/initial-sql.md`, `src/migrations/`, `.github/workflows/ci-cd.yml`

---

### Phase 3 — Arquitetura

**Business Goal**

Restructure the codebase so new features (event types, connectors, analytics) can be added without modifying unrelated modules. Business rules live in the domain; frameworks live at the edges. Architectural decisions are documented for future you.

Functionality delivered (target):
- Bounded contexts: Identity, Ingestion, Enrichment
- Use cases (`SubmitEventUseCase`) replacing fat services
- Rich domain model (`Event` aggregate, `Email` / `EventType` value objects)
- Repository interfaces in domain, TypeORM in infrastructure
- ADR folder with decisions on monolith, idempotency, sync vs async tagging

**Progress vs this codebase (updated):**

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Layered `domain/` / `application/` / `infrastructure/` / `presentation/` | ✅ | Nest modules wire adapters |
| Use cases replace fat services | ✅ | Events, auth, users, dashboard |
| Domain free of Nest/TypeORM | ✅ | Verified under `src/domain/` |
| Repository ports + TypeORM adapters | ✅ | `EventRepository`, `UserRepository`, … |
| Rich `Event` (tags + type invariant) | ✅ | `assignTags`, `EventType` VO, `event.spec.ts` |
| Enrichment not inside ORM/Event invent rules | ✅ | Handlers + categorizers; Event only assigns tags |
| Event type registry (`WEB_VISIT`, `APP_VISIT`) | ✅ | `EventTypeHandlerRegistry` + handlers |
| Explicit Command (DTO → command) | ⬜ | DTO still passed into use case props |
| `docs/adr/` (monolith, idempotency, sync tagging) | ⬜ | Decisions exist in code only |
| CI migrations before E2E; no shared `synchronize` | ⬜ | Phase 2 ops carry-over |

What to learn/implement next: [phase-3-learn-and-implement.md](./phase-3-learn-and-implement.md)

---

**Engineering Problems**

- Business logic is scattered across services that know about HTTP and SQL — how do you test rules without a database? → *Addressed for ingest: domain + use case unit tests with fakes.*
- Adding a second event type risks breaking existing ingest — how do you extend safely? → *Addressed: `APP_VISIT` registered beside `WEB_VISIT` without editing submit orchestration.*
- Future you (or a teammate) will ask "why did we do X?" — where is that recorded? → *Still open: write ADRs.*
- Framework coupling makes swapping persistence or transport expensive — how do you invert dependencies? → *Addressed for persistence and type handlers; keep practicing the dependency rule.*

---

**Concepts Learned**

**Modular monolith** — 🟡 in code, ⬜ documented
- *Explanation:* One deployable unit composed of well-bounded modules that communicate in-process. Extraction to microservices remains possible later.
- *Why it matters here:* Echoes does not need distributed systems complexity yet. Module boundaries teach service boundaries without network overhead.

**Domain-Driven Design (DDD)** — 🟡
- *Explanation:* Model software around business concepts — aggregates, value objects, domain services, ubiquitous language.
- *Why it matters here:* "Event" means something different to the extension (`WEB_VISIT`) vs the domain (ingested fact with invariants). DDD clarifies that vocabulary.
- *In repo now:* `Event`, `EventTag`, `EventType`, `Email`; deepen aggregate judgment via Vernon.

**Clean Architecture / Ports and Adapters** — 🟡→✅ for ingest path
- *Explanation:* Dependencies point inward. Domain knows nothing about NestJS, TypeORM, or HTTP. Infrastructure implements interfaces defined by inner layers.
- *Why it matters here:* After Phase 2 pain, you feel why a service importing `Repository<Event>` makes unit testing domain rules awkward.
- *In repo now:* `EventRepository`, `EventSourceLookup`, `EventTypeHandlerRegistry`, password/token ports.

**Architecture Decision Records (ADRs)** — ⬜
- *Explanation:* Short documents capturing context, decision, and consequences for significant technical choices.
- *Why it matters here:* Phases 4–7 introduce Redis, pgvector, Neo4j. Without ADRs, you forget why PostgreSQL remains source of truth.

**Open/Closed Principle** — ✅ for current types
- *Explanation:* Open for extension (new event types), closed for modification (existing ingest path unchanged).
- *Why it matters here:* Connectors (`github_connector`, `spotify_connector`) are already seeded. The architecture must absorb them without rewriting core ingest.
- *In repo now:* register a handler + extend `EventType` / DTO; do not add `if (type === …)` in `SubmitEventUseCase`.

**Technology mapping:** NestJS modules teach modular monolith boundaries; folder structure (`domain/`, `application/`, `infrastructure/`) teaches Clean Architecture; markdown ADRs teach decision documentation — no new infrastructure required.

**Missing concepts that naturally emerge here:**
- **Anti-corruption layer** — when external connector payloads differ from internal domain model
- **Domain events (modeling only)** — define `EventIngested` in domain before async infra in Phase 4
- **Policy pattern** — `TrackingPolicy` checks `UserSettings` as explicit domain rule
- **Specification pattern** — composable query predicates for complex filters (feeds Phase 5)

---

**Patterns and Practices**

| Type | Pattern / practice | In repo? |
|------|-------------------|----------|
| Architectural | Modular monolith with bounded contexts | 🟡 modules; contexts informal |
| Architectural | Clean Architecture / Hexagonal (ports & adapters) | ✅ ingest/auth |
| Architectural | Use case / application service layer | ✅ |
| Design | Aggregate root (`Event` owns tags) | ✅ |
| Design | Value object (`Email`, `EventType`, …) | ✅ partial (`Url` optional) |
| Design | Repository interface + implementation split | ✅ |
| Design | Event type registry (strategy per type) | ✅ |
| Engineering | ADRs for significant decisions | ⬜ |
| Engineering | Ubiquitous language in code naming | 🟡 improving |

---

**Skills Acquired**

- Refactor a feature from anemic entities to rich domain model without breaking E2E tests
- Define aggregate boundaries and enforce invariants inside the domain
- Write use cases that orchestrate domain + repositories without framework imports in domain
- Map HTTP DTOs → application commands → domain objects → persistence models explicitly *(Command still optional gap)*
- Test domain logic in isolation (no database, no HTTP)
- Write ADRs that explain trade-offs, not just choices *(next)*
- Identify bounded contexts and module communication rules *(practice on paper)*

---

**Common Mistakes**

- Anemic DDD — folders renamed to `domain/` but entities still have no behavior → *watch for leftover getters-only types*
- God use case — one `SubmitEventUseCase` that does ingest, tag, embed, and notify → *submit path stays focused*
- Leaking ORM into domain — `@Entity()` decorators on domain classes → *avoided*
- Over-engineering value objects for every string field
- ADRs that document obvious choices or go stale without superseding entries
- Creating microservices prematurely instead of enforcing module boundaries in the monolith
- Skipping mappers — reusing HTTP DTOs as domain commands → *still a mild gap*

---

**Readiness Check**

Move to Phase 4 when:

- [x] Event submit flows through: Controller → UseCase → Aggregate → Repository *(Command still optional)*
- [x] Domain layer has zero imports from `@nestjs/*`, `typeorm`, or `express`
- [x] You can add a new event type by registering a handler/strategy, not editing core submit logic
- [ ] At least 3 ADRs exist (monolith choice, idempotency, sync tagging rationale)
- [x] Domain unit tests run without database; E2E tests still pass
- [ ] You can draw the dependency diagram with arrows pointing inward *(learning self-check)*
- [ ] CI runs migrations before E2E; shared/deployed envs do not rely on `synchronize: true`

**Code to study:** `src/domain/event-tag/url-tag-categorizer.ts`, `src/domain/event/event.ts`, `src/application/event/submit-event-use-case.ts`, `src/infrastructure/event-type/`, `src/domain/ports/`

---

### Phase 4 — Escala

**Business Goal**

Decouple event ingestion from enrichment side effects so the API responds quickly under load, side effects can be retried independently, and no message is lost if the broker fails after database commit.

Functionality delivered:
- Async tagging (and future embedding/graph sync) via background workers
- Domain events (`EventIngested`) triggering handlers
- Outbox table ensuring at-least-once delivery to queue
- Redis-backed job queue with dead-letter handling

**Progress vs this codebase:** tagging still runs inside `SubmitEventUseCase` (sync). No outbox / Redis / BullMQ / workers yet.

**What to learn and implement:** [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md)

---

**Engineering Problems**

- Synchronous tagging increases ingest latency — how do you keep the write path fast?
- Direct service calls create tight coupling — how do enrichment modules react to ingest without importing each other?
- Committing to DB then publishing to queue is two systems — how do you avoid losing messages?
- Workers retry failed jobs — how do you prevent duplicate side effects on retry?

---

**Concepts Learned**

**Async processing / background jobs**
- *Explanation:* Request handler enqueues work; workers process it outside the HTTP lifecycle. Optimizes latency and isolates failure domains.
- *Why it matters here:* The extension does not read the response body on success. Fast `202/204` + async enrichment is compatible and scales better.

**Domain events**
- *Explanation:* Records of something that happened in the domain (`EventIngested`), consumed by handlers in other modules.
- *Why it matters here:* Tagging, embedding, graph sync, and read model updates all react to ingest. Domain events avoid a central god service calling everything.

**Transactional outbox**
- *Explanation:* Persist outbound messages in the same transaction as domain changes. A poller publishes them to the queue reliably.
- *Why it matters here:* Without outbox, "DB committed, queue publish failed" leaves permanent inconsistency. This is a classic distributed systems problem.

**Message queues and at-least-once delivery**
- *Explanation:* Producers and consumers communicate via a buffer. Messages may be delivered more than once; consumers must be idempotent.
- *Why it matters here:* Retries are a feature, not a bug. Handlers must tolerate duplicate `EventIngested` processing.

**Backpressure**
- *Explanation:* When consumers are slower than producers, the queue grows. System must shed load or scale consumers.
- *Why it matters here:* A browsing spike fills the queue. Without depth monitoring, you discover the problem only when Redis runs out of memory.

**Technology mapping:** BullMQ/Redis teaches message buffering and job retries; in-process EventEmitter teaches handler decoupling before adding infra; outbox table in PostgreSQL teaches reliable publish; OpenTelemetry becomes relevant here for tracing across HTTP → DB → queue → worker.

**Missing concepts that naturally emerge here:**
- **Saga / process manager** — multi-step workflows across handlers (if tagging triggers embedding triggers graph sync)
- **Dead letter queue (DLQ)** — poison messages that fail after N retries
- **Consumer idempotency keys** — separate from client ingest idempotency
- **Graceful degradation** — ingest succeeds even if queue is temporarily unavailable (outbox buffers)

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | Event-driven architecture (within monolith first) |
| Architectural | Transactional outbox |
| Architectural | Worker / consumer process separation |
| Design | Domain event + handler registration |
| Design | Idempotent consumer |
| Design | Dead letter queue |
| Engineering | At-least-once + idempotent handler contract |
| Engineering | Queue depth monitoring and alerting |

---

**Skills Acquired**

- Move side effects off the request path without breaking ingest correctness
- Implement outbox pattern with transactional guarantee
- Build and operate background workers with retry and DLQ
- Make handlers idempotent under duplicate delivery
- Trace a single event from HTTP through outbox to worker completion
- Choose between in-process events vs external queue for a given side effect
- Document async architecture in an ADR (supersedes sync tagging ADR from Phase 3)

---

**Common Mistakes**

- Async without outbox — lost messages on publish failure
- Domain events that trigger synchronous HTTP calls inside the handler — re-coupling
- Non-idempotent consumers — duplicate tags, duplicate embeddings on retry
- One queue for all job types — noisy neighbors (slow embedding blocks fast tagging)
- No visibility into queue depth or consumer lag
- Starting with Kafka/RabbitMQ before a simple Redis queue — operational overhead without learning value
- Emitting domain events before the transaction commits — handlers read stale state

---

**Readiness Check**

Move to Phase 5 when:

- [ ] Ingest responds without waiting for tagging to complete
- [ ] Outbox + worker pipeline survives broker restart (messages not lost)
- [ ] Handlers are idempotent — duplicate jobs do not duplicate side effects
- [ ] You can explain at-least-once vs exactly-once and why exactly-once is hard
- [ ] Queue depth and consumer failures are visible in logs or metrics
- [ ] E2E test covers: ingest → outbox → worker → tag created

---

### Phase 5 — Analytics

**Business Goal**

Expose read APIs for a future dashboard: events by date, time per tag, weekly activity summaries. Reads are optimized for query patterns without slowing down the write path.

Functionality delivered:
- `GET /api/v1/events` — paginated, filterable event list
- `GET /api/v1/analytics/daily` and `/tags` — pre-computed stats
- Read models updated by `EventIngested` handlers
- Materialized views for heavy aggregations (weekly rollups)

---

**Engineering Problems**

- The normalized `events` table is optimized for writes — how do you serve dashboard queries without full table scans?
- Aggregating on every request does not scale — how do you pre-compute safely?
- Read and write models diverge — how do you keep projections consistent with source events?
- Pagination and filtering across JSONB metadata — how do you index efficiently?

---

**Concepts Learned**

**CQRS (Command Query Responsibility Segregation)**
- *Explanation:* Separate models and paths for writes (commands) and reads (queries). Commands change state; queries never do.
- *Why it matters here:* The extension only writes. Dashboard only reads. Mixing both in one service method creates accidental complexity and performance coupling.

**Read models / projections**
- *Explanation:* Denormalized tables shaped for specific UI queries, updated by event handlers rather than computed at request time.
- *Why it matters here:* "Events per day per tag" is a different access pattern than "insert one event." A `user_daily_stats` table serves the dashboard in O(1).

**Eventual consistency (read side)**
- *Explanation:* Read models lag slightly behind writes. Acceptable when UI tolerates seconds of delay.
- *Why it matters here:* After async ingest (Phase 4), the dashboard may show an event before its tag appears. You must define and document this behavior.

**Materialized views**
- *Explanation:* Database-managed snapshots of complex queries, refreshed on schedule or on demand.
- *Why it matters here:* Weekly rollups over millions of events are expensive to compute per request. MVs push cost to background refresh.

**Pagination and cursor-based navigation**
- *Explanation:* Stable, efficient paging through large result sets (`occurred_at + id` cursor vs offset).
- *Why it matters here:* Users accumulate months of browsing events. Offset pagination degrades at scale.

**Technology mapping:** PostgreSQL indexes and materialized views teach read optimization; CQRS and read models are pattern-level (implemented in application layer); `@nestjs/schedule` teaches periodic MV refresh.

**Missing concepts that naturally emerge here:**
- **Cache-aside** — Redis cache for hot dashboard queries
- **Data retention policy** — archive or purge old events
- **Export API** — GDPR-aligned data portability (`GET /users/me/export`)
- **Graph queries in SQL** — recursive CTEs for session sequences before Neo4j (validates whether graph DB is needed)

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | CQRS (light — same database, separate paths) |
| Architectural | Projection / read model updater |
| Design | Query object / query handler |
| Design | Cursor-based pagination |
| Engineering | Index design driven by query patterns |
| Engineering | Scheduled materialized view refresh |
| Engineering | Staleness tolerance documented in API contract |

---

**Skills Acquired**

- Design read models from concrete UI query requirements
- Implement query handlers that never mutate state
- Build projection updaters triggered by domain events
- Choose between application-maintained read tables vs database materialized views
- Index for real query patterns (`user_id + occurred_at DESC`, GIN on metadata)
- Explain eventual consistency to a consumer of the read API
- Load-test a dashboard query and identify when to pre-compute

---

**Common Mistakes**

- CQRS with two databases too early — operational pain without scale justification
- Read model updated synchronously in the request path — defeats Phase 4 async work
- Offset pagination on large tables — performance cliff
- Materialized view refreshed on every insert instead of on schedule
- No staleness indicator in API — users assume real-time when data is seconds old
- Aggregating in application code what SQL should do (or vice versa) without measurement
- Skipping indexes because "Postgres is fast enough" with 500 rows in dev

---

**Readiness Check**

Move to Phase 6 when:

- [ ] Dashboard queries read from projections or MVs, not raw aggregation on every request
- [ ] Ingesting an event eventually updates daily stats (test with async handler)
- [ ] Pagination works correctly across pages with stable ordering
- [ ] You can explain why CQRS was chosen and what consistency guarantee the read API offers
- [ ] Query performance is acceptable with realistic data volume (seed 10k+ events)
- [ ] ADR documents read model strategy (table vs materialized view)

---

### Phase 6 — IA

**Business Goal**

Move beyond rule-based URL tagging: semantic search over browsing history ("find pages similar to this"), and a Q&A interface grounded in the user's own data ("what did I read about messaging queues?").

Functionality delivered:
- Embeddings generated for event URL + title (async, Phase 4 pipeline)
- Vector similarity search scoped per user
- RAG endpoint: question → retrieve top-K events → LLM answer with citations

---

**Engineering Problems**

- Rule-based tags miss semantic similarity (Kafka docs vs RabbitMQ docs) — how do you capture meaning?
- Embedding API calls are slow and cost money — how do you avoid blocking ingest?
- LLMs hallucinate — how do you ground answers in retrieved user data only?
- Vector search must never leak cross-user data — how do you enforce tenant isolation?

---

**Concepts Learned**

**Semantic embeddings**
- *Explanation:* Text is converted to dense vectors where semantic similarity corresponds to geometric proximity.
- *Why it matters here:* Rule-based tagging assigns "developer tools" to GitHub. Embeddings cluster conceptually related pages even across different domains.

**Vector similarity search**
- *Explanation:* Find nearest neighbors in embedding space using distance metrics (cosine, L2). Requires specialized indexes at scale.
- *Why it matters here:* Keyword search misses paraphrases. Vector search powers "similar pages" and RAG retrieval.

**Retrieval-Augmented Generation (RAG)**
- *Explanation:* LLM answers are conditioned on retrieved documents from your database, not just model training data.
- *Why it matters here:* Generic LLM answers about browsing history are wrong or invasive. RAG grounds responses in the user's actual events.

**Hybrid retrieval**
- *Explanation:* Combine vector similarity with metadata filters (date range, tag, domain) for precision.
- *Why it matters here:* Pure vector search returns plausible-but-wrong pages. Filters reduce noise.

**Fallback and degradation**
- *Explanation:* When embedding API fails, fall back to rule-based tags. When LLM fails, return retrieved snippets without generation.
- *Why it matters here:* External AI services are unreliable. Ingest and core features must survive outages.

**Technology mapping:** Embedding APIs (OpenAI, local model) teach semantic representation; pgvector teaches vector indexing in PostgreSQL; LLM APIs teach RAG generation — the concepts (embedding, retrieval, grounding) transfer to Pinecone, Weaviate, or other providers.

**Missing concepts that naturally emerge here:**
- **Embedding cache** — same URL should not be re-embedded on every visit
- **Chunking strategy** — for future full-page content, how to split for retrieval
- **Evaluation harness** — precision/recall on a fixed Q&A dataset
- **Prompt injection defense** — user browsing titles could contain adversarial text
- **Cost controls** — token budgets, batch embedding, model tier selection

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | Async enrichment pipeline (embedding as handler) |
| Architectural | RAG pipeline (retrieve → augment → generate) |
| Design | Tenant-scoped retrieval (mandatory `userId` filter) |
| Design | Fallback chain (embedding → rules; LLM → snippets) |
| Engineering | Citation-backed responses (return source `event_ids`) |
| Engineering | Audit log for AI queries on sensitive data |
| Engineering | Rate limiting on expensive AI endpoints |

---

**Skills Acquired**

- Integrate external AI services behind infrastructure adapters (domain never calls OpenAI directly)
- Store and query vectors with per-user isolation
- Build a RAG pipeline with citations and refusal when context is insufficient
- Cache embeddings and measure API cost per user
- Evaluate retrieval quality with a test dataset
- Explain hallucination risk and how grounding mitigates it
- Write an ADR for model choice, vector dimensions, and cost envelope

---

**Common Mistakes**

- Embedding synchronously in the ingest request path
- Vector search without `userId` filter — cross-user data leak
- Trusting LLM output without citations or retrieval transparency
- Storing embeddings without tracking model version (model change invalidates vectors)
- No fallback when embedding/LLM API is down — entire enrichment breaks
- Re-embedding every duplicate URL visit — unnecessary cost
- Prompt stuffing entire history instead of top-K retrieval — token limits and noise

---

**Readiness Check**

Move to Phase 7 when:

- [ ] Similar-events endpoint returns semantically related pages, not just same-domain pages
- [ ] RAG answers cite specific `event_ids` and refuse when retrieval is empty
- [ ] All AI queries are scoped to authenticated user; cross-user leak test passes
- [ ] Embedding generation runs async; ingest latency unchanged from Phase 4
- [ ] Fallback to rule-based tags works when embedding API fails
- [ ] You have 5+ manual test questions with expected source events documented

---

### Phase 7 — Memory Graph

**Business Goal**

Model browsing behavior as a graph of relationships — pages, domains, tags, sessions — to power recommendations ("after GitHub you often visit docs"), related content discovery, and habit pattern detection.

Functionality delivered:
- Neo4j projection synced from `EventIngested` (Postgres remains source of truth)
- Graph queries: related pages, co-visited domains, session sequences
- Recommendation engine combining graph scores + embedding similarity
- Pattern insights ("you study messaging topics on Tuesday mornings")

---

**Engineering Problems**

- Relational joins across deep relationship chains are awkward in SQL — when is a graph model justified?
- Two databases means two sources of truth — how do you sync without inconsistency?
- Recommendations can leak behavior patterns — how do you keep suggestions private and explainable?
- Hybrid ranking (graph + vectors + rules) — how do you combine scores meaningfully?

---

**Concepts Learned**

**Graph data modeling**
- *Explanation:* Entities are nodes; relationships are first-class edges with properties. Optimized for traversal ("what is connected to X?").
- *Why it matters here:* "Pages visited in the same session after GitHub" is a path query. Graph DBs express this naturally; SQL requires recursive CTEs.

**Polyglot persistence**
- *Explanation:* Different storage engines for different access patterns. PostgreSQL for authoritative records; Neo4j for traversal and recommendation.
- *Why it matters here:* One database cannot optimally serve ACID writes, analytics aggregations, vector search, and multi-hop graph traversal. Each store has a role.

**Projection sync / CQRS on infrastructure**
- *Explanation:* Neo4j is a read-optimized projection rebuilt from events in PostgreSQL, not a second write path.
- *Why it matters here:* Dual writes to Postgres and Neo4j will diverge. Event-driven sync (Phase 4) keeps the graph consistent with source of truth.

**Recommendation systems**
- *Explanation:* Score items using content similarity, collaborative patterns, graph proximity, or hybrid combinations.
- *Why it matters here:* Tags and embeddings alone miss behavioral signal ("you always read release notes after visiting repo pages").

**Explainability**
- *Explanation:* Recommendations include why ("because you visited X and Y" or "similar to Z you bookmarked").
- *Why it matters here:* Black-box suggestions feel invasive for personal browsing data. Explainability builds trust.

**Technology mapping:** Neo4j teaches graph modeling and Cypher traversal; the underlying concepts (nodes, edges, path queries, PageRank) exist in theory regardless of vendor; recommendation scoring is algorithm-level.

**Missing concepts that naturally emerge here:**
- **Session detection** — time-window heuristic to group events into browsing sessions
- **Feedback loop** — user marks recommendation useful → adjust edge weights
- **Cold start** — new user with few events relies on content-based (embeddings/tags) only
- **A/B testing framework** — compare ranking algorithms
- **Graph pruning** — limit node growth per user (retention policy from Phase 5)

---

**Patterns and Practices**

| Type | Pattern / practice |
|------|-------------------|
| Architectural | Polyglot persistence with event-driven sync |
| Architectural | Graph as read projection (not second source of truth) |
| Design | Hybrid recommender (graph + vector + rule scores) |
| Design | Session reconstruction from event stream |
| Engineering | Explainable recommendations with path evidence |
| Engineering | Privacy-by-design (no cross-user recommendations without anonymization) |
| Engineering | ADR: why Neo4j vs PostgreSQL recursive CTEs |

---

**Skills Acquired**

- Model domain concepts as graph nodes and edges with clear sync boundaries
- Sync graph projection from domain events with idempotent upserts
- Write traversal queries for related content and session patterns
- Build hybrid ranking combining graph distance and embedding similarity
- Explain when a graph database is justified vs SQL alternatives
- Design recommendation UX with transparency and user control
- Operate two data stores with clear source-of-truth rules

---

**Common Mistakes**

- Neo4j as write path — dual-write inconsistency with PostgreSQL
- Graph model too granular (every HTTP redirect as node) — noise and cost
- Recommendations without cold-start strategy — empty for new users
- Cross-user collaborative filtering on browsing data without anonymization
- Ignoring graph staleness — recommendations from outdated projection
- Over-engineering PageRank before simple co-occurrence works
- No session boundary definition — every page linked to every page within a day

---

**Readiness Check**

You have completed the roadmap when:

- [ ] Postgres is authoritative; Neo4j rebuilds from event stream if wiped
- [ ] Related-pages query returns results with explainable graph paths
- [ ] Recommendations combine at least two signals (graph + embedding or graph + tag)
- [ ] New user receives content-based recommendations (cold start handled)
- [ ] You can articulate in an ADR why Neo4j was added and when you would remove it
- [ ] Full pipeline works: extension → ingest → outbox → workers → Postgres + graph + embeddings → analytics + RAG + recommendations

---

## Cross-phase engineering principles

These recur in every phase. Notice how they deepen:

| Principle | Phase 1 | Phase 4 | Phase 7 |
|-----------|---------|---------|---------|
| **Idempotency** | Client retry key on ingest | Idempotent queue consumers | Idempotent graph upserts on replay |
| **Separation of concerns** | Controller vs service | Domain events vs handlers | Postgres write vs Neo4j read |
| **Fail fast** | Validation pipe | DLQ for poison messages | Refuse RAG answer without retrieval |
| **Observability** | Tests as feedback | Correlation across queue | End-to-end trace ingest → recommendation |
| **Document decisions** | API contract in docs | ADRs for async | ADR for polyglot persistence |

---

## Suggested timeline

| Weeks | Phase | Milestone |
|-------|-------|-----------|
| 1–2 | 1 MVP | Extension connected; E2E green |
| 3–4 | 2 Product Engineering | Idempotency + transactions + migrations + logging |
| 5–6 | 3 Arquitetura | Submit use case refactored; 3+ ADRs |
| 7–8 | 4 Escala | Outbox + queue + async tagging |
| 9–10 | 5 Analytics | Dashboard read API with projections |
| 11–12 | 6 IA | Similar search + RAG with citations |
| 13+ | 7 Memory Graph | Graph sync + hybrid recommendations |

---

## Code map by phase

| Phase | Study now | Build next |
|-------|-----------|------------|
| 1 | `src/main.ts`, `src/presentation/auth/`, `docs/mvp-endpoints.md` | *(done)* Health, protect user routes |
| 2 | `src/application/event/submit-event-use-case.ts`, `docs/initial-sql.md` | Migrations in CI; harden `synchronize` policy |
| 3 | `src/domain/event/`, `src/infrastructure/event-type/`, `src/domain/ports/` | `docs/adr/`, optional Command, paper exercises |
| 4 | [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md), current submit use case | Outbox table, BullMQ worker, async tagging |
| 5 | `docs/initial-sql.md` indexes | `user_daily_stats`, query handlers |
| 6 | Event metadata shape in ORM entity / docs | pgvector, embedding handler, RAG endpoint |
| 7 | Tag + embedding outputs | Neo4j sync, recommendation API |

---

## Related docs

- [mvp-endpoints.md](./mvp-endpoints.md) — browser extension HTTP contract
- [api-endpoints.md](./api-endpoints.md) — full API contract (`WEB_VISIT` / `APP_VISIT` metadata)
- [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md) — Phase 4: what to learn & implement
- [initial-sql.md](./initial-sql.md) — target PostgreSQL schema
- [../README.md](../README.md) — project overview

---

*Last updated: July 2026*
