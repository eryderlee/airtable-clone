---
phase: 06-toolbar
plan: 01
subsystem: api, ui
tags: [trpc, drizzle, react, filter, sort, search, virtual-scroll, pagination]

requires:
  - phase: 04-grid-core
    provides: "ref-based page cache with getByOffset; row.count drives virtualizer height"
  - phase: 05-cell-editing
    provides: "cursor/editingCell state in GridView; pageCacheRef optimistic mutation"

provides:
  - "getByOffset accepts filters, sorts, searchQuery — fast path preserved for unfiltered queries"
  - "row.count accepts filters and searchQuery — virtualizer height reflects filtered row count"
  - "GridView holds all toolbar state: filters, sorts, searchInput, searchQuery, hiddenColumns, openPanel"
  - "fetchPage passes filter/sort/search to getByOffset; cache resets on state change"
  - "visibleColumnIds drives both GridTable rendering and keyboard nav (no hidden column cursor stops)"
  - "GridToolbar wired: Hide fields/Filter/Sort/Search buttons toggle openPanel; badges show active count"

affects:
  - "06-02-PLAN: FilterPanel/SortPanel/HideFieldsPanel UI panels — state setters already wired in GridToolbar"
  - "06-03-PLAN: View config persistence for filters/sorts/hiddenColumns"

tech-stack:
  added: []
  patterns:
    - "Two-path getByOffset: fast rowOrder seek when no filters/sorts/search; SQL OFFSET when active"
    - "Toolbar state in GridView as useState; reset cache useEffect skips first render via isFirstRender ref"
    - "300ms debounce: searchInput -> searchQuery via useEffect/setTimeout (no library)"
    - "visibleColumnIds = columnIds.filter(not hidden); columnOrder = visibleColumnIds for keyboard nav"

key-files:
  created: []
  modified:
    - src/server/api/routers/row.ts
    - src/components/grid/GridView.tsx
    - src/components/grid/GridToolbar.tsx

key-decisions:
  - "Two-path strategy in getByOffset: rowOrder >= offset seek (O(log n)) when no filters/sorts/search; SQL OFFSET when active — acceptable O(n) trade-off for Phase 6 filtered queries"
  - "count procedure only accepts filters and searchQuery, not sorts — sorts don't affect count"
  - "openPanel state lives in GridView, not GridToolbar — all toolbar-related state co-located"
  - "isFirstRender ref guards cache-reset useEffect — prevents spurious reset on mount before data arrives"
  - "columnOrder assigned from visibleColumnIds (not a useMemo) — hidden column IDs excluded from keyboard nav index math"

patterns-established:
  - "Two-path getByOffset: check isFastPath = sorts.length === 0 && filters.length === 0 && !searchQuery.trim()"
  - "Cache invalidation on toolbar state change: resetCache() + refetchCount(), then totalCount effect re-triggers fetchPage(0)"

duration: 8min
completed: 2026-03-17
---

# Phase 6 Plan 1: Toolbar Data Foundation Summary

**getByOffset and row.count extended with filter/sort/search params; GridView holds full toolbar state with debounced search, cache invalidation on state change, and visibleColumnIds-based keyboard nav**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T12:50:25Z
- **Completed:** 2026-03-17T12:58:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `getByOffset` with two-path strategy: existing rowOrder seek preserved for unfiltered queries; SQL OFFSET used when filters/sorts/search are active
- Extended `row.count` to accept filters and searchQuery so virtualizer height reflects the filtered row count, not the total
- Added all toolbar state (filters, sorts, searchInput/searchQuery, hiddenColumns, openPanel) to GridView with proper cache invalidation on any state change
- Wired GridToolbar buttons (Hide fields, Filter, Sort, Search) to toggle openPanel; badges show active condition counts; search bar renders inline

## Task Commits

1. **Task 1: Extend getByOffset and count with filter/sort/search params** - `67575fa` (feat)
2. **Task 2: Add toolbar state to GridView with cache invalidation** - `07933b1` (feat)

## Files Created/Modified
- `src/server/api/routers/row.ts` - getByOffset: two-path filter/sort/search; count: dynamic WHERE with filters/searchQuery
- `src/components/grid/GridView.tsx` - toolbar state, debounce, resetCache, cache-reset effect, visibleColumnIds, updated fetchPage/count calls
- `src/components/grid/GridToolbar.tsx` - extended props interface; wired buttons to setOpenPanel; badge counts; inline search bar

## Decisions Made
- Two-path strategy in getByOffset: isFastPath = no filters + no sorts + no search uses rowOrder seek; otherwise SQL OFFSET. Acceptable O(n) trade-off for filtered/sorted queries in Phase 6.
- count only needs filters and searchQuery, not sorts — sorts don't change the row count.
- openPanel state lives in GridView alongside filters/sorts/search state — all toolbar state co-located.
- isFirstRender ref prevents cache reset on mount — without it, every GridView mount would double-fetch page 0.
- columnOrder is assigned directly from visibleColumnIds (not a separate useMemo) to keep hidden columns out of arrow-key/Tab index math.

## Deviations from Plan

None — plan executed exactly as written. The toolbar state ordering (moving toolbar useState declarations before the count useQuery) was a necessary fix to avoid temporal dead zone (cannot reference `filters` before initialization), handled inline without impacting plan scope.

## Issues Encountered
- `filters` and `searchQuery` state were initially placed after the `api.row.count.useQuery` call that references them, causing a temporal dead zone. Resolved by moving all toolbar useState declarations before the count query — same render hook order, just reordered declarations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend params accepted; all frontend state wired — Plan 06-02 can immediately implement FilterPanel, SortPanel, and HideFieldsPanel UI since `setFilters`, `setSorts`, `setHiddenColumns`, and `columnsData` are already passed to GridToolbar
- Plan 06-03 can add view config persistence for filters/sorts/hiddenColumns via `api.view.updateConfig`
- No blockers

---
*Phase: 06-toolbar*
*Completed: 2026-03-17*
