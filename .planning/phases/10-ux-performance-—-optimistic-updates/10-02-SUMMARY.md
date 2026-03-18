---
phase: 10-ux-performance-—-optimistic-updates
plan: "02"
subsystem: ui
tags: [react, trpc, tanstack-query, optimistic-updates, sonner, navigation]

requires:
  - phase: 10-01
    provides: sonner installed and Toaster mounted in root layout

provides:
  - Optimistic create/rename/delete for tables in TableTabBar with snapshot rollback
  - Optimistic create/rename/delete for views in ViewsPanel with snapshot rollback
  - Error toast notifications via sonner for all six mutation failures

affects:
  - 10-03 (row mutations — same onMutate/onError/onSettled pattern)

tech-stack:
  added: []
  patterns:
    - "Optimistic mutation: cancel → snapshot → setData in onMutate; restore in onError; invalidate in onSettled"
    - "Optimistic view object must match exact DB schema shape (no extra fields like updatedAt)"
    - "deleteView reads getData() in onSuccess (not fetch) because cache already updated by onMutate"

key-files:
  created: []
  modified:
    - src/components/nav/TableTabBar.tsx
    - src/components/nav/ViewsPanel.tsx

key-decisions:
  - "tables schema has no updatedAt — optimistic table object omits it (id, name, baseId, createdAt only)"
  - "views schema has no createdAt/updatedAt — optimistic view object only has id, name, tableId, config"
  - "deleteView onSuccess reads getData() directly instead of fetch() — cache already reflects deletion from onMutate"
  - "URL pattern confirmed: /base/${baseId}/${tableId}/view/${viewId} (with /view/ segment)"
  - "createTable onMutate uses mutBaseId local alias to avoid closure over stale baseId prop"

patterns-established:
  - "Optimistic pattern: utils.X.cancel → getData snapshot → setData optimistic → return {previous}"
  - "Error toast via toast.error() from sonner on every mutation failure"
  - "Navigation in onSuccess (not onMutate) — wait for real server ID before pushing route"

duration: 18min
completed: 2026-03-18
---

# Phase 10 Plan 02: Optimistic Table and View Mutations Summary

**TableTabBar and ViewsPanel with instant create/rename/delete via TanStack Query onMutate/onError/onSettled pattern, sonner error toasts, and rollback on server failure**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All three table mutations (create, rename, delete) in TableTabBar are now optimistic with snapshot/rollback
- All three view mutations (create, rename, delete) in ViewsPanel are now optimistic with snapshot/rollback
- Error toasts appear via sonner when any mutation fails; UI reverts to previous state
- Removed stale `router.refresh()` call from deleteTable
- Navigation flows preserved: create navigates to real server-confirmed ID; delete navigates to next available item

## Task Commits

1. **Task 1: Add optimistic updates to table mutations in TableTabBar** - `7cb6bb3` (feat)
2. **Task 2: Add optimistic updates to view mutations in ViewsPanel** - `501006f` (feat)

**Plan metadata:** (see final commit in docs)

## Files Created/Modified

- `src/components/nav/TableTabBar.tsx` — createTable/renameTable/deleteTable all use onMutate snapshot pattern
- `src/components/nav/ViewsPanel.tsx` — createView/renameView/deleteView all use onMutate snapshot pattern

## Decisions Made

- **Type alignment for optimistic table objects:** The `tables` schema has no `updatedAt` field. Optimistic entries use `{ id, name, baseId, createdAt }` only.
- **Type alignment for optimistic view objects:** The `views` schema has no `createdAt` or `updatedAt`. Optimistic entries use `{ id, name, tableId, config }` only.
- **deleteView onSuccess reads cache directly:** Since `onMutate` already removed the deleted view from cache, `onSuccess` reads `utils.view.getByTableId.getData()` to find the first remaining view instead of re-fetching.
- **URL pattern:** `/base/${baseId}/${tableId}/view/${viewId}` (confirmed from existing router.push calls — includes `/view/` segment).
- **createTable uses `mutBaseId` alias:** Avoids closure over the `baseId` prop in `onMutate`'s `onError`/`onSettled` handlers, which receive the mutation variables directly.

## Deviations from Plan

None — plan executed exactly as written. The optimistic view object shape in the plan included `createdAt` and `updatedAt` fields which don't exist in the DB schema, but this was caught during implementation and the correct minimal shape was used instead.

## Issues Encountered

- Windows `.next` build cache produced intermittent `PageNotFoundError` (different page each run). Resolved by deleting `.next` and rebuilding — clean build passes consistently. This is a Windows file-system race condition in Next.js's webpack cache, not a code issue.

## Next Phase Readiness

- TableTabBar and ViewsPanel feel instant for all CRUD operations
- Error rollback is wired for all 6 mutations
- Plan 10-03 (row optimistic updates) can proceed; same onMutate/onError/onSettled pattern established here applies

---
*Phase: 10-ux-performance-—-optimistic-updates*
*Completed: 2026-03-18*
