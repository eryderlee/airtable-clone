---
plan: 11-01
phase: 11-instant-interactions
status: complete
---

# Phase 11 Plan 01: Navigation Fixes and View Stability Summary

## What Was Built

- **BaseSidebar.tsx**: Removed `router.refresh()` from logo button click handler. Logo now calls `router.push("/")` only, eliminating the SSR re-render that previously blocked instant home navigation.
- **view.ts**: Added `.orderBy(asc(views.id))` to `getByTableId` query and imported `asc` from `drizzle-orm`. Views now return in creation order (deterministic) instead of undefined database ordering, preventing sidebar reorder after cache invalidation.
- **TableTabBar.tsx**: Replaced `<Link href>` in `TableTab` with a cache-first `handleTabClick` function. On click, reads `utils.view.getByTableId.getData()` synchronously; if cached views exist navigates immediately; otherwise fetches then navigates. Removes `Link` import entirely.
- **TableTabBar.tsx**: Updated `createTable.onMutate` to call `setNavigatingTo(optimisticId)` immediately, making the new tab visually active before server confirms. Updated `onSuccess` to replace the optimistic cache entry with the real table ID before pushing to the view URL.

## Commits

- `0a305ee`: fix(11-01): home navigation and view ordering
- `1d58bf6`: feat(11-01): cache-first table tab switching and immediate new table navigation

## Deviations

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing ESLint error in GridView.tsx blocking build**

- **Found during:** Task 1 build verification
- **Issue:** `cells as Record<string, string | number | null>` at line 589 triggered `@typescript-eslint/non-nullable-type-assertion-style` error. The working directory already had a fix (`cells ?? {}`) from a prior uncommitted session change.
- **Fix:** The working-directory fix was already present; build succeeded once `.next` cache was cleared.
- **Files modified:** `src/components/grid/GridView.tsx` (pre-existing uncommitted fix, not staged)
- **Commit:** n/a (working tree fix, not introduced by this plan)

**2. [Rule 1 - Bug] onNavigate prop became unused after Link replacement**

- **Found during:** Task 2 build
- **Issue:** `onNavigate` prop was kept in `TableTab` interface after replacing `<Link onClick={onNavigate}>` with `<button onClick={onTabClick}>`, causing ESLint `no-unused-vars` warning.
- **Fix:** Removed `onNavigate` from `TableTab` props entirely; `setNavigatingTo` is called in the `onTabClick` handler passed from the parent instead.
- **Files modified:** `src/components/nav/TableTabBar.tsx`
- **Commit:** included in `1d58bf6`

## Issues

- Windows filesystem rename collisions in `.next/` during build (cache corruption from partial prior build). Resolved by running `next build` again which rebuilt from scratch.
- Pre-existing ESLint warnings remain in `FilterPanel.tsx` (`onClose` unused) and `ViewsPanel.tsx` (`Link` unused) — these are warnings not errors and were present before this plan.
