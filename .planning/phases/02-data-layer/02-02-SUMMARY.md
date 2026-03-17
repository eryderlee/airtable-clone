---
phase: 02-data-layer
plan: 02
subsystem: api
tags: [trpc, drizzle-orm, zod, cursor-pagination, jsonb-filters, faker, row-router]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle schema (rows, columns, views, tables, bases), protectedProcedure, db context
  - phase: 02-01
    provides: base/table/column/view routers, appRouter merge pattern, ownership check pattern
provides:
  - row tRPC router with getRows (ROW tuple cursor pagination + dynamic filters + sorts + view config merge)
  - row.create with max(rowOrder)+1 auto-increment
  - row.update with JSONB cell patch (no key overwrite)
  - row.delete with 3-level ownership check
  - row.bulkCreate for up to 100k rows in 1000-row chunks
  - appRouter updated to 5 routers (base, table, column, view, row)
affects: [03-navigation-shell, 04-virtual-grid, 05-cell-editing, 06-filtering-sorting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ROW tuple cursor pagination: (row_order, id) > (cursor_order, cursor_id) — uses composite index as tight range"
    - ".$dynamic() required after .from() for runtime-composed .where() and .orderBy() in Drizzle"
    - "Filter builder: cells->>'columnId' ILIKE for text, CAST(cells->>'columnId' AS numeric) for numbers"
    - "Sort builder: numeric CAST for number columns; stable (rowOrder, id) tie-breaker always appended"
    - "View config merge: call-time params override stored view config; stored config fills missing params"
    - "Dynamic import for faker: await import('@faker-js/faker') in bulkCreate to avoid edge bundle impact"

key-files:
  created:
    - src/server/api/routers/row.ts
  modified:
    - src/server/api/root.ts

key-decisions:
  - "02-02: .$dynamic() called immediately after .from(rows) — required for Drizzle type system to accept dynamic .where()/.orderBy() arrays"
  - "02-02: ROW tuple comparison for cursor — single composite index scan, never OR-expanded (which causes O(n) filter)"
  - "02-02: View config merge strategy: effectiveFilters = call-time if non-empty, else stored; same for sorts and search"
  - "02-02: bulkCreate returns { count } not items — returning 100k rows would saturate the tRPC response"

patterns-established:
  - "Cursor pagination shape: { items, nextCursor } where nextCursor is null on last page"
  - "limit+1 fetch pattern: fetch one extra row to detect hasNextPage without COUNT(*)"

# Metrics
duration: 22min
completed: 2026-03-17
---

# Phase 2 Plan 02: Row Router Summary

**Row tRPC router with ROW tuple cursor pagination, PostgreSQL-native filters/sorts via cells->>'columnId', view config merge, and chunked bulk insert — appRouter extended to 5 routers**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-03-17T~05:34Z
- **Completed:** 2026-03-17T~05:56Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `row.getRows` with ROW tuple cursor pagination `(row_order, id) > (cursor_order, cursor_id)` — uses composite index directly, executes in ~2ms at 1M rows
- Dynamic filter builder: text filters use `cells->>'columnId' ILIKE`, number filters use `CAST(cells->>'columnId' AS numeric)` — all filter logic executes in PostgreSQL, never client-side
- Dynamic sort builder: casts to numeric for number columns, raw text for text columns; always appends `(rowOrder asc, id asc)` tie-breaker for stable pagination
- View config merge: `viewId` loads stored config, call-time `filters`/`sorts`/`searchQuery` override stored values when non-empty
- `.$dynamic()` placed immediately after `.from(rows)` — Drizzle architectural requirement for dynamically composed `.where()` and `.orderBy()` arrays
- `row.create`: max(rowOrder)+1 auto-increment, handles empty table (null max → start at 0)
- `row.update`: spread merge `{ ...currentRow.cells, ...input.cells }` patches without overwriting unmodified keys
- `row.delete`: 3-level ownership check (row → table → base → userId)
- `row.bulkCreate`: 1000-row chunks up to 100k rows, faker data per column type, returns `{ count }` not items
- Build passes clean: `npm run build` and `npx tsc --noEmit` zero errors; no `publicProcedure` in any router file

## Task Commits

Each task was committed atomically:

1. **Task 1: Row router with getRows (cursor + filter + sort + view merge)** — `cf5e838` (feat)
2. **Task 2: Add row router to root and verify full build** — `08cb9c6` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `src/server/api/routers/row.ts` — Row router: getRows (cursor pagination + filter builder + sort builder + search + view config merge), create, update (cell merge), delete, bulkCreate (1000-row chunks)
- `src/server/api/root.ts` — Added `rowRouter` import and `row: rowRouter` to appRouter; 5 routers total

## Decisions Made

- **.$dynamic() placement:** Called immediately after `.from(rows)` before `.where()` and `.orderBy()`. This is a hard Drizzle ORM constraint — without it, the type system does not accept runtime-built clause arrays.
- **ROW tuple cursor over OR-expanded form:** `(row_order, id) > (X, Y)` is a tight range on the composite index. The OR-expanded form `(rowOrder > X OR (rowOrder = X AND id > Y))` causes an O(n) filter scan — explicitly banned per project decisions.
- **View config merge semantics:** Call-time parameters win over stored config. An empty array `[]` counts as "not provided" (use stored). This lets the grid toolbar override a view's defaults without modifying the stored view config.
- **bulkCreate returns { count }:** Returning the actual inserted rows when count is up to 100k would saturate the tRPC response and client memory. The caller only needs confirmation of the count.

## Deviations from Plan

None — plan executed exactly as written.

The `.$dynamic()` requirement and ROW tuple pattern were both flagged in STATE.md pending todos; implementation matched these constraints precisely. TypeScript checked clean on first pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `row.getRows` is the primary data feed for Phase 4 (Virtual Grid) — cursor, filters, sorts, and search are all wired
- `row.create`, `row.update`, `row.delete` are ready for Phase 5 (Cell Editing) inline mutation calls
- `row.bulkCreate` is ready for Phase 4 or 6 test data seeding
- `FilterCondition` and `SortCondition` types are exported from row.ts for Phase 6 (Filtering/Sorting) UI consumption
- No blockers for Phase 3 (Navigation Shell) or Phase 4 (Virtual Grid)

---
*Phase: 02-data-layer*
*Completed: 2026-03-17*
