---
phase: 04-grid-core
plan: 01
subsystem: ui
tags: [tanstack-table, tanstack-virtual, trpc, react-query, virtualization, infinite-scroll, grid]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: row.getRows tRPC endpoint with cursor pagination and column.getByTableId
  - phase: 03-navigation-shell
    provides: layout shell with flex-1 scroll container for grid to fill
provides:
  - Virtualized grid rendering live DB rows with only visible rows in DOM
  - GridView client component owning data fetching (useInfiniteQuery + column query)
  - GridTable pure renderer with sticky header and translateY virtual rows
  - View page mounted to GridView (replaces Phase 3 placeholder)
affects: [04-02, 04-03, 05-cell-editing, 06-filtering-sorting]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-table@^8", "@tanstack/react-virtual@^3"]
  patterns:
    - "display:grid on table element required for sticky thead + virtual tbody to coexist"
    - "translateY absolute positioning for virtual rows (NOT spacer rows / paddingTop)"
    - "keepPreviousData imported as function from @tanstack/react-query (React Query v5 change)"
    - "cursor NOT passed in useInfiniteQuery input — tRPC auto-injects from getNextPageParam"
    - "onScroll 500px threshold for fetchNextPage (NOT IntersectionObserver)"
    - "Firefox measureElement guard via navigator.userAgent.includes check"

key-files:
  created:
    - src/components/grid/GridView.tsx
    - src/components/grid/GridTable.tsx
  modified:
    - src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx
    - package.json

key-decisions:
  - "display:grid on table element is required — standard table layout breaks sticky header when tbody has position:relative for virtual rows"
  - "translateY pattern chosen over spacer rows — spacer rows cause layout artifacts in table elements"
  - "RowData type exported from GridTable so GridView can import it (avoids duplication)"
  - "500px scroll threshold triggers fetchNextPage eagerly before user hits bottom"

patterns-established:
  - "GridView owns all data fetching; GridTable is pure rendering — clean separation of concerns"
  - "Column defs always wrapped in useMemo — new array on every render causes re-renders on scroll"
  - "manualSorting/manualFiltering/manualPagination: true — all control stays DB-side"

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 4 Plan 01: Grid Core - Virtualized Grid Foundation Summary

**Virtualized grid with sticky header rendering live DB rows via useInfiniteQuery + TanStack Table/Virtual, mounted in the view page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T08:37:26Z
- **Completed:** 2026-03-17T08:41:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed @tanstack/react-table and @tanstack/react-virtual
- GridView fetches rows via useInfiniteQuery (keepPreviousData, 500px scroll threshold) and columns via useQuery; flattens pages into flat row array
- GridTable renders virtualized rows using translateY absolute positioning with sticky header (display:grid pattern), row numbers, 180px columns, Firefox measureElement guard
- View page replaced placeholder with GridView — live grid rendering DB rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create GridView data layer** - `f5504e6` (feat)
2. **Task 2: GridTable with TanStack Table + Virtualizer and sticky header** - `efa1888` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/grid/GridView.tsx` - Client component: useInfiniteQuery for rows, useQuery for columns, memoized column defs, scroll handler
- `src/components/grid/GridTable.tsx` - Pure renderer: useReactTable (manual mode) + useVirtualizer with translateY pattern, sticky header, row numbers
- `src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx` - Server page mounting GridView, replacing Phase 3 placeholder
- `package.json` - Added @tanstack/react-table and @tanstack/react-virtual dependencies

## Decisions Made
- `RowData` type is exported from `GridTable.tsx` and imported by `GridView.tsx` — avoids duplicating the type definition across both files
- Display:grid on the `<table>` element is the only layout pattern that allows both `position:sticky` on `<thead>` and `position:relative` on `<tbody>` (required by the virtualizer) to coexist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Virtualized grid is live. Navigating to any table with seeded rows will render the grid with infinite scroll.
- Phase 04-02 can build on GridTable directly for column resizing or cell editing.
- Pre-existing ESLint warning in AppTopBar.tsx (`collapsed` unused arg) is unrelated to this plan — not a blocker.

---
*Phase: 04-grid-core*
*Completed: 2026-03-17*
