# 03 — Eventual consistency (read side)

**You already know:** Projections update asynchronously from `EventIngested`.  
**This note:** what clients must assume while those updates catch up.

---

## Concept

**Eventual consistency** (here) means: after a successful write, read models are **not** guaranteed to reflect that write on the next millisecond. They become correct **after** handlers (and possibly enrichment) finish — usually seconds, not days.

This is **not** “the database might lose your event.” The write path still persists the event (+ outbox) durably. Only the **read projection** lags.

| Strongly consistent read (typical myth) | Eventually consistent read (Echoes dashboard) |
|------------------------------------------|-----------------------------------------------|
| “POST returned 201 → GET stats includes it” | “POST returned 201 → stats include it soon” |
| Same request transaction as write | Separate async path |
| Harder to scale ingest + analytics | Matches Phase 4 architecture |

---

## Why it matters in Echoes

Phase 4 already made tagging async. Analytics hanging off the same stream inherits lag:

```
T0  Ingest accepted — events row exists
T1  Daily projection updated — count visible, tags maybe empty
T2  Tagging done — tag stats / category breakdown catch up
```

If the API docs (or UI) imply real-time truth, users report “bugs” that are actually **documented delay**.

---

## Staleness contract (write this down)

A short contract you can put in API docs:

> Analytics and dashboard aggregates are eventually consistent with ingest. After `POST /events`, daily and tag stats usually update within a few seconds once async handlers run. Tag-dependent breakdowns may lag until enrichment completes. Responses may include `asOf` / `generatedAt` when useful. The events list may show a row before projections reflect it.

Tune the “few seconds” to your real worker SLOs when you measure them.

Optional response fields:

| Field | Meaning |
|-------|---------|
| `asOf` / `generatedAt` | Snapshot time for this payload |
| (later) MV refresh time | For weekly rollups on a schedule |

---

## What is allowed to be “wrong” briefly

| Observation | Usually OK? |
|-------------|-------------|
| New event in list, daily count not +1 yet | Yes — projection lag |
| Daily count +1, tag breakdown unchanged | Yes — waiting on tagging |
| `POST` succeeded but event missing from DB | No — write-path bug |
| Double-counted day after retries | No — projection idempotency bug |

Eventual consistency is not an excuse for lost writes or double-counting.

---

## CQRS + projections + this note

```
Command path          Async                  Query path
────────────          ─────                  ──────────
Accept event    →   Projection update   →   GET stats
Durable write       (lag window)            Reads projection
```

Clients that need “confirm this event exists” should use the **list/detail** of events (write model), not wait on aggregates — or poll until `asOf` advances.

---

## Common mistakes

1. No staleness docs → users assume real-time.
2. Blocking HTTP ingest until projections finish “to be consistent.”
3. Hiding lag with a cache that is even staler without saying so.
4. Treating enrichment lag and projection lag as the same without explaining both.

---

## Exit criteria

- [ ] You can define eventual consistency for the Echoes read API in one paragraph.
- [ ] You wrote a staleness note a frontend could implement against.
- [ ] You can separate “lag” from “lost event” and from “double count.”

## Explain-back (5 minutes)

> “After ingest, the event is durable immediately, but dashboard projections update asynchronously—so counts and tag breakdowns can lag by seconds, especially until tagging finishes. We document that and optionally expose freshness timestamps. Eventual consistency is expected; silent real-time assumptions are the bug.”

## Next

[04-query-handlers.md](./04-query-handlers.md) — application objects that only read.
