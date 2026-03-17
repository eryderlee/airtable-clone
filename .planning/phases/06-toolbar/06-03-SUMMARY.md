---
phase: "06"
plan: "03"
subsystem: "toolbar"
tags: ["search", "filter", "sort", "sql", "highlight", "gridcell", "gridheader"]

dependency-graph:
  requires: ["06-02"]
  provides: ["working filter/sort queries", "client-side search highlighting", "correct header visibility"]
  affects: []

tech-stack:
  added: []
  patterns:
    - "sql.raw() only for direction keywords, never for column IDs — UUIDs must be parameterized"
    - "flatMap() in buildFilterConditions removes undefined return type issue"
    - "cacheVersion from useReducer triggers useMemo recompute without extra state"
    - "highlightText() helper renders JSX spans inline in display mode"

key-files:
  created: []
  modified:
    - "src/server/api/routers/row.ts"
    - "src/components/grid/GridView.tsx"
    - "src/components/grid/GridTable.tsx"
    - "src/components/grid/GridToolbar.tsx"
    - "src/components/grid/toolbar/SearchBar.tsx"
    - "src/components/grid/GridCell.tsx"

decisions:
  - id: "06-03-a"
    decision: "sql.raw(columnId) in buildFilterConditions/buildSortOrder embeds UUID without quotes — invalid SQL (cells->>UUID). Fixed by using columnId directly in SQL template (parameterized: cells->>$1)"
  - id: "06-03-b"
    decision: "Search changed to client-side highlight mode — rows are not hidden, matching cells get yellow highlight, navigation via prev/next arrows in search bar. searchQuery removed from row.count and getByOffset calls."
  - id: "06-03-c"
    decision: "GridHeader hidden column fix — table.getHeaderGroups()[0]?.headers returns all columns; must filter by columnIds (visibleColumnIds from GridView) before passing to GridHeader"

metrics:
  duration: "~15 min"
  completed: "2026-03-18"
---

# Phase 6 Plan 3: Toolbar Bug Fixes Summary

**One-liner:** SQL parameterization for filter/sort UUIDs, client-side search highlight with prev/next navigation, hidden-column header filtering.

## What Was Built

Four bugs in the grid toolbar fixed, all shipped in one atomic commit (`feddc76`).

## Bug 1 — Filter/Sort SQL Parameterization

`buildFilterConditions` and `buildSortOrder` used `sql.raw(columnId)` to embed the column UUID directly into the SQL template string. PostgreSQL's `->>` operator requires the key on the right-hand side to be a string literal or parameter — embedding a bare UUID like `cells->>550e8400-e29b-41d4-a716-446655440000` is invalid SQL and causes a server error.

Fix: removed `const colKey = sql.raw(...)` and replaced `${colKey}` with `${f.columnId}` / `${s.columnId}` directly in the template. Drizzle parameterizes these as `$1`, `$2`, etc., which PostgreSQL handles correctly.

Also changed `buildFilterConditions` from `.map()` to `.flatMap()` — each branch now returns an array, removing the `undefined` inference issue from switch fallthrough.

Fixed tie-breakers in `buildSortOrder`: replaced `asc(rows.rowOrder) as unknown as SQL` with `sql\`"row_order" ASC\`` (same for `id`), eliminating the fragile type cast.

## Bug 2 — Search Highlight Mode

Previously `searchQuery` was passed to `row.count` and `getByOffset`, which caused the server to filter out non-matching rows entirely — effectively hiding them. The correct Airtable behavior is to keep all rows visible and highlight matching cells.

Changes:
- Removed `searchQuery` from `row.count` query (count now reflects only filter state)
- Removed `searchQuery` from `getByOffset` fetch and `fetchPage` deps
- Removed `searchQuery` from cache-reset effect deps
- Changed `useReducer` to expose `cacheVersion` (was `[, forceUpdate]`)
- Added `searchMatches` useMemo over `pageCacheRef.current` — scans loaded pages client-side, returns `{ rowIndex, columnId }[]` sorted by row index
- Added `searchMatchIndex` state, `handlePrevMatch`, `handleNextMatch` callbacks
- Added scroll-to-match effect keyed on `searchMatchIndex`
- Passed new props down through `GridToolbar` -> `SearchBar` and `GridView` -> `GridTable` -> `GridCell`

## Bug 3 — Hidden Columns Still Showed in Header

`table.getHeaderGroups()[0]?.headers` (TanStack Table) returns ALL column headers regardless of visibility, because the TanStack Table instance always has all `columnDefs`. The body rows correctly showed only visible columns because `GridView` passes `visibleColumnIds` as `columnIds`. But the header was not filtered.

Fix: filter headers by `columnIds.includes(h.id)` before passing to `GridHeader`.

## Bug 4 — SearchBar Navigation + GridCell Highlighting

`SearchBar` updated with:
- `matchCount`, `currentMatchIndex`, `onPrevMatch`, `onNextMatch` props
- Match count display: "N of M" when matches exist, "No matches" when query has no hits
- Prev (up arrow) and Next (down arrow) buttons, disabled when `matchCount === 0`

`GridCell` updated with:
- `searchQuery?: string` prop
- `highlightText(text, query)` helper that splits text around the match and wraps the matching substring in `<span className="bg-yellow-200">`
- Display span uses `highlightText` when `searchQuery` is set and `value` is non-null

## Deviations from Plan

None — all four bugs fixed exactly as specified.

## Verification

- `npx tsc --noEmit` — passed (zero errors)
- `npm run build` — passed (first attempt had two lint errors: unnecessary `!` assertion and eslint-disable needed for `cacheVersion` in useMemo; both fixed before final build)

## Next Phase Readiness

Phase 6 is complete. Phase 7 (view config persistence / column resizing) can proceed.
