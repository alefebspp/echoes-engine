# 05 — Fallback and degradation

**Theme:** External AI services fail. Core ingest and read paths must **degrade gracefully**, not collapse.

---

## Concept

**Fallback / degradation** defines what the product does when embedding or LLM APIs are unavailable, slow, over budget, or return errors:

| Failure | Degraded behavior |
|---------|-------------------|
| Embedding API down on ingest | Event still saved; tags still applied; embedding retried via queue |
| Embedding missing at query time | Similar search uses tags/domain rules or returns empty with message |
| LLM down on `/ai/ask` | Return retrieved snippets without generated prose |
| Rate limit / cost cap hit | 429 with clear error; no partial hallucination |

**Principle:** Ingest (Phase 4) never depends on OpenAI succeeding. AI features **enhance**; they do not gate correctness.

---

## Why it matters in Echoes

Browsing capture is the core contract with the extension. A 503 from OpenAI must not turn into 503 on `POST /events`.

AI endpoints are **best-effort enrichments**:

- Similar events → nice-to-have ranking
- RAG → Q&A convenience

Users still expect history, dashboard, and tags when AI is off.

---

## Fallback chains

### Embedding generation (async worker)

```
EventIngested → embedding worker
  try EmbeddingPort.embed()
  on success → upsert event_embeddings
  on failure → retry with backoff (BullMQ)
  after N failures → job to DLQ + metric/log
  event row unchanged; tags_assigned unaffected
```

Do **not** block tagging queue on embedding failures — separate queues ([06](./06-ai-adapters-async-pipeline.md)).

### Similar events (`GET /events/:id/similar`)

```
1. If reference event has embedding → pgvector KNN
2. Else if tags exist → same-tag recent events (rule fallback)
3. Else same-domain recent events from metadata.url
4. Else 200 with empty list + reason: "semantic index not ready"
```

Document in API that rule-based similar results are **weaker** than vector results.

### RAG (`POST /ai/ask`)

```
1. Retrieve top-K (vector + filters)
2. If retrieval empty → refuse (not a fallback case)
3. If LLM fails:
   a. Return { mode: "snippets_only", snippets: [...], citations: [...] }
   b. Optional short template: "Found N related pages; generation unavailable."
4. Never return LLM text without retrieval context
```

Snippets-only mode still delivers value and proves retrieval worked.

---

## Degradation levels (product clarity)

| Level | User-visible |
|-------|--------------|
| **Full** | Vector similar + RAG with generated answer |
| **Partial** | Similar via tags/domain; RAG snippets-only |
| **Minimal** | AI routes return 503/503 with `retryAfter`; ingest OK |

Expose `degraded: true` or `mode` in JSON so the frontend can badge "AI unavailable."

---

## Timeouts and circuit breaking

Infrastructure adapters should enforce:

- **Timeout** per embedding call (e.g. 10s)
- **Timeout** per LLM call (e.g. 30s)
- **Circuit breaker** optional: after sustained failures, fail fast for 60s instead of hammering API

Log with `correlationId` / `userId` / `eventId` — same observability discipline as Phase 4.

---

## Idempotency interaction

Retries must not duplicate side effects:

- Embedding upsert on `(event_id)` — safe
- LLM calls are read-only from DB perspective — safe to retry ask, but **dedupe billing** with client request id if needed

Consumer idempotency from Phase 4 still applies to embedding workers.

---

## Common mistakes

1. Failing ingest when embedding fails — breaks extension contract.
2. Returning generic LLM answer when retrieval failed — hallucination path.
3. No user-visible signal that results are rule-based fallback vs semantic.
4. Single queue — embedding slowness blocks tagging.
5. Infinite retries on poison content (empty title) — send to DLQ after N attempts.

---

## Exit criteria

- [ ] Write the similar-events fallback chain (vector → tags → domain → empty).
- [ ] Write the RAG behavior when LLM fails but retrieval succeeded.
- [ ] Explain why ingest must succeed when embedding API is down.
- [ ] Name one metric/alert for embedding DLQ depth.

## Explain-back (5 minutes)

> "AI is async and optional on the write path. When embeddings or LLM calls fail, we retry in workers, fall back to tags/domain for similar events, or return snippet-only RAG answers — never block ingest or invent answers without retrieval."

## Next

[06-ai-adapters-async-pipeline.md](./06-ai-adapters-async-pipeline.md) — where ports, handlers, and queues live in Echoes.
