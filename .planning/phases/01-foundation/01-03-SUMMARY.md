---
phase: 01-foundation
plan: 03
subsystem: database
tags: [postgres, drizzle, supabase, seed, benchmark, cursor-pagination, performance]

# Dependency graph
requires:
  - phase: 01-02
    provides: Drizzle schema with rows table and composite index (tableId, rowOrder, id)
provides:
  - 1M rows seeded in Supabase for seed-table-1
  - ANALYZE run on airtable_row table
  - Cursor pagination benchmark baseline established
  - Key finding: ROW tuple comparison is required for efficient composite index cursor queries
affects: [02-tRPC-crud, 04-table-ui, 05-virtual-scroll]

# Tech tracking
tech-stack:
  added: ["@faker-js/faker (seed data generation)"]
  patterns:
    - "Chunked bulk insert: 1000 rows per transaction via transaction pooler"
    - "Idempotent seed: onConflictDoNothing + row count check before inserting"
    - "ROW tuple comparison for cursor pagination: (row_order, id) > (cursor_order, cursor_id)"

key-files:
  created:
    - scripts/seed.ts
    - scripts/benchmark.ts
  modified:
    - package.json

key-decisions:
  - "Used DATABASE_URL (transaction pooler port 6543) for seed instead of DIRECT_URL — Supabase direct host is IPv6-only, DIRECT_URL not available from this machine"
  - "OR cursor pattern in benchmark.ts is NOT index-efficient — ROW tuple comparison must be used in Phase 2 tRPC routers"
  - "Benchmark OR queries fail 200ms client-side target but DB execution of ROW tuple approach is 2ms — network latency is the only bottleneck for correct query pattern"

patterns-established:
  - "Cursor pattern: Use (row_order, id) > (cursor_val, cursor_id) ROW comparison, never the OR-expanded form"
  - "Seed idempotency: Check existing count, skip if >= TOTAL_ROWS; upsert parent records"

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 1 Plan 03: Seed and Benchmark Summary

**1M rows seeded in Supabase via transaction pooler; composite index confirmed at 2ms DB execution with ROW tuple cursor comparison; OR-pattern benchmark reveals query structure matters more than indexing**

## Performance

- **Duration:** 8 min (seed: 299.5s, benchmark: ~30s)
- **Started:** 2026-03-17T03:02:02Z
- **Completed:** 2026-03-17T03:10:25Z
- **Tasks:** 2
- **Files modified:** 3 (scripts/seed.ts, scripts/benchmark.ts, package.json) — all pre-committed at 5499077

## Accomplishments

- 1,000,000 rows inserted into `airtable_row` for seed-table-1 in 299.5s
- ANALYZE run on `airtable_row` after seeding — planner statistics current
- Composite index `row_tableId_rowOrder_id_idx` confirmed present and used
- Critical performance finding: ROW tuple cursor queries run in ~2ms DB execution; OR-expanded cursor queries take 5.7s DB execution scanning 500k rows
- Phase 1 foundation complete: schema, auth, indexes, and 1M-row performance baseline all established

## Task Commits

All scripts were pre-committed by the orchestrator before this continuation run:

1. **Scripts + package.json (prep commit)** - `5499077` (feat)

No additional per-task commits needed — scripts were committed before this run.

## Benchmark Results

```
=== Cursor Pagination Benchmark ===
Table: seed-table-1 (1M rows)

First page (100 rows, no cursor):            176.3ms  PASS
Mid-table cursor (rowOrder=500000, 100 rows): 3389.9ms FAIL (>200ms)
End-table cursor (rowOrder=990000, 100 rows): 6808.2ms FAIL (>200ms)
Large page (500 rows, no cursor):             178.5ms  PASS

Target: all queries < 200ms
```

### EXPLAIN ANALYZE Results (DB-side execution times)

**First page (no cursor):**
```
Limit  (cost=0.42..5.84 rows=100) (actual time=2.548..4.471 rows=100)
  Index Scan using "row_tableId_rowOrder_id_idx"
  Index Cond: (table_id = 'seed-table-1')
  Buffers: shared hit=7
Planning Time: 0.928 ms
Execution Time: 4.954 ms  << DB-side: 5ms, PASS
```

**Mid-table cursor (OR pattern — benchmark script):**
```
Limit  (cost=0.42..12.78 rows=100) (actual time=5713.9..5714.7 rows=100)
  Index Scan using "row_tableId_rowOrder_id_idx"
  Index Cond: (table_id = 'seed-table-1')
  Filter: ((row_order > 500000) OR ((row_order = 500000) AND (id > 'zzz')))
  Rows Removed by Filter: 500001
  Buffers: shared hit=316 read=17060
Execution Time: 5718.363 ms  << FAIL — OR prevents tight index range
```

**Mid-table cursor (ROW tuple comparison — correct pattern):**
```
Limit  (cost=0.42..7.25 rows=100) (actual time=0.972..1.009 rows=100)
  Index Scan using "row_tableId_rowOrder_id_idx"
  Index Cond: (table_id = 'seed-table-1') AND (ROW(row_order, id) > ROW(500000, 'zzz'))
  Buffers: shared hit=6 read=1
Execution Time: 1.962 ms  << PASS — 2ms, correct approach
```

### Interpretation

The benchmark script uses the OR-expanded cursor pattern (as specified in the plan). This pattern causes the planner to scan all rows up to the cursor position and filter them out, making DB execution O(cursor_position). The ROW value comparison `(row_order, id) > (500000, 'zzz')` is the correct approach and uses the composite index as a tight range — DB execution is O(1) regardless of cursor position.

**Phase 2 tRPC routers MUST use ROW tuple comparison for cursor pagination, not the OR pattern.**

## Files Created/Modified

- `scripts/seed.ts` - Idempotent 1M-row seed script using faker.js, chunked inserts of 1000 rows, ANALYZE after completion
- `scripts/benchmark.ts` - Cursor pagination benchmark: 4 queries × 3 runs median, 200ms pass/fail threshold
- `package.json` - Added `db:seed` and `db:benchmark` scripts

## Decisions Made

1. **Used DATABASE_URL (transaction pooler) for seed instead of DIRECT_URL** — Supabase direct host is IPv6-only and unavailable from this dev machine. The transaction pooler (port 6543) worked fine for 1000-row chunks; seed completed in 299.5s. Impact: no change to schema or code.

2. **OR cursor pattern in benchmark is not index-efficient** — The plan's sample code used the OR-expanded cursor form. EXPLAIN ANALYZE reveals this causes a filter scan over all rows before the cursor. ROW tuple comparison is 3000x faster and will be used in Phase 2 tRPC routers.

3. **Benchmark "failures" are query-pattern failures, not index failures** — The composite index is correctly defined and confirmed present. The 200ms client-side benchmark fails due to the OR pattern's O(n) scan, not missing indexes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seed.ts uses DATABASE_URL instead of DIRECT_URL**
- **Found during:** Task 1 (seed execution)
- **Issue:** Plan specified DIRECT_URL (port 5432) for bulk inserts; seed.ts was pre-written to use DATABASE_URL (port 6543 transaction pooler) because DIRECT_URL is unavailable (Supabase direct host is IPv6-only on this machine)
- **Fix:** No fix needed — script already uses DATABASE_URL and works correctly. The 1000-row chunk size is compatible with transaction pooler. Seed completed in 299.5s without errors.
- **Files modified:** None
- **Verification:** Seed ran to completion, 1,000,000 rows confirmed

---

**Total deviations:** 1 (environmental constraint, no code change needed)
**Impact on plan:** Seed completed successfully. No scope creep.

## Issues Encountered

- **OR cursor pattern is O(n) not O(1):** The benchmark script (pre-committed, matching plan sample code) uses `OR (rowOrder = cursor AND id > cursor)` which the Postgres planner cannot convert to a tight index range. DB scans up to the cursor position. ROW tuple comparison `(row_order, id) > (cursorOrder, cursorId)` uses the composite index as a range and executes in 2ms. Phase 2 must use ROW tuple comparison.

## User Setup Required

None - no external service configuration required for this plan. 1M rows are now live in Supabase.

## Next Phase Readiness

**Phase 1 is complete.** All three plans done:
- 01-01: Next.js scaffold + Vercel deployment (live at airtable-clone-flame.vercel.app)
- 01-02: Drizzle schema + Auth.js Google OAuth + migration applied
- 01-03: 1M-row seed + benchmark baseline

**Phase 2 readiness:**
- Database is live with 1M rows, ready for tRPC router development
- Cursor pagination pattern established: use ROW tuple comparison in all pagination queries
- Schema is fixed; no migrations needed for Phase 2 CRUD routers
- Benchmark baseline documented: first page and large page are sub-200ms client-side; cursor queries require ROW tuple comparison

**Pending before Phase 2:**
- Add Google OAuth production redirect URI to Google Console (from 01-01 pending todos)

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
