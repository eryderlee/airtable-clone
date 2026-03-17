---
phase: 04-grid-core
plan: 02
subsystem: ui
tags: [react, tanstack-table, trpc, tanstack-query, grid, column-management]

# Dependency graph
requires:
  - phase: 04-01
    provides: GridView + GridTable virtualized infinite scroll grid

provides:
  - GridHeader component with InlineEdit rename, hover delete, and add column dropdown
  - GridToolbar component with Add 100k rows bulk insert button, loading state, row count
  - Column create/rename/delete mutations wired in GridView via api.useUtils()
  - Bulk row insert (100k) wired in GridView with cache invalidation

affects: [04-03, phase-05-cell-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "api.useUtils() for tRPC cache invalidation (NOT useContext)"
    - "useCallback for mutation handler stability in React"
    - "group/group-hover Tailwind pattern for conditional hover UI in column headers"

key-files:
  created:
    - src/components/grid/GridHeader.tsx
    - src/components/grid/GridToolbar.tsx
  modified:
    - src/components/grid/GridTable.tsx
    - src/components/grid/GridView.tsx

key-decisions:
  - "GridHeader uses header.id as fallback when columnDef.header is not a string — avoids unsafe toString() ESLint error"
  - "Bulk create invalidates row.getRows; column delete invalidates both column.getByTableId and row.getRows"
  - "window.confirm() used for delete confirmation — no custom modal needed at this stage"

patterns-established:
  - "GridHeader: standalone thead component accepting Header[] and column management callbacks"
  - "GridToolbar: stateless toolbar receiving callbacks and derived state from parent"
  - "Column mutations placed in GridView (top of tree) so all callbacks are stable references passed down"

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 4 Plan 02: Column Management UI and Bulk Insert Summary

**Column add/rename/delete UI in grid header plus 100k-row bulk insert toolbar, wired via tRPC mutations with api.useUtils() cache invalidation**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T08:45:03Z
- **Completed:** 2026-03-17T08:50:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created GridHeader with InlineEdit double-click rename, hover × delete button, and AddColumnMenu (+) dropdown for Text/Number column types
- Created GridToolbar with "Add 100k rows" button showing "Inserting..." during pending state and live row count display
- Wired all column mutations (create, update, delete) and bulk row create in GridView using api.useUtils() for cache invalidation
- Build passes clean with zero TypeScript or ESLint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: GridHeader with column rename, delete, and add column** - `00e6e73` (feat)
2. **Task 2: GridToolbar with bulk insert and wire mutations in GridView** - `2a82594` (feat)

**Plan metadata:** (to be committed with this summary)

## Files Created/Modified

- `src/components/grid/GridHeader.tsx` - Standalone thead component: InlineEdit per column, hover delete ×, AddColumnMenu + dropdown
- `src/components/grid/GridToolbar.tsx` - Stateless toolbar with bulk insert button, loading state, row count display
- `src/components/grid/GridTable.tsx` - Added GridHeader import, onRenameColumn/onDeleteColumn/onAddColumn props, replaced inline thead
- `src/components/grid/GridView.tsx` - Added utils = api.useUtils(), all column/row mutations, useCallback handlers, GridToolbar render

## Decisions Made

- **GridHeader header name extraction:** `typeof header.column.columnDef.header === "string" ? ... : header.id` — the `flexRender(...).toString()` approach triggers `@typescript-eslint/no-base-to-string` ESLint error (object could render as `[object Object]`). Using `header.id` fallback is correct because all columns in this codebase use string headers from `col.name`.
- **Mutation placement in GridView:** Column mutations live at the GridView level (not GridHeader/GridToolbar) so callback refs are stable and passed down as props — avoids mutation hooks being called inside list renders.
- **window.confirm for delete:** Simple browser confirm dialog used — no custom modal needed in phase 4. Can be upgraded in a later phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unsafe `flexRender().toString()` in GridHeader header name extraction**

- **Found during:** Task 1 build verification
- **Issue:** `flexRender(header.column.columnDef.header, header.getContext())?.toString()` triggers `@typescript-eslint/no-base-to-string` ESLint error — the return value could be a React element that stringifies to `[object Object]`
- **Fix:** Replaced with `header.id` as the non-string fallback. All current column defs use string headers so this is functionally equivalent.
- **Files modified:** src/components/grid/GridHeader.tsx
- **Verification:** `npm run build` passes with zero errors
- **Committed in:** 2a82594 (Task 2 commit — fix applied during same session)

---

**Total deviations:** 1 auto-fixed (1 bug — unsafe toString on flexRender result)
**Impact on plan:** Fix required for build to pass. No scope creep.

## Issues Encountered

None beyond the flexRender ESLint error described above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Column management UI complete: add Text/Number, rename via double-click, delete with confirm
- Bulk insert (100k rows) working with loading state and row count display
- Ready for 04-03: cell editing (clicking a cell to edit its value inline)
- Concern: InlineEdit in GridHeader is activated on double-click; if cell editing also uses double-click, the interaction model needs to be consistent (address in 04-03)

---
*Phase: 04-grid-core*
*Completed: 2026-03-17*
