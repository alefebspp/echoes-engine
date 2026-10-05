# 03 — Retrieval-Augmented Generation (RAG)

**Prerequisites:** [01](./01-semantic-embeddings.md) (embeddings) · [02](./02-vector-similarity-search.md) (retrieve top-K).

---

## Concept

**RAG** = **R**etrieval + **A**ugment + **G**enerate:

1. **Retrieve** — fetch the most relevant records from _your_ database (vector KNN + filters).
2. **Augment** — inject those records into the LLM prompt as context.
3. **Generate** — LLM produces an answer conditioned on that context only.

The model's general training data is **not** the source of truth for "what did _I_ read?" — your retrieved events are.

```
User: "What did I read about message queues?"
  → embed question
  → retrieve top-K events (user-scoped)
  → prompt: "Answer using ONLY these snippets: …"
  → LLM answer + cite event_ids
```

Without retrieval, the LLM **hallucinates** browsing history or answers from generic knowledge — wrong and invasive for a personal memory product.

---

## Why it matters in Echoes

Phase 6 delivers something like:

`POST /api/v1/ai/ask` — authenticated user asks a natural-language question about their history.

Requirements from the walkthrough:

- Answers **cite** specific `event_ids`
- **Refuse** when retrieval returns nothing useful
- **Scope** strictly to the authenticated user's data ([02](./02-vector-similarity-search.md))

RAG is the standard pattern for grounded Q&A without fine-tuning a model on user data.

---

## Pipeline (Echoes-shaped)

```
POST /ai/ask { "question": "..." }
  │
  ├─► AskQuestionUseCase (application)
  │     ├─► EmbeddingPort.embed(question)
  │     ├─► EventEmbeddingRepository.findSimilar(userId, vector, k, filters?)
  │     ├─► if empty / below threshold → return refusal (no LLM call)
  │     ├─► build prompt from retrieved snippets
  │     ├─► LLMPort.generate(prompt)
  │     └─► map to response DTO with citations
  │
  └─► Controller returns { answer, citations[], retrievedCount }
```

Domain layer does **not** call OpenAI. Application orchestrates ports; infrastructure implements them ([06](./06-ai-adapters-async-pipeline.md)).

---

## Prompt structure (minimal template)

```text
You are a assistant answering questions about the user's browsing history.
Use ONLY the sources below. If the sources do not contain enough information, say you cannot answer.

Sources:
[1] event_id=abc-123 occurred_at=2026-06-01 title="Apache Kafka" url=https://kafka.apache.org
[2] event_id=def-456 occurred_at=2026-06-03 title="RabbitMQ Tutorial" url=https://...

Question: What did I read about message queues?

Instructions:
- Cite source numbers like [1] or [2].
- Do not invent URLs or pages not listed above.
```

Keep snippets **short** (title, URL, date, maybe one-line tag summary). Full page bodies come later with chunking ([07](./07-emerging-topics.md)).

---

## Citations and API contract

Response shape (illustrative):

```json
{
  "answer": "You read about Apache Kafka [1] and a RabbitMQ tutorial [2] in early June.",
  "citations": [
    {
      "eventId": "abc-123",
      "title": "Apache Kafka",
      "url": "https://kafka.apache.org"
    },
    { "eventId": "def-456", "title": "RabbitMQ Tutorial", "url": "https://..." }
  ],
  "retrievedCount": 2,
  "refused": false
}
```

**Refusal** when retrieval is empty or all scores below threshold:

```json
{
  "answer": "I couldn't find relevant pages in your history to answer that.",
  "citations": [],
  "retrievedCount": 0,
  "refused": true
}
```

Refusal is a **feature** — better than hallucination. Aligns with "fail fast" from cross-phase principles.

---

## Top-K and token budget

Do not stuff entire history into the prompt.

| Knob                  | Typical starting point   |
| --------------------- | ------------------------ |
| K (retrieved events)  | 5–15                     |
| Max snippet length    | title + URL + ~100 chars |
| LLM max output tokens | 300–500                  |

If the question is broad, retrieve more, then **compress** or take top-5 after re-ranking — not all K need enter the prompt.

Cost grows with context size. Rate-limit `/ai/ask` ([07](./07-emerging-topics.md)).

---

## What RAG does not fix

| Problem                         | RAG helps?    | Mitigation                                                                                          |
| ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Wrong retrieval (bad neighbors) | Partially     | Hybrid filters, threshold, eval set ([04](./04-hybrid-retrieval.md), [07](./07-emerging-topics.md)) |
| Adversarial text in page titles | No            | Prompt injection defenses ([07](./07-emerging-topics.md))                                           |
| Stale embeddings                | No            | Re-embed on model change; content_hash                                                              |
| Questions outside browsing data | Yes (refusal) | Empty retrieval → refuse                                                                            |

---

## Common mistakes

1. LLM call with **no** retrieval context — generic chatbot, not RAG.
2. No citations in the response — user cannot verify.
3. Prompt stuffing thousands of events — token limits, noise, cost.
4. Trusting LLM to respect "don't hallucinate" without retrieval enforcement **and** refusal path.
5. Synchronous embed + retrieve + generate inside ingest — wrong pipeline; ask is a read/query path.

---

## Local demo seed

To try RAG against Postgres without ingesting events by hand:

```bash
docker compose up -d db redis
npm run migration:run
npm run seed:rag
npm run start:dev
```

`npm run seed:rag` upserts user `rag@echoes.local` / `ragdemo1234`, 15 themed events (tags included), and embeddings. Re-running replaces only the `rag-seed-*` events for that user.

Use the **same** `.env` as the API. With no provider key, vectors come from the fake adapter. `AI_PROVIDER=gemini` and `GEMINI_API_KEY` use Gemini (`gemini-embedding-2` at 1536 dimensions and `gemini-3.8-flash`). An `OPENAI_API_KEY` with `AI_PROVIDER` unset keeps OpenAI. Switching provider or model requires a re-seed so `event_embeddings.model` matches query-time embeddings.

```bash
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rag@echoes.local","password":"ragdemo1234"}' \
  | jq -r .token)

curl -s http://localhost:3000/api/v1/ai/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"question":"What did I read about message queues?"}'
```

| What to try               | Request body / path                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Message queues cluster    | `{"question":"What did I read about message queues?"}`                                                                              |
| DDD cluster               | `{"question":"What did I learn about domain-driven design?"}`                                                                       |
| RAG / embeddings cluster  | `{"question":"What did I read about embeddings or RAG?"}`                                                                           |
| Hybrid tag filter         | `{"question":"What did I read about Kafka?","tags":["developer tools"]}`                                                            |
| Date window (June 2026)   | `{"question":"What did I watch on Netflix?","from":"2026-06-01T00:00:00.000Z","to":"2026-06-15T00:00:00.000Z"}`                     |
| Refusal (empty retrieval) | `{"question":"What did I read about underwater basket weaving?","from":"2099-01-01T00:00:00.000Z","to":"2099-01-02T00:00:00.000Z"}` |
| Similar to Kafka          | `GET /api/v1/events/11111111-1111-4111-8111-111111111001/similar`                                                                   |

---

## Exit criteria

- [ ] Draw retrieve → augment → generate for Echoes on paper.
- [ ] Write a refusal rule (empty retrieval or similarity floor).
- [ ] Sketch response JSON with `citations` and `eventId`.
- [ ] Explain why RAG beats fine-tuning for personal browsing Q&A.

## Explain-back (5 minutes)

> "RAG embeds the user's question, retrieves their top-K similar events from pgvector, puts those snippets in the prompt, and asks the LLM to answer using only that context. We return citations and refuse when nothing relevant is retrieved — grounding beats hallucination."

## Next

[04-hybrid-retrieval.md](./04-hybrid-retrieval.md) — tighten retrieval with metadata filters.
