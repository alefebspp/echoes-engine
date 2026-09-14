# 04 — Hybrid retrieval

**Prerequisites:** [02-vector-similarity-search.md](./02-vector-similarity-search.md) · [03-rag.md](./03-rag.md).

---

## Concept

**Hybrid retrieval** combines **semantic similarity** (vectors) with **structured filters** (metadata, tags, dates, domains) so results are relevant *and* precise.

Pure vector search returns plausible-but-wrong neighbors:

- Question about "Kafka" might retrieve a page that mentions "kafka" in an unrelated context
- Similar title embeddings from different time periods when user asked "last week"
- Same domain noise (all `github.com` pages cluster together)

Filters shrink the candidate set; vectors rank within it (or vice versa).

---

## Why it matters in Echoes

Echoes events already carry rich metadata ([api-endpoints.md](../api-endpoints.md)):

| Field | Source | Filter use |
|-------|--------|------------|
| `occurred_at` | column | date range ("last 7 days") |
| `event_type` | column | `WEB_VISIT` vs `APP_VISIT` |
| `metadata.url` | JSONB | domain filter (`github.com`) |
| `metadata.browser` | JSONB | optional narrow filter |
| tags | `event_tags` join | `developer-tools`, etc. |

Product examples:

- "What did I read about queues **this month**?" → date filter + vector question
- "Similar pages to this GitHub repo, **same tag**" → tag join + vector from reference event
- Similar events but **exclude** same URL duplicates

---

## Two composition patterns

### 1. Pre-filter, then vector rank (common in SQL)

Narrow rows first, then KNN on the subset:

```sql
SELECT e.id, e.metadata, ee.embedding <=> :query AS distance
FROM events e
JOIN event_embeddings ee ON ee.event_id = e.id
WHERE e.user_id = :userId
  AND e.occurred_at >= :from
  AND e.occurred_at < :to
  AND ee.model = :model
  -- optional: AND EXISTS (SELECT 1 FROM event_tags t WHERE t.event_id = e.id AND t.tag = :tag)
ORDER BY ee.embedding <=> :query
LIMIT :k;
```

**Pros:** Simple; tenant + date filters use existing B-tree indexes.  
**Cons:** ANN index may not be used if planner filters heavily first — measure with `EXPLAIN`.

### 2. Vector rank, then post-filter

Retrieve `K * 2` neighbors, drop rows failing metadata predicates, take top K.

**Pros:** Maximum semantic recall when filters are soft preferences.  
**Cons:** May return fewer than K results; leak risk if post-filter is buggy — still require SQL `user_id`.

For Echoes MVP, **pre-filter + vector rank** matches dashboard patterns (user-scoped, date windows).

---

## Hybrid vs multi-signal ranking

| Technique | What it is |
|-----------|------------|
| **Hybrid retrieval** | Hard filters (date, tag) + vector similarity |
| **Multi-signal ranking** | Weighted score: `0.7 * vector_sim + 0.2 * recency + 0.1 * tag_match` |

Start with hybrid filters. Add weighted re-ranking when product asks for "best overall" ordering beyond geometric similarity.

Recency decay example (application layer):

```typescript
finalScore = similarity * 0.85 + recencyBoost(occurredAt) * 0.15;
```

---

## RAG with filters

`POST /ai/ask` body may accept optional filters:

```json
{
  "question": "What did I read about messaging?",
  "from": "2026-06-01T00:00:00Z",
  "to": "2026-06-30T23:59:59Z",
  "tags": ["developer-tools"]
}
```

Flow:

1. Apply filters in retrieval SQL.
2. If **zero** rows after filter, refuse early — do not fall back to unfiltered search silently (that violates user's implied scope).
3. Optionally tell user: "No results in that date range."

---

## Relationship to rule-based tags

Tags and embeddings complement each other:

| Signal | Strength | Weakness |
|--------|----------|----------|
| Tags | Fast, explainable buckets | Miss cross-domain semantics |
| Embeddings | Semantic paraphrase | Opaque, can misfire on short text |

Hybrid retrieval can **require** tag overlap for precision or **boost** tagged matches without excluding untagged semantic neighbors — product choice.

Fallback when embeddings unavailable uses tags/URL rules ([05](./05-fallback-degradation.md)).

---

## Common mistakes

1. Pure KNN for time-bound questions — retrieves old irrelevant pages.
2. Silent widening: user filters June, system searches all time because KNN returned few hits.
3. Filtering on JSONB without index plan — OK at small scale; projection or expression index if hot path ([phase-5 index notes](../phase-5-cqrs-read-models/06-index-design.md)).
4. Confusing hybrid retrieval with training a hybrid model — here it is query composition only.

---

## Exit criteria

- [ ] Name three metadata filters Echoes can apply during retrieval.
- [ ] Choose pre-filter vs post-filter for a date-scoped RAG question and justify.
- [ ] Explain why pure vector search fails for "last week's Kafka reading" without a date filter.
- [ ] State the rule: empty filtered retrieval → refuse, not silent unfiltered fallback.

## Explain-back (5 minutes)

> "Hybrid retrieval runs vector similarity inside a user-scoped, optionally date/tag/domain-filtered set. That keeps RAG and similar-events precise — semantic rank alone is too noisy for questions with time or category intent."

## Next

[05-fallback-degradation.md](./05-fallback-degradation.md) — survive embedding and LLM outages.
