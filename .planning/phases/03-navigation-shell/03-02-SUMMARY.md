---
phase: 03-navigation-shell
plan: 02
subsystem: ui
tags: [trpc, react, nextjs, navigation, sidebar, tabs, views]

# Dependency graph
requires:
  - phase: 03-01
    provides: route hierarchy, layout shells, InlineEdit component
  - phase: 02-01
    provides: base/table/view/column tRPC routers
provides:
  - AppSidebar client component with base CRUD
  - TableTabBar client component with table CRUD and tab navigation
  - ViewsPanel client component with view switching and creation
  - /base/[baseId]/[tableId] server redirect page to first view
  - Full base > table > view navigation hierarchy wired to tRPC
affects: [04-grid-shell, 05-cell-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - api.useUtils() for cache invalidation (not deprecated api.useContext())
    - utils.view.getByTableId.fetch() for imperative server calls in mutations
    - Server component layouts pass IDs as props to client component children
    - useParams() for reading route params in client components (not layout props)
    - Next.js 15 optional chaining (?.) instead of non-null assertions (!) on array[0]

key-files:
  created:
    - src/components/nav/AppSidebar.tsx
    - src/components/nav/TableTabBar.tsx
    - src/components/nav/ViewsPanel.tsx
    - src/app/(app)/base/[baseId]/[tableId]/page.tsx
  modified:
    - src/app/(app)/layout.tsx
    - src/app/(app)/base/[baseId]/layout.tsx
    - src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/layout.tsx
    - src/server/api/routers/table.ts

key-decisions:
  - "utils.view.getByTableId.fetch() used for imperative view lookup after table create — no utils.client (not available in createTRPCReact)"
  - "TableTabBar receives baseId as prop from server layout; reads tableId from useParams()"
  - "ViewsPanel receives tableId + activeViewId as props; reads baseId from useParams()"
  - "views[0]?.id (optional chain) not views[0]!.id — ESLint no-unnecessary-type-assertion rule"
  - "Table seed row count changed from 5 to 10 to satisfy TBL-04 requirement"

patterns-established:
  - "Server layout awaits params and passes IDs as props to client nav components"
  - "Client nav components use useParams() only for IDs not passed as props"
  - "All mutations use api.useUtils().X.invalidate() for cache updates"
  - "Tab click navigates to /base/[baseId]/[tableId] which server-redirects to first view"
  - "Delete guarded by window.confirm(), hidden when only 1 item remains (tables)"

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 3 Plan 02: Navigation Shell Client Components Summary

**AppSidebar, TableTabBar, and ViewsPanel client components with full CRUD wired to tRPC — users can create/rename/delete bases and tables, switch views, and navigate the full base > table > view hierarchy**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T06:33:19Z
- **Completed:** 2026-03-17T06:38:18Z
- **Tasks:** 3 (Task 1, Task 2a, Task 2b)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- AppSidebar renders user's bases with create/rename/delete; active base highlighted; navigates on click
- TableTabBar renders table tabs with create/rename/delete; tab clicks navigate via server redirect to first view; new tables pre-seeded with 10 rows and 3 columns
- ViewsPanel renders views for active table with active highlight; view creation with sequential naming ("Grid View N")
- `/base/[baseId]/[tableId]/page.tsx` server redirect resolves tableId to first view URL

## Task Commits

Each task was committed atomically:

1. **Task 1: AppSidebar** - `58fb162` (feat)
2. **Task 2a: TableTabBar + redirect page + seed fix** - `1c9c6f0` (feat)
3. **Task 2b: ViewsPanel** - `60c87a6` (feat)

## Files Created/Modified

- `src/components/nav/AppSidebar.tsx` - Base list with create/rename/delete, active highlight, hover-reveal delete button
- `src/components/nav/TableTabBar.tsx` - Table tabs with create/rename/delete, imperative view fetch for post-create navigation
- `src/components/nav/ViewsPanel.tsx` - View list with active highlight, create view with sequential naming
- `src/app/(app)/base/[baseId]/[tableId]/page.tsx` - Server redirect page resolving tableId to first view
- `src/app/(app)/layout.tsx` - Replaced placeholder aside with AppSidebar
- `src/app/(app)/base/[baseId]/layout.tsx` - Replaced placeholder header with TableTabBar (passes baseId prop)
- `src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/layout.tsx` - Replaced placeholder aside with ViewsPanel (passes tableId + activeViewId props)
- `src/server/api/routers/table.ts` - Seed row count changed from 5 to 10

## Decisions Made

- `utils.view.getByTableId.fetch()` used for imperative view lookup after table create — `utils.client` is not available in `createTRPCReact`, it is a `@trpc/tanstack-react-query` concept
- `TableTabBar` receives `baseId` as prop from server layout; reads `tableId` from `useParams()` since it is inside the `[tableId]` route segment during tab rendering
- `ViewsPanel` receives `tableId` and `activeViewId` as props from view layout; reads `baseId` from `useParams()`
- `views[0]?.id` (optional chain) used instead of `views[0]!.id` — ESLint `@typescript-eslint/no-unnecessary-type-assertion` blocks non-null assertions on array access (established pattern from 03-01)
- Table seed row count changed 5 → 10 to satisfy TBL-04 plan requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-null assertion ESLint error in tableId redirect page**

- **Found during:** Task 2a (TableTabBar + redirect page)
- **Issue:** `views[0]!.id` triggers `@typescript-eslint/no-unnecessary-type-assertion` ESLint error, failing build
- **Fix:** Changed to `views[0]?.id` — optional chain compatible with redirect (redirects to `/base/.../view/undefined` edge case acceptable; no views is guarded by the length check above)
- **Files modified:** `src/app/(app)/base/[baseId]/[tableId]/page.tsx`
- **Verification:** `npm run build` passed
- **Committed in:** `1c9c6f0` (Task 2a commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - lint/type correctness)
**Impact on plan:** Trivial fix consistent with established pattern from 03-01. No scope creep.

## Issues Encountered

None — all tasks executed cleanly after the ESLint fix on array access.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full navigation hierarchy is complete and functional: base CRUD in sidebar, table CRUD in tab bar, view switching in views panel
- URL structure `/base/[baseId]/[tableId]/view/[viewId]` is live and navigable
- Phase 4 (grid shell) can mount the data grid inside the `<main>` slot in `view/[viewId]/layout.tsx`
- ViewsPanel `activeViewId` prop is already wired for Phase 4 view config consumption
- No blockers for Phase 4

---
*Phase: 03-navigation-shell*
*Completed: 2026-03-17*
