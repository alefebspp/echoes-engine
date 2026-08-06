# Concepts still to learn

Snapshot of what remains to study from [learning-walkthrough.md](./learning-walkthrough.md), given that Phase 4 theory is already covered (queues, Redis/BullMQ, outbox, retries, backpressure, DLQ, domain events, at-least-once vs exactly-once, idempotency).

Companion: [phase-4-learn-and-implement.md](./phase-4-learn-and-implement.md)

---

## Phase 4 leftovers (thin)

Not new architecture themes — apply what you already know in this repo:

- **Observability across the async boundary** — correlation / `eventId` from HTTP → outbox → job → worker logs (optional OpenTelemetry later)
- **Echoes-specific explain-backs**
  - client ingest idempotency vs consumer idempotency
  - what `EventIngested` should carry (id-only + reload vs enrichment payload)
  - why the worker reuses `EventTypeHandler` instead of new type switches
  - that Phase 5 read models hang off the same `EventIngested` stream
- **Practice:** write ADRs (Phase 3 carry-over) — decision docs, not a new concept

**Action:** stop studying Phase 4 and implement (domain event → outbox in ingest TX → publisher → idempotent enrichment worker → ADR/tests).

---

## Phase 5 — Analytics

Main concepts still to learn:

| Concept | One-liner |
|---------|-----------|
| **CQRS** | Separate write (commands) vs read (queries) paths |
| **Read models / projections** | Denormalized tables updated by `EventIngested` handlers |
| **Eventual consistency (read side)** | Dashboard may lag writes/tags; document staleness |
| **Materialized views** | Scheduled/on-demand snapshots for heavy aggregations |
| **Cursor-based pagination** | Stable paging at scale (`occurred_at + id` vs offset) |

**Next big learning block after Phase 4 implementation:** CQRS + read models / projections.

---

## Phase 6 — IA

| Concept | One-liner |
|---------|-----------|
| **Semantic embeddings** | Text → dense vectors where meaning ≈ proximity |
| **Vector similarity search** | Nearest neighbors (pgvector), scoped per user |
| **RAG** | Retrieve → ground LLM → answer with citations |
| **Hybrid retrieval** | Vectors + metadata filters (date, tag, domain) |
| **Fallback / degradation** | Rules/snippets when embedding or LLM APIs fail |

---

## Phase 7 — Memory Graph

| Concept | One-liner |
|---------|-----------|
| **Graph data modeling** | Nodes/edges; path queries (“what is connected to X?”) |
| **Polyglot persistence** | Postgres = source of truth; Neo4j = traversal projection |
| **Event-driven graph sync** | Replayable projection from events — not dual-write |
| **Recommendation systems** | Hybrid scoring (graph + embeddings/tags) |
| **Explainability** | “Why this recommendation” with path/evidence |

---

## Roadmap reminder

```
4. Escala     → implement (concepts known)
5. Analytics  → CQRS, projections, MVs, cursor pagination
6. IA         → embeddings, vector search, RAG
7. Memory Graph → Neo4j projection, hybrid recommendations
```

---

*Derived from conversation summary · Aug 2026*
