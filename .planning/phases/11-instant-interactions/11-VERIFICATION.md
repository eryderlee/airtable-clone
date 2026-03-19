---
phase: 11-instant-interactions
status: gaps_found
---

# Verification: Phase 11 — Instant Interactions

## Must-Have Results

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Cold start: prefetch mitigates double-wait | ✓ | `AppShell.tsx:35-37` — `useEffect(() => { void utils.base.getAll.prefetch(); }, [utils])` on mount |
| 2 | Adding a table shows tab immediately; data loads after | ✓ | `TableTabBar.tsx:60-73` — `createTable.onMutate` inserts optimistic tab with `setNavigatingTo(optimisticId)` before server responds |
| 3 | Switching tables navigates instantly; grid content loads in background | ? | `TableTabBar.tsx:154-166` — `handleTabClick` uses cached views for instant push, but falls back to `await utils.view.getByTableId.fetch()` which adds latency on cache miss |
| 4 | Creating a new grid view adds it and switches instantly | ✓ | `ViewsPanel.tsx:178-207` — `createView.onMutate` adds optimistic view entry to cache; `onSuccess` calls `router.push` to navigate |
| 5 | No active-view highlight loss after creating a view | ✓ | `ViewsPanel.tsx:170,335` — `pendingViewId` state; `isActive = view.id === activeViewId \|\| view.id === pendingViewId` |
| 6 | View order in sidebar is stable | ✓ | `view.ts:33` — `.orderBy(asc(views.id))` enforces creation order on every fetch |
| 7 | Adding a new row appears immediately | ✓ | `GridView.tsx:582-640` — full optimistic pattern: `onMutate` inserts row into `pageCacheRef`, bumps count, scrolls/focuses; `onError` rolls back |
| 8 | Navigating home is instant | ✓ | `BaseSidebar.tsx:41` — logo button calls `router.push("/")` only; `router.refresh()` was removed in plan 11-01 |
| 9 | Creating a base does not flash home page with new card | ✓ | `AppShell.tsx:59-70` — `createBase.onMutate` only closes modal; `base.getAll` is NOT updated or invalidated until `createTable.onSettled` after navigation |
| 10 | Creating a base is visually instant | ✓ | `AppShell.tsx:60-62` — modal closes in `onMutate` (synchronous, before server confirms) |
| 11 | Opening a base navigates immediately on click | ✗ | `HomeContent.tsx:106-133` — cache-first path navigates instantly when tables+views are cached, but fallback path `await fetch(tables)` then `await fetch(views)` blocks navigation until both requests complete |
| 12 | All interactive buttons respond with immediate UI change | ? | Create/delete/switch all have optimistic `onMutate` patterns. Visually instant for most paths. Must-have 11 fallback is the one remaining synchronous wait before navigation. Human testing needed for button feel. |

**Score:** 9/12 criteria fully verified; 1 gap (criterion 11 cold-path); 2 require human confirmation

---

## Gaps

### Gap 1: Opening a base on cold path blocks navigation (Must-Have 11)

`HomeContent.tsx:106-133` — `handleBaseClick` checks the React Query cache first. If tables and views are cached (warm load), `router.push` fires immediately — this path is instant.

On a cold load (first visit, or after React Query cache has expired), the cache check fails and the function falls back to:

```
const fetchedTables = await utils.table.getByBaseId.fetch({ baseId });
// ... then
const fetchedViews = await utils.view.getByTableId.fetch({ tableId: fetchedTables[0].id });
router.push(...);
```

Two sequential server round-trips complete before the URL changes. The user clicks the base card and sees no transition until both fetches resolve. This directly contradicts must-have 11: "navigates immediately to the first table on click; grid loads data in the background."

The `AppShell.tsx` prefetch only fetches `base.getAll` (the list of bases), not the tables or views within each base. So the prefetch does not warm the cache path that `handleBaseClick` depends on.

**What is missing:** Either (a) navigate to `/base/${baseId}` immediately and let the SSR route redirect handle the table/view lookup server-side, or (b) prefetch `table.getByBaseId` and `view.getByTableId` for visible bases on hover/mount so the cache is warm before click.

---

## Human Verification Items

Items that cannot be verified from code alone (require browser testing):

### 1. Table tab switch — cache-miss latency

**Test:** Open a base for the first time (no prior navigation in the session). Click between table tabs rapidly.
**Expected:** Each tab click shows the new tab as active immediately; the grid content area loads in after the switch, not before.
**Why human:** The `handleTabClick` fallback awaits `utils.view.getByTableId.fetch()` before pushing the route. Whether this feels instant depends on network speed — on a fast connection it may be imperceptible, but on a slow connection (or cold Neon DB) it will produce a visible delay before the URL changes.

### 2. View creation active highlight continuity

**Test:** Create a new grid view. Watch the views panel during the creation.
**Expected:** The new view row appears in the list and is highlighted blue immediately. The highlight must not flash off and back on as the server confirms.
**Why human:** The `pendingViewId` mechanism is correctly wired in code, but the transition from `pendingViewId` active to `activeViewId` active depends on router navigation timing. A race between `onSuccess` (which calls `router.push`) and the `useEffect` clearing `pendingViewId` could produce a brief de-highlight.

### 3. Base creation — no home page flash

**Test:** On the home page, click "Create base" via the AppShell modal ("Build an app on your own"). Watch carefully for any flash of the home page with a new base card during the transition.
**Expected:** Modal closes instantly. Screen transitions directly to the new base. Home page is never shown again during this flow.
**Why human:** The code correctly avoids updating `base.getAll` in `onMutate` and only invalidates in `onSettled` after navigation. But Next.js router state and React Query cache interaction can cause a brief re-render of the home page during navigation in practice.

### 4. Row addition scroll and focus

**Test:** In a grid with many rows, click the "+" Add row button.
**Expected:** New row appears at the bottom immediately, grid scrolls to it, and the primary cell is in edit mode — all before server confirms.
**Why human:** The `requestAnimationFrame` scroll/focus in `createRow.onMutate` can be observed only in browser.

---

## Summary

Phase 11 successfully implemented the core optimistic-UI patterns across all major interactions:

- Row creation is fully optimistic with rollback (`GridView.tsx`)
- View creation adds to sidebar and highlights instantly via `pendingViewId` (`ViewsPanel.tsx`)
- Table tab creation shows the new tab immediately via optimistic cache update (`TableTabBar.tsx`)
- Table tab switching uses a cache-first strategy that is instant when views are cached (`TableTabBar.tsx:154-166`)
- Base creation closes modal immediately in `onMutate` and routes directly to the new base without home page flash (`AppShell.tsx`)
- Home navigation removes `router.refresh()` for instant back-button behavior (`BaseSidebar.tsx`)
- View ordering is deterministic via `asc(views.id)` (`view.ts:33`)
- Cold start prefetch warms `base.getAll` on app mount (`AppShell.tsx:35-37`)

**One structural gap:** Opening a base from the home page falls back to sequential `await fetch` calls before routing when the table/view cache is cold (`HomeContent.tsx:106-133`). The cold-start prefetch does not cover this path. Must-have 11 is not fully satisfied — the warm path is instant, the cold path blocks.

Four items need browser testing to confirm the feel in practice.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
