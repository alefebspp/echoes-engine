# Phase 6 — IA: embeddings, vector search & RAG

Teaching notes for **Phase 6 (IA)** of Echoes Engine: semantic embeddings, pgvector similarity search, RAG with citations, hybrid retrieval, fallbacks, and how AI fits the existing async + DDD architecture.

Companion: [learning-walkthrough.md — Phase 6](../learning-walkthrough.md#phase-6--ia) · [concepts-still-to-learn.md](../concepts-still-to-learn.md) · [api-endpoints.md](../api-endpoints.md) · [initial-sql.md](../initial-sql.md) · [phase-4-learn-and-implement.md](../phase-4-learn-and-implement.md)

---

## How to use this folder

Read in order. Each note is self-contained, Echoes-flavored, and ends with exit criteria and a short explain-back.

| # | File | Concept | When to study |
|---|------|---------|---------------|
| 1 | [01-semantic-embeddings.md](./01-semantic-embeddings.md) | Semantic embeddings | Week 1 |
| 2 | [02-vector-similarity-search.md](./02-vector-similarity-search.md) | Vector search + pgvector + tenant isolation | Week 1–2 |
| 3 | [03-rag.md](./03-rag.md) | Retrieval-Augmented Generation | Week 2 |
| 4 | [04-hybrid-retrieval.md](./04-hybrid-retrieval.md) | Vectors + metadata filters | Week 2–3 |
| 5 | [05-fallback-degradation.md](./05-fallback-degradation.md) | Graceful degradation when AI APIs fail | Week 3 |
| 6 | [06-ai-adapters-async-pipeline.md](./06-ai-adapters-async-pipeline.md) | Ports/adapters + Phase 4 enrichment pipeline | Week 1 (architecture) |
| 7 | [07-emerging-topics.md](./07-emerging-topics.md) | Cache, chunking, eval, prompt injection, cost | Week 3–4 optional |

If you already know embeddings / cosine similarity / RAG theory, skim **01** and **03** as a refresh, then focus on **02**, **04**, and **06** (Echoes-specific boundaries).

---

## Mental model

```
WRITE (unchanged)                       ENRICH (async)                    READ (new)
─────────────────                       ──────────────                    ──────────
POST /events                            EventIngested handler             GET /events/similar
  → SubmitEventUseCase                    → load event text                 → embed query OR reuse
  → outbox EventIngested                  → EmbeddingPort.embed()           → pgvector KNN
  → 202 fast                              → upsert event_embeddings         → filter user_id (mandatory)
                                                                          GET /ai/ask
                                                                            → retrieve top-K
                                                                            → LLMPort.generate()
                                                                            → citations + refuse if empty

Rule-based tags (Phase 1–4) still run. Embeddings add semantic similarity RAG cannot get from URL rules alone.
```

**Implementation order when you code** (do not invert):

1. `EmbeddingPort` + infrastructure adapter (OpenAI or local)  
2. Schema: `event_embeddings` with `user_id`, `model`, `dimensions`  
3. Async embedding handler on `EventIngested` (dedicated queue)  
4. Similar-events query with mandatory `userId` filter  
5. RAG endpoint: retrieve → prompt → generate with citations  
6. Fallback chain + rate limits on AI routes  
7. ADR: model choice, dimensions, cost envelope  

---

## Progress checklist

- [ ] Embeddings: explain dense vectors; name Echoes text fields (`url` + `title`)  
- [ ] pgvector: cosine vs L2; index type; tenant filter in every query  
- [ ] RAG: retrieve → augment → generate; citations; refuse when empty  
- [ ] Hybrid: combine vector rank with date/tag/domain filters  
- [ ] Fallback: embedding → rules; LLM → snippets  
- [ ] Architecture: domain never imports OpenAI; handler is idempotent  
- [ ] Emerging: skim all five; deep-dive one if time  

---

*Aug 2026 · Phase 6 IA concept notes*
