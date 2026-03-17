---
phase: 03-navigation-shell
plan: 01
subsystem: ui
tags: [nextjs, app-router, route-groups, server-components, auth, trpc, react]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: tRPC routers for base.getAll, table.getByBaseId, view.getByTableId
  - phase: 01-foundation
    provides: auth() from ~/server/auth, tRPC server caller from ~/trpc/server
provides:
  - Next.js (app) route group with auth-gated layout shell
  - Server-side redirect chain / -> /base/[baseId] -> /base/[id]/[tableId]/view/[viewId]
  - Nested layout hierarchy: sidebar shell > tab bar shell > views panel shell > content
  - InlineEdit reusable click-to-edit component for rename flows
affects: [03-navigation-shell/02, 04-grid-virtualization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Next.js 15 params must be awaited (Promise<Params>) in server components
    - (app) route group scopes authenticated layout without affecting URL segments
    - redirect() called outside try/catch — Next.js redirect throws internally
    - Server-side tRPC caller (api from ~/trpc/server) used in RSC redirect pages

key-files:
  created:
    - src/app/(app)/layout.tsx
    - src/app/(app)/page.tsx
    - src/app/(app)/base/[baseId]/layout.tsx
    - src/app/(app)/base/[baseId]/page.tsx
    - src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/layout.tsx
    - src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx
    - src/components/ui/InlineEdit.tsx
  modified:
    - src/app/page.tsx (deleted — conflicted with (app)/page.tsx at / route)

key-decisions:
  - "Removed src/app/page.tsx to eliminate route conflict with (app)/page.tsx — both claimed /"
  - "await params (not destructure) in layout files that don't use param values — avoids unused-vars lint"
  - "Non-null assertions (!) on array[0] flagged as unnecessary by ESLint — use optional chaining instead"

patterns-established:
  - "Await params at top of server component: const { id } = await params"
  - "Layout shells render placeholder content; Plan 02 replaces placeholders with real client components"
  - "InlineEdit: onDoubleClick enters edit, Enter/blur saves, Escape reverts"

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 3 Plan 01: Navigation Shell Route Hierarchy Summary

**Next.js App Router (app) route group with auth-gated nested layout shells and server-side tRPC redirect chain landing users at /base/[id]/[tableId]/view/[viewId]**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-17T00:23:51Z
- **Completed:** 2026-03-17T00:28:56Z
- **Tasks:** 2
- **Files modified:** 8 (7 created, 1 deleted)

## Accomplishments
- Full (app) route group: auth guard + sidebar shell > base layout (tab bar) > view layout (views panel) > content placeholder
- Server-side redirect chain: / -> first base -> first table+view (uses server tRPC callers, no client-side navigation)
- InlineEdit component ready for Plan 02's sidebar, tab bar, and views panel rename flows
- Build passes cleanly, zero sync-dynamic-apis warnings, all params properly awaited

## Task Commits

Each task was committed atomically:

1. **Task 1: Create (app) route group with nested layouts and redirect pages** - `8006a39` (feat)
2. **Task 2: Create InlineEdit shared component** - `c6f04d2` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/(app)/layout.tsx` - Auth guard (auth() check) + sidebar placeholder shell
- `src/app/(app)/page.tsx` - Redirect to first base via api.base.getAll()
- `src/app/(app)/base/[baseId]/layout.tsx` - Tab bar placeholder shell, awaits params
- `src/app/(app)/base/[baseId]/page.tsx` - Redirect to first table+view via api.table/view
- `src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/layout.tsx` - Views panel placeholder shell
- `src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx` - Content area placeholder
- `src/components/ui/InlineEdit.tsx` - Reusable double-click-to-edit text component
- `src/app/page.tsx` - Deleted (route conflict with (app)/page.tsx)

## Decisions Made
- Deleted `src/app/page.tsx`: Next.js App Router does not allow `app/page.tsx` and `app/(group)/page.tsx` to coexist for the same `/` route. The old T3 scaffold homepage was replaced by the (app) route group's auth-gated index page.
- Unused params in layout files: layouts that shell-wrap children without needing the current route params still must `await params` for Next.js 15 compliance. Used `await params` without destructuring to avoid `@typescript-eslint/no-unused-vars` errors.
- Non-null assertions on array[0]: ESLint flagged `bases[0]!.id` as unnecessary type assertion. Switched to optional chaining pattern (`firstBase?.id`) which satisfies both TypeScript and the linter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed conflicting src/app/page.tsx**
- **Found during:** Task 1 (discovered during build verification)
- **Issue:** `src/app/page.tsx` and `src/app/(app)/page.tsx` both claim the `/` route — Next.js build would error on route conflict
- **Fix:** Deleted `src/app/page.tsx`; the T3 scaffold homepage is superseded by the (app) auth-gated page
- **Files modified:** `src/app/page.tsx` (deleted)
- **Verification:** Build passes with single `/` route mapped to `(app)/page.tsx`
- **Committed in:** `8006a39` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ESLint errors blocking build**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `@typescript-eslint/no-unnecessary-type-assertion` errors on `bases[0]!.id` and `tables[0]!.id`; `no-unused-vars` on destructured params in layout files
- **Fix:** Replaced `!` assertions with optional chaining; replaced destructuring with bare `await params` in layouts that don't use param values
- **Files modified:** `(app)/page.tsx`, `base/[baseId]/page.tsx`, `base/[baseId]/layout.tsx`, view layout
- **Verification:** `npm run build` passes with zero errors
- **Committed in:** `8006a39` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes required for build to pass. No scope creep.

## Issues Encountered
None beyond the auto-fixed lint/conflict issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route hierarchy complete: all 6 route files exist with correct nesting
- InlineEdit component ready for Plan 02 client components
- Plan 02 will replace placeholder `<aside>` and `<header>` elements with real AppSidebar, TableTabBar, and ViewsPanel client components
- No blockers for Plan 02

---
*Phase: 03-navigation-shell*
*Completed: 2026-03-17*
