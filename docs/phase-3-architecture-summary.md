# Phase 3 — Arquitetura: Mentorship Guide

This document is a senior-level study guide for **Phase 3** of the Echoes Engine roadmap. It focuses on *why* you are restructuring the codebase, *what* you must understand before touching folders, and *how* to tell the difference between architectural learning and checkbox refactoring.

Phase 3 is not about shipping new product features. It is about making the system **maintainable under change** — new event types, connectors, and analytics modules should extend the system without rewriting unrelated code.

**Starting point in this codebase:** `Controller → Service → TypeORM Entity`, with one exception: `src/event-tags/url-tag-categorizer.ts` is pure domain logic with no framework imports. That file is your reference for what "inward" code should look like.

See also: [Learning Walkthrough — Phase 3](./learning-walkthrough.md#phase-3--arquitetura)

---

## Business goal

Restructure Echoes Engine so that:

- Business rules live in the **domain**, not in HTTP handlers or ORM entities
- Frameworks (HTTP, persistence, auth transport) live at the **edges**
- Architectural decisions are **documented** for future phases (async, analytics, IA, graph)
- Three bounded contexts emerge with clear responsibilities: **Identity**, **Ingestion**, **Enrichment**

Deliverables when implementation is complete:

- Bounded contexts with explicit communication rules
- Use cases (e.g. `SubmitWebVisitUseCase`) replacing fat services
- Rich domain model (`Event` aggregate, `Email` value object)
- Repository interfaces in domain/application; persistence in infrastructure
- ADR folder with decisions on monolith choice, idempotency, and sync tagging

---

## Engineering problems being solved

Phase 3 exists because Phase 2 made the system *reliable* but not yet *maintainable*. These are the problems you should be able to articulate before refactoring:

| Problem | Symptom in Echoes today | Why it blocks senior-level work |
|---------|-------------------------|----------------------------------|
| **Logic scattered across layers** | Idempotency, tagging, and validation live in `EventsService` alongside TypeORM calls | You cannot test business rules without spinning up HTTP + database |
| **Framework coupling** | Services import `Repository<Event>` directly | Swapping persistence, adding a CLI, or reusing logic in a worker requires copy-paste or heavy mocks |
| **No extension point for variation** | Adding a second event type means editing the same submit path | Violates Open/Closed; every new connector increases regression risk |
| **Implicit vocabulary** | "Event" means extension payload, DB row, and API response interchangeably | Bugs hide in translation gaps between client contract and domain model |
| **Undocumented decisions** | Idempotency and sync tagging were chosen in Phase 2 but may not be written down | Future phases (async, CQRS, polyglot persistence) will re-open the same debates |
| **Anemic model** | Entities are data bags; services contain all behavior | Invariants are easy to bypass; aggregate consistency is not enforced |

The core question Phase 3 answers:

> *How do I structure a growing backend so that business rules are testable, boundaries are explicit, and extension does not require modification of stable code?*

---

## Concepts being learned

Each concept below includes what it is, why it matters *here*, and the trade-off you must internalize — not just the pattern name.

### Modular monolith

- **What:** One deployable application composed of modules with strict boundaries, communicating in-process.
- **Why here:** Echoes does not need network partitions, service discovery, or distributed transactions yet. Module boundaries teach the *discipline* of service boundaries without operational overhead.
- **Trade-off:** You gain simplicity and transactional consistency; you defer independent scaling. Microservices would add cost before the domain is understood.

### Bounded contexts (Identity, Ingestion, Enrichment)

- **What:** Separate models and language for subdomains that solve different problems.
- **Why here:** Login credentials and browsing events share a database but not the same rules. Mixing them in one "events" service creates hidden coupling.
- **Trade-off:** Some duplication across contexts is acceptable (e.g. `userId` as a reference, not a shared entity graph). Premature "shared kernel" entities often become the biggest coupling point.

### Domain-Driven Design (aggregates, value objects, domain services)

- **What:** Model software around business concepts with explicit consistency boundaries and validated primitives.
- **Why here:** An ingested browsing fact has invariants (idempotency key, owned tags, valid timestamps) that belong to `Event`, not to a controller.
- **Trade-off:** Rich models take longer to design upfront; anemic CRUD is faster initially and expensive forever. Value objects add ceremony — use them where validation and equality matter (`Email`, `Url`), not for every string.

### Clean Architecture / Ports and adapters

- **What:** Dependencies point inward. Inner layers define interfaces; outer layers implement them.
- **Why here:** After Phase 2, you felt the pain of testing `EventsService` because it knows SQL and NestJS. Inversion makes domain logic runnable anywhere.
- **Trade-off:** More types and mappers. The cost is justified when the domain has non-trivial rules; skip the ceremony for trivial CRUD in Identity until rules appear.

### Use cases (application layer)

- **What:** One class per application intent (`SubmitWebVisitUseCase`), orchestrating domain objects and ports without containing business rules.
- **Why here:** Controllers stay thin; services stop being god objects that mix HTTP, SQL, and rules.
- **Trade-off:** More files. The benefit is a single place to read "what happens when a user submits a visit" without parsing framework noise.

### Repository pattern (interface vs implementation)

- **What:** Domain/application depends on `IEventRepository`; infrastructure provides `TypeOrmEventRepository`.
- **Why here:** Persistence is a detail. Idempotency lookup and aggregate save are application concerns; SQL is not.
- **Trade-off:** Mapping between domain models and ORM entities adds boilerplate. That boilerplate is the explicit boundary between "what we mean" and "how we store it."

### Architecture Decision Records (ADRs)

- **What:** Short, durable documents: context → decision → consequences.
- **Why here:** Phases 4–7 will introduce queues, read models, vectors, and graphs. Without ADRs, you will forget why PostgreSQL remains source of truth.
- **Trade-off:** ADRs can go stale. Supersede them when decisions change; do not delete history.

### Open/Closed Principle (event type registry)

- **What:** Core ingest flow is closed for modification; new event types extend via registered handlers/strategies.
- **Why here:** Connectors (`github_connector`, `spotify_connector`) are already seeded. The architecture must absorb them without rewriting submit logic.
- **Trade-off:** Registry indirection adds navigation cost. The alternative — a growing `if/else` chain — fails silently under team growth.

### Concepts that emerge naturally (optional depth)

| Concept | When it appears | Phase 4+ connection |
|---------|-----------------|---------------------|
| Anti-corruption layer | External connector payloads differ from internal model | Protects Ingestion from Enrichment connector quirks |
| Domain events (model only) | Something happened (`EventIngested`) worth announcing | Phase 4 adds transport; Phase 3 defines the fact |
| Policy pattern | `TrackingPolicy` checks `UserSettings` before accept | Explicit domain rule vs hidden `if` in use case |
| Specification pattern | Composable query predicates | Feeds analytics read models in Phase 5 |

---

## Study before implementing

Do not rename folders until you can explain the sections below without looking at this document. Implementation without study produces **anemic DDD** — correct directory names, wrong architecture.

### 1. Read and map the current codebase

| Order | Resource | What to extract |
|-------|----------|-----------------|
| 1 | `src/events/events.service.ts` | List every responsibility: validation, idempotency, transaction, tagging, persistence. Mark which are *domain* vs *application* vs *infrastructure*. |
| 2 | `src/event-tags/url-tag-categorizer.ts` | Notice: no framework imports, pure input → output. This is the dependency direction target. |
| 3 | `src/events/event.entity.ts` | Separate ORM mapping concerns from business invariants. Ask: "If TypeORM disappeared, what would `Event` still need to enforce?" |
| 4 | Phase 2 tests in `src/events/events.service.spec.ts` and `test/events.e2e-spec.ts` | Identify which behaviors must survive the refactor unchanged. These are your contract. |

### 2. Study principles (not tutorials)

Focus on *decisions and trade-offs*, not framework walkthroughs:

| Topic | Study goal | Suggested angle |
|-------|------------|-----------------|
| Dependency inversion | Why inner layers define interfaces | "Clean Architecture" — dependency rule; ignore UI framework specifics |
| Aggregate design | What belongs inside consistency boundary | "Effective Aggregate Design" (Vaughn Vernon) — parts 1–2 |
| Bounded contexts | When to split vs share | Same author's strategic DDD material — context mapping, not tactical patterns only |
| ADRs | How to write decisions that age well | Michael Nygard's ADR format: context, decision, status, consequences |
| Open/Closed | Extension without modification | Martin Fowler on refactoring toward patterns; strategy/registry examples |

### 3. Paper exercises (before code)

Complete these on paper or in a scratch doc:

1. **Draw the current dependency graph** — arrows from controller to DB. Circle every arrow that violates "dependencies point inward."
2. **Define the `Event` aggregate** — what is the root? what is created/modified only through the root? what invariants must always hold?
3. **Sketch three contexts** — list public operations each exposes to others (e.g. Ingestion calls Enrichment port, not Enrichment repository).
4. **Write ADR outlines** — three bullets each for monolith, idempotency, sync tagging. If you cannot write "consequences," you do not yet understand the decision.

### 4. Prerequisites from Phase 2

Finish before or in parallel with the first refactor PR:

- [ ] CI runs migrations before E2E tests
- [ ] Deployed environments do not rely on `synchronize: true`
- [ ] Phase 2 ADRs drafted (idempotency strategy, transaction boundaries) if not already in `docs/adr/`

---

## What to implement

Implementation order matters. Refactor **Ingestion** first — it has the most Phase 2 complexity and becomes the template for other contexts.

### Step 1 — Establish bounded contexts

| Context | Current code | Owns |
|---------|--------------|------|
| **Identity** | `src/users/`, `src/auth/` | Registration, authentication, user settings |
| **Ingestion** | `src/events/`, `src/event-sources/` | Accept events, idempotency, persist aggregates |
| **Enrichment** | `src/event-tags/` | Tagging rules, categorizers, future connectors |

**Communication rule:** Contexts talk through application ports or domain events — never through another context's ORM repository.

### Step 2 — Layered structure (per context)

```
domain/          → entities, value objects, repository interfaces, domain services
application/     → use cases, commands/queries, mappers
infrastructure/  → ORM repositories, module wiring
interfaces/      → HTTP controllers (optional split from infrastructure)
```

### Step 3 — Reference refactor: event ingest

Target flow:

```
Controller → SubmitWebVisitCommand → SubmitWebVisitUseCase → Event aggregate → EventRepository
```

| Artifact | Responsibility |
|----------|----------------|
| `SubmitWebVisitUseCase` | Orchestrate transaction; call domain + ports |
| `Event` (aggregate) | Enforce invariants; own tag association rules |
| `IEventRepository` | Load/save aggregate; idempotency lookup contract |
| Mappers | Explicit translation: HTTP DTO → command → domain → persistence model |
| Event type registry | Register handler per type; core submit unchanged |

### Step 4 — ADRs (minimum three)

| ADR | Must answer |
|-----|-------------|
| Modular monolith | Why not microservices now? What would trigger extraction? |
| Idempotency | App + DB strategy; race conditions under concurrency |
| Sync tagging | Why tags in same transaction; what Phase 4 will change |

### Step 5 — Tests as architecture proof

| Layer | Test type | Proves |
|-------|-----------|--------|
| Domain | Unit, no DB | Rules and invariants |
| Application | Unit, mocked repos | Orchestration without infrastructure |
| System | Existing E2E | External behavior unchanged |

### Optional extensions (after core refactor)

- RBAC once Identity context is clear
- `TrackingPolicy` as explicit domain rule over `UserSettings`
- `EventIngested` domain event type (no queue yet)

---

## Concept mastery checklist

Use this to assess **understanding**, not file presence. Check an item only when you can pass the verification column without reading code.

### Architecture and boundaries

- [ ] **Modular monolith** — I can explain why Echoes stays one deployable unit and what would justify splitting a context out.
- [ ] **Bounded contexts** — I can name what Identity, Ingestion, and Enrichment each protect and what they must not know about each other.
- [ ] **Dependency rule** — I can draw a diagram with all arrows pointing inward and explain every outer-layer adapter.
- [ ] **Context communication** — I can explain why Ingestion must not import Enrichment's TypeORM repository.

### Domain modeling

- [ ] **Aggregate boundary** — I can defend why `Event` is the root and what must not be modified outside it.
- [ ] **Value objects** — I can explain which fields became value objects, which stayed primitives, and why.
- [ ] **Domain vs application logic** — I can point to a rule in domain code and an orchestration step in a use case and explain the difference.
- [ ] **Ubiquitous language** — I can explain the difference between extension `WEB_VISIT`, domain `Event`, and persistence row without conflating terms.

### Design principles

- [ ] **Open/Closed** — I can add a new event type by registration only and describe what stays untouched.
- [ ] **Dependency inversion** — I can swap the repository implementation in tests without changing domain or use case code.
- [ ] **Explicit mapping** — I can explain why HTTP DTOs never become domain entities directly.
- [ ] **ADR quality** — I can read my ADRs and find rejected alternatives and consequences, not only the chosen option.

### Engineering judgment

- [ ] **Avoid anemic DDD** — My domain entities contain behavior; folders alone do not satisfy Phase 3.
- [ ] **Avoid god use case** — Submit use case does not embed, notify, or analytics; it orchestrates ingest scope only.
- [ ] **Avoid premature microservices** — Module boundaries are enforced in-process first.
- [ ] **Phase 3 scope** — I can list what deliberately waits for Phase 4 (outbox, queue, async handlers).

---

## How to verify learning (not just implementation)

Passing E2E tests proves behavior survived. It does **not** prove you learned the architecture. Use these verification methods:

### Explain-it-back (teaching test)

Without opening the repo, explain aloud or in writing:

1. Walk through submit flow layer by layer — what each layer is allowed to know.
2. Why idempotency lives in both application flow and aggregate/ repository contract.
3. What breaks if Enrichment imports Ingestion's repository directly.

If you reach for file names instead of responsibilities, revisit Study Before Implementing.

### Deliberate change exercises

| Exercise | Mastery signal | Shallow implementation signal |
|----------|----------------|-------------------------------|
| Add a stub second event type | Only new handler + registration; submit core unchanged | Edit use case with new `if (type === ...)` branch |
| Swap repository to in-memory fake in test | Domain + use case tests pass with zero ORM | Tests still require database |
| Break an invariant in a unit test | Test fails at domain layer | Test fails only in E2E or not at all |
| Write a superseding ADR for async tagging | Old ADR marked superseded; consequences updated | No ADR or single paragraph with no rejected options |

### Code review questions (ask yourself)

- Can I delete NestJS from the domain folder and still compile domain + application?
- Is there business logic left in the controller or ORM entity?
- Does every cross-context call go through a named port or application service?
- Would a new engineer learn *why* from ADRs, not only *what* from folder names?

### Red flags that implementation outpaced learning

- Folders renamed to `domain/` but entities have only getters/setters
- `@Entity()` on classes in `domain/`
- Use case imports `Repository` from TypeORM
- "We use DDD" but no aggregate enforces invariants
- ADRs describe the final state only, with no trade-offs
- Cannot add event type without fear of breaking existing tests

---

## Readiness to move to Phase 4

Implementation checklist (all required):

- [ ] Event submit flows: Controller → Command → UseCase → Aggregate → Repository
- [ ] Domain layer has zero imports from HTTP server, ORM, or web framework packages
- [ ] New event type = register handler/strategy, not edit core submit logic
- [ ] At least 3 ADRs exist (monolith, idempotency, sync tagging)
- [ ] Domain unit tests run without database; E2E tests still pass

Learning checklist (all required):

- [ ] Concept Mastery Checklist above is checked with evidence from explain-it-back and change exercises
- [ ] You can articulate what Phase 4 adds (async, outbox, workers) and why Phase 3 makes that safe

---

## Common mistakes

| Mistake | Why it fails Phase 3 |
|---------|----------------------|
| Anemic DDD | Structure without behavior — rules still scattered |
| God use case | One orchestrator owns ingest + enrichment + side effects |
| ORM in domain | Dependency rule broken; domain no longer portable |
| Value object explosion | Complexity without validation benefit |
| DTO as domain command | Boundary collapse; API changes break rules |
| Microservices jump | Distributed problems before modular discipline |
| ADRs as changelog | No context or rejected alternatives — useless in 6 months |

---

## Suggested implementation order

1. Finish Phase 2 CI/migration gap and draft Phase 2 ADRs if missing
2. Create `docs/adr/` and record decisions already made
3. Refactor `src/events/` as the reference context (transactions + idempotency + tagging)
4. Extract **Enrichment** behind a port consumed by Ingestion
5. Refactor **Identity** with `Email` value object and use cases where rules exist
6. Introduce event type registry once layered structure is stable

**Code to study first:** `src/event-tags/url-tag-categorizer.ts`, then refactor `src/events/` end-to-end.

---

## What Phase 3 is not

Phase 3 does not add Redis, BullMQ, outbox tables, or background workers. Those are **Phase 4** concerns. Phase 3 creates the boundaries and domain vocabulary that make async event-driven processing a structural extension — not a rewrite.
