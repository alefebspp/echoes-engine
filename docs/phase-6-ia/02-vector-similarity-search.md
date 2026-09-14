# 02 — Vector similarity search (pgvector)

**Prerequisite:** [01-semantic-embeddings.md](./01-semantic-embeddings.md) — you know what vectors are and where they come from.

---

## Concept

**Vector similarity search** finds the **K nearest neighbors** to a query vector in embedding space — the pages most semantically similar to a reference page or natural-language question.

At small scale you can brute-force compare every vector. At thousands+ events per user, you need an **approximate nearest neighbor (ANN) index** — pgvector provides this inside PostgreSQL, so Echoes avoids a separate vector DB on day one.

---

## Why it matters in Echoes

Endpoints Phase 6 targets:

| Endpoint | Flow |
|----------|------|
| `GET /events/:id/similar` | Load event embedding → KNN → return related events |
| RAG retrieval (internal) | Embed user question → KNN → top-K events as LLM context |

Keyword / tag filters alone miss paraphrases. Vector search powers both features.

---

## Schema sketch

Enable extension and store vectors **with tenant key**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE event_embeddings (
  event_id      UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding     vector(1536) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  dimensions    INT NOT NULL,
  content_hash  VARCHAR(64) NOT NULL,
  embedded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_embeddings_user
ON event_embeddings(user_id);

-- ANN index (example: HNSW + cosine)
CREATE INDEX idx_event_embeddings_hnsw
ON event_embeddings
USING hnsw (embedding vector_cosine_ops);
```

**Dimensions must match the model.** `text-embedding-3-small` → 1536; `text-embedding-3-large` → 3072. Migration required when changing models — do not cast blindly.

---

## Query patterns

### Similar to an existing event

```sql
SELECT
  e.id,
  e.occurred_at,
  e.metadata,
  1 - (ee.embedding <=> ref.embedding) AS similarity
FROM event_embeddings ee
JOIN events e ON e.id = ee.event_id
JOIN event_embeddings ref ON ref.event_id = :referenceEventId
WHERE ee.user_id = :userId          -- mandatory tenant filter
  AND ref.user_id = :userId         -- defense in depth
  AND ee.event_id <> :referenceEventId
  AND ee.model = ref.model          -- same model only
ORDER BY ee.embedding <=> ref.embedding
LIMIT :k;
```

Operators (pgvector):

| Operator | Meaning |
|----------|---------|
| `<=>` | Cosine distance |
| `<->` | L2 distance |
| `<#>` | Inner product (negative) |

Use the operator that matches your index (`vector_cosine_ops`, `vector_l2_ops`, …).

### Similar to a natural-language question (RAG retrieve step)

1. Embed the question via `EmbeddingPort` (same model as stored vectors).
2. Run the same KNN with `ORDER BY embedding <=> :queryVector`.

---

## Tenant isolation (non-negotiable)

Vector indexes are global. **Every query must filter by authenticated `user_id`.**

```
WRONG:  SELECT ... ORDER BY embedding <=> :q LIMIT 10
RIGHT:  SELECT ... WHERE user_id = :authUserId ORDER BY embedding <=> :q LIMIT 10
```

Failure modes if you skip this:

- User A's question retrieves User B's browsing history
- "Similar events" leaks cross-tenant URLs

**Defense in depth:**

- Filter in SQL (`WHERE user_id = ?`)
- Join `events` and assert `events.user_id = ?`
- Integration test: two users, assert zero cross-leak

This is a **design rule**, not an optimization.

---

## Index choice (practical)

| Index | Pros | Cons |
|-------|------|------|
| **HNSW** | Fast queries, good default at moderate scale | Build memory; params to tune |
| **IVFFlat** | Lower memory | Needs `lists` tuning; slower build/query tradeoffs |

For personal-scale Echoes (10k–100k vectors total), HNSW with cosine ops is a reasonable default. Revisit when `EXPLAIN ANALYZE` shows seq scans or recall drops.

**Partial indexes** by `user_id` are usually impractical (too many users). Tenant safety comes from the `WHERE` clause, not from per-user physical partitions at MVP scale.

---

## Similarity vs business ranking

KNN returns geometric neighbors. Product may re-rank:

- Boost recency (`occurred_at`)
- Require minimum similarity threshold (drop weak matches)
- De-duplicate same domain/URL

Keep KNN in SQL; light re-ranking in the query handler is fine. Heavy hybrid logic → [04-hybrid-retrieval.md](./04-hybrid-retrieval.md).

---

## Common mistakes

1. Vector search without `user_id` filter — cross-user data leak.
2. Mixing vectors from different models in one query.
3. No ANN index — fine in dev, pain at 10k+ rows.
4. Using `<->` index with `<=>` query (operator/index mismatch).
5. Returning neighbors with similarity 0.42 and calling them "related" — set a floor or show scores.

---

## Exit criteria

- [ ] Sketch `event_embeddings` columns including `user_id`, `model`, `dimensions`.
- [ ] Write pseud-SQL for top-K similar events scoped to one user.
- [ ] Explain cosine distance vs L2 in one sentence each.
- [ ] Name one test you would write to prove tenant isolation.

## Explain-back (5 minutes)

> "We store one embedding per event in pgvector, indexed for approximate nearest neighbor search. Every similarity query filters by the authenticated user_id and matches model version. Similar-events and RAG both use the same KNN pattern with different query vectors."

## Next

[03-rag.md](./03-rag.md) — use retrieved events to ground LLM answers.
