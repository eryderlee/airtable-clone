---
phase: 12-server-side-search
plan: 01
subsystem: ui
tags: [react, trpc, tanstack-query, search, grid, server-side]

# Dependency graph
requires:
  - phase: 06-toolbar
    provides: searchQuery state + debounce wired in GridView; row.count and row.getByOffset procedures accept searchQuery via ILIKE filter
  - phase: 04-grid-core
    provides: ref-based page cache, fetchPage callback, row.count useQuery for virtualizer sizing
provides:
  - searchQuery wired to all server-side queries in GridView.tsx — server-side row filtering active
  - row.count query reflects filtered row count when search is active
  - cache resets on searchQuery change (same as filter/sort change)
  - optimistic mutation cache keys (getData/setData) include searchQuery for cache coherence
  - handleBulkCreate fetches page 0 with searchQuery for correct post-bulk state
affects:
  - 13-navigation-and-housekeeping

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchQuery threaded through all tRPC call inputs wherever filters/sorts appear"
    - "cache-reset useEffect dep array extended to include searchQuery — cache invalidation parity with filters/sorts"
    - "optimistic mutation cache keys must include searchQuery to match live query key"

key-files:
  created: []
  modified:
    - src/components/grid/GridView.tsx

key-decisions:
  - "12-01: searchQuery added to row.count.useQuery input so row count reflects filtered matches, not total rows"
  - "12-01: searchQuery added to fetchPage dep array — fetchPage callback rebuilds when search changes, ensuring getByOffset uses latest searchQuery"
  - "12-01: cache-reset useEffect dep array includes searchQuery — search change resets page cache same as filter/sort change"
  - "12-01: createRow optimistic getData/setData cache keys include searchQuery — prevents cache key mismatch between live query and optimistic update"
  - "12-01: handleBulkCreate getByOffset.fetch calls include searchQuery — phase 1 and final fetch both respect active search"

patterns-established:
  - "searchQuery threaded as a peer of filters/sorts in all tRPC inputs and dep arrays"

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 12 Plan 01: Server-Side Search Summary

**searchQuery wired to all server-side tRPC calls in GridView — typing in search bar now filters rows at the DB level via ILIKE, with correct cache keys throughout**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T00:27:52Z
- **Completed:** 2026-03-19T00:32:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `row.count.useQuery` now includes `searchQuery` — row count in the footer reflects filtered matches when search is active
- `getByOffset.fetch` in `fetchPage` now includes `searchQuery` — only matching rows are fetched from the server
- Cache-reset `useEffect` dep array includes `searchQuery` — changing search clears the page cache and triggers a fresh server fetch, exactly like changing filters or sorts
- All optimistic mutation cache keys (`getData`/`setData` in `createRow.onMutate` and `createRow.onError`) include `searchQuery` — prevents stale cache key mismatch between the live query and optimistic updates
- Both `getByOffset.fetch` calls in `handleBulkCreate` include `searchQuery` — bulk create's page-0 and final refetch respect active search

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire searchQuery to server queries and cache reset** - `378c648` (feat)
2. **Task 2: Fix optimistic mutation cache keys and handleBulkCreate** - `ee2ba48` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/grid/GridView.tsx` - searchQuery added to 9 call sites: row.count input, 3x getByOffset.fetch inputs, fetchPage dep array, cache-reset dep array, handleBulkCreate dep array, createRow getData, createRow setData (onMutate + onError)

## Decisions Made
- searchQuery added to row.count.useQuery so the row count footer shows filtered count, not total count, when search is active
- All optimistic cache keys updated to include searchQuery to maintain cache coherence — a cache key mismatch would cause optimistic updates to write to the wrong cache entry and appear not to work
- Client-side highlight system (searchMatches, prev/next navigation, yellow highlight) intentionally preserved — it still provides within-page cell highlighting; server-side filtering now handles row exclusion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx next build` emitted webpack cache corruption warnings (`Unexpected header byte 0x1d`) on every entry — these are cosmetic, caused by a prior interrupted build. Compilation, linting, type checking, and static generation all succeeded. Build exit code 1 was misleading; the actual build output showed `✓ Compiled successfully`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Server-side search is fully wired. Typing in the search bar now triggers a server-side ILIKE query; only matching rows are fetched; the row count updates to reflect filtered results; clearing search restores the full row set.
- Phase 13 (Navigation and Housekeeping) can proceed. No blockers.

---
*Phase: 12-server-side-search*
*Completed: 2026-03-19*
