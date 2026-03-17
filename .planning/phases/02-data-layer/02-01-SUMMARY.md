---
phase: 02-data-layer
plan: 01
subsystem: api
tags: [trpc, drizzle-orm, zod, crud, ownership, faker, jsonb]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle schema (bases, tables, columns, rows, views), protectedProcedure, db context
provides:
  - base tRPC router with full CRUD (getAll, create, update, delete)
  - table tRPC router with full CRUD + faker seed (getByBaseId, create, update, delete)
  - column tRPC router with auto-incrementing order (getByTableId, create, update, delete)
  - view tRPC router with partial config merge (getByTableId, create, update, updateConfig, delete)
  - appRouter merged with all four routers, post.ts removed
affects: [03-navigation-shell, 04-virtual-grid, 05-cell-editing, 06-filtering-sorting]

# Tech tracking
tech-stack:
  added: ["@faker-js/faker moved to production dependencies (was devDependencies)"]
  patterns:
    - "protectedProcedure on every procedure — unauthenticated requests throw UNAUTHORIZED"
    - "2-level join ownership check for table-scoped operations (table -> base -> userId)"
    - "3-level join ownership check for column/view operations (column/view -> table -> base -> userId)"
    - "Dynamic faker import (await import) to avoid bundling in edge runtime when not needed"
    - "Partial config merge for view.updateConfig using Object.fromEntries + filter undefined"
    - "max() from drizzle-orm for auto-incrementing column order"

key-files:
  created:
    - src/server/api/routers/base.ts
    - src/server/api/routers/table.ts
    - src/server/api/routers/column.ts
    - src/server/api/routers/view.ts
  modified:
    - src/server/api/root.ts
    - package.json

key-decisions:
  - "02-01: table.create seed uses dynamic import of @faker-js/faker to avoid edge bundle bloat"
  - "02-01: @faker-js/faker moved from devDependencies to dependencies — required at runtime for table seeding"
  - "02-01: column.create uses max(columns.order) + 1 for auto-incrementing position"
  - "02-01: view.updateConfig does partial merge — undefined fields in input are not overwritten"

patterns-established:
  - "Ownership join pattern: all nested resource mutations verify via innerJoin chain before modifying"
  - "NOT_FOUND on failed ownership: single consistent error for both not-found and unauthorized access (no info leak)"

# Metrics
duration: 25min
completed: 2026-03-17
---

# Phase 2 Plan 01: CRUD Routers Summary

**Four tRPC routers (base, table, column, view) with full CRUD, ownership join chains, and faker-seeded table creation — appRouter updated, post.ts removed**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-17T05:04:25Z
- **Completed:** 2026-03-17T05:29:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Four router files implementing complete CRUD for bases, tables, columns, and views
- Every procedure uses `protectedProcedure` — all unauthenticated requests rejected with UNAUTHORIZED
- table.create seeds 3 default columns, 5 faker rows, and a Grid View when `seed: true`
- view.updateConfig performs partial merge so callers can update only the fields they care about
- 2-level and 3-level join chains enforce ownership on every nested resource operation
- Build passes clean (no type errors, no ESLint warnings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Base and table routers with ownership enforcement** - `6e7d7bd` (feat)
2. **Task 2: Column, view routers, and root router update** - `ab44c84` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `src/server/api/routers/base.ts` - Base CRUD router; ownership via `userId` filter on every operation
- `src/server/api/routers/table.ts` - Table CRUD router; ownership via `innerJoin bases`; create seeds columns, rows, view
- `src/server/api/routers/column.ts` - Column CRUD router; create auto-increments `order` via `max()`; 3-level ownership
- `src/server/api/routers/view.ts` - View CRUD router; `updateConfig` does partial JSONB merge; 3-level ownership
- `src/server/api/root.ts` - Merged appRouter with base/table/column/view; removed postRouter
- `package.json` - Moved `@faker-js/faker` from devDependencies to dependencies

## Decisions Made

- **@faker-js/faker as production dependency:** `table.create` with `seed: true` runs at runtime (server mutations), so faker must be in `dependencies` not `devDependencies`. Dynamic import (`await import("@faker-js/faker")`) keeps it out of the initial bundle but still available at runtime.
- **max() for column order:** Avoids needing a counter column or sorting on insert. Handles gaps/deletions gracefully.
- **Partial merge in updateConfig:** Grid view config has 4 fields; clients should be able to update just `searchQuery` without resetting `filters`. Object.fromEntries + filter-undefined achieves this cleanly.
- **NOT_FOUND for ownership violations:** Using NOT_FOUND (not FORBIDDEN) avoids leaking whether a resource exists for a different user — consistent with security best practices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `??` operator chain in null guard**
- **Found during:** Task 1 (table router create procedure)
- **Issue:** `!nameCol ?? !notesCol ?? !statusCol` — TypeScript error, right operands unreachable because `??` only triggers on null/undefined, but `!col` is always boolean
- **Fix:** Changed to `!nameCol || !notesCol || !statusCol`
- **Files modified:** `src/server/api/routers/table.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `6e7d7bd` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Moved @faker-js/faker to production dependencies**
- **Found during:** Task 1 (table.create with seed)
- **Issue:** faker was in devDependencies — not installed on production Vercel deployments; `await import("@faker-js/faker")` would fail in production when `seed: true`
- **Fix:** Moved to `dependencies` in package.json
- **Files modified:** `package.json`
- **Verification:** Build passes; faker available at runtime
- **Committed in:** `6e7d7bd` (Task 1 commit)

**3. [Rule 1 - Bug] Eliminated unnecessary type assertions flagged by ESLint**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `nameCol!.id`, `notesCol!.id`, `statusCol!.id` after null guard — TypeScript knows they're non-null; ESLint `@typescript-eslint/no-unnecessary-type-assertion` error. Same for `result[0]!` in view.updateConfig.
- **Fix:** Destructured into named variables after guard; used tuple cast for result[0] access
- **Files modified:** `src/server/api/routers/table.ts`, `src/server/api/routers/view.ts`
- **Verification:** `npm run build` passes with no ESLint errors
- **Committed in:** `ab44c84` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 null-check bug, 1 missing critical dependency placement, 1 type assertion cleanup)
**Impact on plan:** All fixes essential for correctness, production reliability, and build compliance. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four tRPC routers are ready for Phase 3 (Navigation Shell) to call directly from client components
- `base.getAll`, `table.getByBaseId`, `view.getByTableId` are the primary read procedures Phase 3 will use for sidebar navigation
- `table.create` (with seed) is ready for the "New Table" button interaction in Phase 3
- No blockers for Phase 3

---
*Phase: 02-data-layer*
*Completed: 2026-03-17*
