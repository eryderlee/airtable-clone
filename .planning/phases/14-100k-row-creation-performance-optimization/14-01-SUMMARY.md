---
phase: 14-100k-row-creation-performance-optimization
plan: 01
subsystem: api
tags: [trpc, drizzle, postgres, neon, faker, bulk-insert, performance]

# Dependency graph
requires:
  - phase: 09-neon-migration
    provides: Neon PgBouncer connection with prepare:false, transaction pooler at port 6543
  - phase: 02-data-layer
    provides: bulkCreate procedure returning { count }, rows schema, faker-js as prod dep
provides:
  - bulkCreate optimized for 100k rows via 5000-row chunks and 5-concurrent parallel inserts
  - maxDuration=300 on tRPC route handler preventing Vercel 504 timeouts
affects: [15-future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase bulk insert: pre-generate all chunks in memory, then execute in parallel batches via Promise.all"
    - "CHUNK_SIZE=5000 / CONCURRENCY=5 constants for Neon PgBouncer safe parallelism"

key-files:
  created: []
  modified:
    - src/app/api/trpc/[trpc]/route.ts
    - src/server/api/routers/row.ts

key-decisions:
  - "CHUNK_SIZE=5000: 5 columns × 5000 rows = 25,000 params, under Postgres 32,767 limit"
  - "CONCURRENCY=5: Neon free tier has ~10 pool connections; 5 concurrent is safe for single-user"
  - "maxDuration=300: Vercel serverless functions default to 10s timeout; 100k insert needs up to ~5s headroom"
  - "dynamic=force-dynamic: required alongside maxDuration on route segment config"

patterns-established:
  - "Two-phase bulk insert pattern: pre-generate chunks (CPU), then parallel DB inserts (IO-bound)"

# Metrics
duration: ~5min
completed: 2026-03-21
---

# Phase 14 Plan 01: 100k Row Creation Performance Optimization Summary

**bulkCreate rewritten with 5000-row chunks and 5-concurrent Promise.all batches, targeting ~88s -> ~4s for 100k rows; maxDuration=300 added to tRPC route to prevent Vercel 504**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T00:13:12Z
- **Completed:** 2026-03-21T00:18:00Z
- **Tasks:** 1 of 2 (checkpoint reached for human benchmark verification)
- **Files modified:** 2

## Accomplishments
- Increased CHUNK_SIZE from 1000 to 5000 — reduces Neon round-trips from 100 to 20 for 100k rows
- Added CONCURRENCY=5 with Promise.all batch execution — reduces 20 sequential round-trips to 4 sequential batches of 5 concurrent
- Pre-generation phase separates CPU-bound faker generation from IO-bound DB writes
- Added `maxDuration=300` and `dynamic=force-dynamic` to tRPC route segment config to prevent Vercel 504

## Task Commits

Each task was committed atomically:

1. **Task 1: Add maxDuration and optimize bulkCreate with larger chunks + parallelism** - `498b03f` (perf)

**Plan metadata:** (pending — checkpoint not yet resolved)

## Files Created/Modified
- `src/app/api/trpc/[trpc]/route.ts` - Added maxDuration=300 and dynamic=force-dynamic exports
- `src/server/api/routers/row.ts` - Changed CHUNK_SIZE 1000->5000, added CONCURRENCY=5, replaced sequential loop with two-phase parallel approach

## Decisions Made
- CHUNK_SIZE=5000 chosen as safe upper bound: 5 columns × 5000 rows = 25,000 params (under 32,767 Postgres limit)
- CONCURRENCY=5 chosen as safe for Neon free tier (~10 pool connections); single-user scenario
- Two-phase approach (pre-generate all chunks then execute) chosen over inline generation to keep the hot path clean and allow clean CONCURRENCY batching
- maxDuration=300 (5 minutes) gives substantial headroom — actual 100k insert expected to take 3-4 seconds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Code changes deployed; benchmark verification pending (checkpoint:human-verify)
- If benchmark reports under 6 seconds: Phase 14 complete
- If benchmark reports over 6 seconds: Plan 14-02 (generate_series SQL approach) is the escalation path

---
*Phase: 14-100k-row-creation-performance-optimization*
*Completed: 2026-03-21*
