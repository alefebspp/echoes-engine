# 01 — Semantic embeddings

**Theme:** Turn browsing text into numbers where **meaning** ≈ **geometric proximity**.

---

## Concept

A **semantic embedding** is a fixed-length vector (list of floats) produced by an embedding model from text. Similar meaning → vectors close together in space; unrelated meaning → farther apart.

| Input (Echoes) | Model | Output |
|----------------|-------|--------|
| `"Apache Kafka — kafka.apache.org"` | e.g. `text-embedding-3-small` | `[0.012, -0.034, …]` (1536 dims) |
| `"RabbitMQ documentation"` | same model | vector near Kafka doc, far from `"Instagram Feed"` |

This is different from **keyword search**: "message broker" can match Kafka docs even if those exact words never appeared in the title.

**Rule-based tags** (Phase 1–4) assign buckets like `developer-tools` from URL patterns. **Embeddings** capture cross-domain conceptual similarity — Kafka docs and RabbitMQ docs cluster together even on different domains.

---

## Why it matters in Echoes

Product goals from Phase 6:

- **Similar pages:** "Show me browsing history like this GitHub repo README."
- **Grounded Q&A:** "What did I read about message queues?" needs retrieval over *meaning*, not only tag overlap.

Rule-based tagging misses:

- Paraphrases (`"distributed log"` vs `"message broker"`)
- Same topic, different domains (Confluent blog vs Apache docs)
- Questions in natural language against stored titles/URLs

Embeddings are the bridge from **stored events** to **semantic retrieval**.

---

## What to embed (Echoes v1)

Start small — one embedding per event, not full page HTML:

```text
WEB_VISIT:  "{title}\n{url}"     — e.g. "Apache Kafka\nhttps://kafka.apache.org"
APP_VISIT:  "{appName}\n{title}" — e.g. "Instagram\nFeed"
```

**Why not URL alone?** Titles carry semantics URLs hide (`/docs/concepts/` vs `/pricing`).

**Why not full page content yet?** Extension only sends title + URL today. Full-page scraping/chunking is Phase 6+ ([07-emerging-topics.md](./07-emerging-topics.md)).

Normalize consistently (trim, collapse whitespace). Same string → same vector (enables cache).

---

## Model metadata you must store

Changing embedding models **invalidates** all stored vectors. Track:

| Column | Purpose |
|--------|---------|
| `model` | e.g. `text-embedding-3-small` |
| `dimensions` | e.g. `1536` — pgvector column must match |
| `embedded_at` | when generated |
| `content_hash` | hash of source text — skip re-embed if unchanged |

Never compare vectors from different models in one query.

---

## Async generation (not on the HTTP path)

Embedding API calls are **slow** (100ms–2s+) and **cost money**. They belong in the Phase 4 pipeline:

```
POST /events accepted
  → outbox EventIngested
  → embedding worker (separate queue from tagging)
  → EmbeddingPort.embed(text)
  → UPSERT event_embeddings
```

Ingest latency must stay identical to Phase 4. The extension never waits for embeddings.

See [06-ai-adapters-async-pipeline.md](./06-ai-adapters-async-pipeline.md) for ports, idempotency, and queue separation.

---

## Conceptual picture

```
"Apache Kafka" doc  ──►  v₁ = [0.02, -0.11, …]
"RabbitMQ tutorial" ──►  v₂ = [0.01, -0.10, …]   ← close to v₁
"Instagram Feed"    ──►  v₃ = [0.88,  0.42, …]   ← far from v₁, v₂

similarity(v₁, v₂) > similarity(v₁, v₃)
```

Common **similarity metrics** (used at query time — see [02](./02-vector-similarity-search.md)):

- **Cosine similarity** — angle between vectors; scale-invariant; usual default for text embeddings
- **L2 (Euclidean) distance** — geometric distance; `<->` in pgvector

Pick one metric and use it consistently in index + queries.

---

## Common mistakes

1. Embedding synchronously inside `SubmitEventUseCase` — blocks ingest.
2. Storing vectors without `model` / `dimensions` — silent breakage on model upgrade.
3. Re-embedding every duplicate URL visit — waste; use `content_hash` or URL-level cache ([07](./07-emerging-topics.md)).
4. Embedding empty or placeholder text — noisy neighbors in search results.
5. Calling OpenAI from domain or application layers — belongs behind `EmbeddingPort` in infrastructure.

---

## Exit criteria

- [ ] Explain embeddings in one paragraph without saying "AI magic."
- [ ] Name the Echoes v1 text fields embedded for `WEB_VISIT` and `APP_VISIT`.
- [ ] Explain why generation must be async and why model version must be stored.
- [ ] Contrast embeddings with rule-based URL tagging with one concrete example.

## Explain-back (5 minutes)

> "Embeddings map title+URL text to dense vectors so semantically similar pages sit close together. Echoes generates them in an async handler after ingest, stores model metadata with each vector, and uses them for similar-events search and RAG retrieval — never on the HTTP write path."

## Next

[02-vector-similarity-search.md](./02-vector-similarity-search.md) — store vectors in Postgres and query nearest neighbors safely.
