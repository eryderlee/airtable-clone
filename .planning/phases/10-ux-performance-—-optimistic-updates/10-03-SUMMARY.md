---
phase: 10-ux-performance-—-optimistic-updates
plan: "03"
subsystem: ui
tags: [react, trpc, tanstack-query, optimistic-updates, sonner, column-crud, prefetch]

requires:
  - phase: 10-01
    provides: sonner installed and Toaster mounted in root layout
  - phase: 10-02
    provides: optimistic pattern established (cancel → snapshot → setData → rollback) for tables and views

provides:
  - Optimistic create/rename/delete for columns in GridView with snapshot rollback
  - Column delete also clears pageCacheRef cell data optimistically with rollback
  - Hover prefetch on ViewsPanel view items for instant view switching
  - Human-verified complete optimistic UX across bases, tables, views, and columns

affects:
  - Future grid work — pageCacheRef rollback pattern now established for column mutations

tech-stack:
  added: []
  patterns:
    - "Column delete optimistic: pageCacheRef cells removed per-column across all cached pages, with full snapshot rollback"
    - "Hover prefetch: onMouseEnter calls utils.column.getByTableId.prefetch + utils.row.count.prefetch silently"
    - "forceUpdate() called after pageCacheRef mutation to trigger re-render"

key-files:
  created: []
  modified:
    - src/components/grid/GridView.tsx
    - src/components/nav/ViewsPanel.tsx

key-decisions:
  - "Column delete clears pageCacheRef cell data immediately (optimistic) and restores via prevPageCache snapshot on error"
  - "Only columns and row count are prefetched on hover — row data pages are not (virtualizer loads on demand)"
  - "Post-checkpoint orchestrator fixes: filter/sort race condition (generation counter), column order on add, rename flicker, table tab loading cursor, navigation guard for optimistic tab IDs"

patterns-established:
  - "pageCacheRef rollback: snapshot entire cache before mutation, restore on onError"
  - "Prefetch on hover: silent prefetch warms cache before user clicks — no loading flash"

duration: ~25min (including checkpoint + orchestrator post-fixes)
completed: 2026-03-18
---

# Phase 10 Plan 03: Optimistic Column CRUD and View Hover Prefetch Summary

**GridView column create/rename/delete are now fully optimistic with pageCacheRef rollback; ViewsPanel hover prefetch eliminates loading flash on view switch — human-verified across all 12 optimistic mutations**

## Performance

- **Duration:** ~25 min (including human verification checkpoint and post-checkpoint orchestrator fixes)
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:25:00Z
- **Tasks:** 2 (+ checkpoint)
- **Files modified:** 2

## Accomplishments

- All three column mutations (create, rename, delete) in GridView use optimistic updates with snapshot/rollback and sonner error toasts
- Column delete additionally strips the deleted column's cell data from every cached page in pageCacheRef, with full rollback on error
- Column rename rollback was previously missing (onError not wired) — now fixed
- ViewsPanel prefetches column and row count on view hover so grid renders from cache on click
- Human verified the complete optimistic UX across bases, tables, views, and columns — approved

## Task Commits

1. **Task 1: Optimistic column mutations in GridView** - `4400f8a` (feat)
2. **Task 2: Hover prefetch in ViewsPanel** - `861f9e4` (feat)

**Post-checkpoint orchestrator fixes (not counted as plan tasks):**
- `0c61b04` fix(10-02): block navigation on optimistic table tabs (prevent invalid UUID routing)
- `613a325` fix(10): table tab loading cursor, delete-stays-on-table, hover prefetch refinements
- `69be5ee` fix(10): filter/sort race condition via generation counter, column order on add, rename flicker

## Files Created/Modified

- `src/components/grid/GridView.tsx` — createColumn/renameColumn/deleteColumn all use onMutate snapshot pattern; deleteColumn also manages pageCacheRef
- `src/components/nav/ViewsPanel.tsx` — onMouseEnter on each view item prefetches column + count data

## Decisions Made

- **pageCacheRef rollback for column delete:** When a column is deleted optimistically, cell data for that column is stripped from all cached pages immediately. On error, the full previous page cache is restored from snapshot and forceUpdate() is called.
- **Prefetch scope limited to columns + count:** Row data pages are not prefetched on hover — they load on demand via the virtualizer, which is already fast. Prefetching row pages would be premature and wasteful for large tables.
- **Post-checkpoint orchestrator fixes:** After human approval, the orchestrator fixed several related issues: a filter/sort race condition (resolved via generation counter), incorrect column order on add, rename flicker, table tab loading cursor state, and navigation guard that prevented routing to optimistic (non-UUID) table tab IDs.

## Deviations from Plan

None — plan executed exactly as written. Post-checkpoint fixes were orchestrator-level corrections to related issues discovered during human verification, not unplanned scope from this plan's tasks.

## Issues Encountered

- Column rename previously lacked an `onError` handler — the plan explicitly called this out and it was added as part of Task 1.
- Post-verification: filter/sort panel had a race condition when rapidly toggling — fixed by the orchestrator with a generation counter pattern in GridView.

## Authentication Gates

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 10 (UX Performance) is fully complete — all 30 plans across 10 phases are done
- All 12 optimistic mutations are wired and human-verified (3 base, 3 table, 3 view, 3 column)
- The app is live on Neon + Vercel and production-verified
- No remaining blockers

---
*Phase: 10-ux-performance-—-optimistic-updates*
*Completed: 2026-03-18*
