# 06 — Emerging topics (Week 4 optional)

Study these **lightly**. None should block Phase 5 readiness. Pick **one** for a 1–2 hour deep dive; park the rest.

---

## 1. Cache-aside

**One-liner:** Application reads Redis (or similar) first; on miss, loads from DB/projection, stores in cache with TTL; writes invalidate or rely on TTL.

```
GET /analytics/daily
  → cache.get(key)
      hit  → return
      miss → load projection → cache.set(key, TTL) → return

EventIngested projection update
  → optionally cache.del(key)   // or wait for TTL
```

**Why it appears here:** Hot dashboard keys after projections exist. Caching **before** projections only hides a slow aggregate temporarily.

**Echoes guidance:**

- Prefer correct projections first; add cache when read QPS or latency needs it.
- Key by `userId` + query params (`days`, etc.).
- TTL aligned with staleness docs (e.g. 30–60s) is often enough; explicit invalidation is sharper but easy to get wrong.
- Cache is not a substitute for indexes or CQRS — it is a layer on top.

**Done when (light):** You can draw hit/miss/invalidate and say why TTL-only might be OK for daily stats.

---

## 2. Data retention

**One-liner:** Policy to archive or purge old events so storage and analytics stay bounded; projections must remain coherent.

**Why it appears here:** Volume makes analytics expensive; “keep forever” is a decision, not a default.

**Questions to answer later:**

- How long raw `events` live (90 days? 1 year? forever)?
- Do you soft-delete, hard-delete, or export-to-cold-storage?
- When purging events, do you rebuild projections, decrement counters, or keep stats as historical truth without raw rows?

**Echoes guidance:**

- Retention is a product + legal choice; implement after analytics shapes stabilize.
- Never purge events while assuming projections auto-fix — define a job that keeps read models honest (rebuild from remaining events, or freeze historical aggregates).

**Done when (light):** You wrote a one-paragraph retention hypothesis for personal browsing data and named the projection risk.

---

## 3. Export API

**One-liner:** GDPR-ish portability — `GET /users/me/export` (or async job) returns the user’s data package.

**Why it appears here:** Analytics surfaces raise “show me / give me my data” expectations.

**Echoes guidance:**

- Scope to authenticated user only.
- May be heavy → async job + download link pattern (reuses Phase 4 async thinking).
- Contents: profile, settings, events, tags; document format (JSON).
- Not the same as dashboard analytics — export is completeness; dashboard is aggregation.

**Done when (light):** You can separate “dashboard stats” from “data portability export” in one sentence each.

---

## 4. Recursive CTEs (Neo4j warm-up)

**One-liner:** SQL `WITH RECURSIVE` walks hierarchical or sequential relationships (session chains, “pages after X”) **inside PostgreSQL** before adopting Neo4j.

**Why it appears here:** Walkthrough Phase 5.5 hint — prove whether you need a graph database.

```sql
-- Conceptual: ordered session steps (illustration only)
WITH RECURSIVE chain AS (
  SELECT id, user_id, occurred_at, metadata, 1 AS depth
  FROM events
  WHERE id = :startEventId AND user_id = :userId

  UNION ALL

  SELECT e.id, e.user_id, e.occurred_at, e.metadata, c.depth + 1
  FROM events e
  JOIN chain c ON e.user_id = c.user_id
  WHERE e.occurred_at > c.occurred_at
    AND e.occurred_at < c.occurred_at + interval '30 minutes'
    -- plus “next event” tie-break rules...
)
SELECT * FROM chain WHERE depth <= 20;
```

Real sessionization usually needs clearer “next event” rules (lag/lead windows often beat naive recursion). The **learning point** is: try graph-shaped questions in SQL; if recursive/window queries become unmaintainable or slow, Neo4j (Phase 7) is motivated — not fashionable.

**Done when (light):** You can explain why “validate graph need in Postgres” comes before Neo4j.

---

## Suggested pick-one deep dive

| If you care about… | Pick |
|--------------------|------|
| Dashboard latency under load | Cache-aside |
| Disk growth / privacy | Data retention |
| Compliance / trust | Export API |
| Phase 7 readiness | Recursive CTEs / session queries |

---

## Exit criteria (all emerging)

- [ ] You can one-liner each of the four topics.
- [ ] You spent focused time on at most one without blocking Phase 5 implementation.

## Back to the core path

Return to the [README checklist](./README.md#progress-checklist) and the Phase 5 readiness check in the [study plan](../phase-5-study-plan.md#phase-5-readiness-check).

When coding, follow implementation order: query handlers → projections → analytics GETs → cursor list + indexes → MV if needed → ADR.
