# 06 — AI adapters and async enrichment pipeline

**Theme:** Integrate OpenAI (or any provider) **behind ports** on the **async** path — same discipline as tagging in Phase 4.

---

## Concept

External AI APIs belong in **infrastructure**, not domain or application internals:

| Layer | Responsibility |
|-------|----------------|
| **Domain** | No OpenAI, no pgvector, no HTTP |
| **Application** | Use cases orchestrate ports: `EmbeddingPort`, `LLMPort`, repositories |
| **Infrastructure** | OpenAI SDK, pgvector queries, BullMQ workers |
| **Presentation** | Controllers, DTOs, rate limits on `/ai/*` |

This mirrors `EventRepository`, `PasswordHasher`, and `EventTypeHandlerRegistry` — swap provider without rewriting use cases.

---

## Why it matters in Echoes

Phase 4 established:

```
SubmitEventUseCase → persist → outbox EventIngested → worker → tag handler
```

Phase 6 **adds handlers**, it does not inflate `SubmitEventUseCase`:

```
EventIngested → EnrichTagsHandler        (existing)
EventIngested → GenerateEmbeddingHandler (new)
EventIngested → UpdateReadModels…        (Phase 5)
```

Future Phase 7 graph sync follows the same pattern.

Without ports, you get `import OpenAI from 'openai'` inside use cases — untestable and framework-coupled.

---

## Port sketches (application/domain boundary)

```typescript
// application/ports/embedding.port.ts
export type EmbedResult = {
  vector: number[];
  model: string;
  dimensions: number;
};

export interface EmbeddingPort {
  embed(text: string): Promise<EmbedResult>;
}
```

```typescript
// application/ports/llm.port.ts
export type GenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export interface LLMPort {
  generate(input: GenerateInput): Promise<{ text: string }>;
}
```

```typescript
// domain or application — embedding persistence port
export interface EventEmbeddingRepository {
  upsert(params: {
    eventId: string;
    userId: string;
    vector: number[];
    model: string;
    dimensions: number;
    contentHash: string;
  }): Promise<void>;

  findSimilarByVector(params: {
    userId: string;
    vector: number[];
    model: string;
    limit: number;
    filters?: RetrievalFilters;
  }): Promise<SimilarEvent[]>;
}
```

Infrastructure: `OpenAiEmbeddingAdapter`, `OpenAiLlmAdapter`, `TypeOrmEventEmbeddingRepository`.

---

## Generate embedding handler

```
Queue: embedding (not enrichment/tagging)

GenerateEmbeddingHandler.handle(EventIngested):
  1. Load event by eventId (assert userId)
  2. Build text from metadata (WEB_VISIT / APP_VISIT)
  3. contentHash = sha256(text)
  4. If existing row with same hash + model → skip (idempotent)
  5. embedding = await embeddingPort.embed(text)
  6. repository.upsert(...)
```

**Idempotency:** duplicate `EventIngested` jobs must not call OpenAI twice for unchanged content.

**Reload vs payload:** handler loads event from DB (like tagging worker) — `EventIngested` stays small ([phase-4 notes](../phase-4-learn-and-implement.md)).

---

## Ask question use case (RAG — sync HTTP, read-only)

```
AskQuestionUseCase.execute({ userId, question, filters }):
  1. queryVector = await embeddingPort.embed(question)
  2. hits = await embeddingRepository.findSimilarByVector({ userId, ... })
  3. if hits empty or below threshold → return refused
  4. prompt = buildRagPrompt(hits, question)
  5. try llmPort.generate(prompt)
  6. on LLM failure → return snippets-only ([05](./05-fallback-degradation.md))
  7. map citations from hits
```

This is a **query** use case — no domain mutation, no outbox. Rate-limit at controller.

---

## Folder map (target)

```text
src/
  application/
    ports/
      embedding.port.ts
      llm.port.ts
    ai/
      ask-question-use-case.ts
      find-similar-events-use-case.ts
    enrichment/
      generate-embedding-handler.ts
  infrastructure/
    ai/
      openai-embedding.adapter.ts
      openai-llm.adapter.ts
    persistence/
      typeorm-event-embedding.repository.ts
    queue/
      embedding.worker.ts
  presentation/
    ai/
      ai.controller.ts
      ask-question.dto.ts
```

Adjust names to match existing Echoes conventions (`src/application/event/`, etc.).

---

## Queue separation

From Phase 4 walkthrough:

> One queue for all job types — noisy neighbors (slow embedding blocks fast tagging)

| Queue | Jobs | Latency sensitivity |
|-------|------|---------------------|
| `enrichment` | Tagging | Medium |
| `embedding` | Vector generation | Low (async) |
| `outbox-publisher` | Publish to queues | High |

Embedding jobs can be slower and bursty — isolate them.

---

## Testing strategy

| Test | Approach |
|------|----------|
| Handler idempotency | Fake `EmbeddingPort` + fake repo; duplicate handle → one embed call |
| Tenant isolation | Two users' vectors; similar query never crosses |
| Ask use case | Fake ports; assert refusal without LLM call when no hits |
| E2E (optional) | Mock OpenAI HTTP; real Postgres + pgvector |

Domain tests still need **zero** network.

---

## ADR prompts (Phase 6)

Document in `docs/adr/`:

- Embedding model + dimensions + estimated cost per 1k events
- pgvector vs external vector DB at current scale
- RAG model + max tokens + refusal policy
- Why embeddings are async handler, not sync ingest step

---

## Common mistakes

1. `SubmitEventUseCase` calls embedding API "just once to try."
2. Domain event carries full embedding payload — bloats outbox.
3. Shared queue with tagging — embedding backlog delays tags.
4. No fake adapters in unit tests — tests hit real OpenAI in CI.
5. LLM adapter used inside embedding handler — keep responsibilities separate.

---

## Exit criteria

- [ ] Sketch `EmbeddingPort` and `LLMPort` without SDK imports in application.
- [ ] Describe embedding handler steps including idempotency check.
- [ ] Explain why embedding gets its own queue.
- [ ] Map one E2E path: ingest → outbox → embedding worker → row in `event_embeddings`.

## Explain-back (5 minutes)

> "AI providers live behind ports in infrastructure. EventIngested triggers an idempotent embedding handler on a dedicated queue; RAG runs in a read use case that retrieves via pgvector then calls LLMPort. Domain never imports OpenAI — same hexagonal rules as the rest of Echoes."

## Next

[07-emerging-topics.md](./07-emerging-topics.md) — cache, chunking, evaluation, security, cost.
