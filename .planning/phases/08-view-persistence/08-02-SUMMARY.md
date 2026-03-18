---
phase: 08-view-persistence
plan: 02
subsystem: ui
tags: [react, trpc, views, inline-edit, crud]

# Dependency graph
requires:
  - phase: 08-01
    provides: SSR-seeded view config persistence and auto-save debounce
provides:
  - ViewsPanel rename via InlineEdit double-click (view.update mutation)
  - ViewsPanel delete button with last-view guard (view.delete mutation)
  - Active-view deletion redirects to first remaining view
  - Human-verified end-to-end config persistence pipeline
affects: [future-ui, any-phase-touching-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-edit-on-double-click, hover-reveal-delete-button, last-view-guard]

key-files:
  created: []
  modified:
    - src/components/nav/ViewsPanel.tsx

key-decisions:
  - "ViewsPanel rename uses InlineEdit double-click; single-click still navigates via router.push"
  - "Delete button hidden via views.length <= 1 guard (not just disabled) — last view cannot be deleted"
  - "Active-view deletion: invalidate then fetch remaining views and push to first remaining view"

patterns-established:
  - "Hover-reveal delete button: group/group-hover Tailwind pattern; button hidden at opacity-0, shown at group-hover:opacity-100"
  - "InlineEdit double-click rename pattern: display as text normally, enter edit mode on double-click, save on Enter/blur"

# Metrics
duration: ~10min
completed: 2026-03-18
---

# Phase 8 Plan 02: View Rename/Delete Summary

**ViewsPanel completed with InlineEdit double-click rename, hover-reveal delete button, and last-view guard; human-verified full config persistence pipeline confirmed working end-to-end**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-18
- **Completed:** 2026-03-18
- **Tasks:** 1 auto + 1 checkpoint (human-verified)
- **Files modified:** 1

## Accomplishments

- ViewsPanel now supports rename via InlineEdit double-click: double-clicking a view name opens an inline text editor; saving calls `view.update` mutation and invalidates the views list
- Delete button appears on hover for each view item; hidden when `views.length <= 1` (last-view guard prevents deleting the only view)
- Deleting the active view redirects to the first remaining view via `router.push`
- Human verified: full config persistence pipeline (filters, sorts, hiddenColumns) confirmed working end-to-end through page reload and view switches

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rename and delete actions to ViewsPanel** - `d50260d` (feat)

**Plan metadata:** pending this docs commit (docs: complete view rename/delete UI plan)

## Files Created/Modified

- `src/components/nav/ViewsPanel.tsx` - Added InlineEdit rename, hover-reveal delete button, last-view guard, active-view deletion redirect

## Decisions Made

- ViewsPanel rename uses InlineEdit double-click; single-click still navigates via `router.push` (not a Link, to avoid InlineEdit/Link conflict)
- Delete button hidden entirely (not just disabled) when `views.length <= 1` — cleaner UX than a disabled button
- Active-view deletion: after `view.delete` mutation, invalidate then fetch updated views list and `router.push` to `remaining[0].id`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - human verification passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 (View Persistence) is fully complete: SSR-seeded config (08-01) + auto-save debounce (08-01) + full view CRUD with rename/delete (08-02)
- All 8 phases of the Airtable clone are now complete
- The full persistence pipeline is human-verified: filters, sorts, hiddenColumns round-trip through page reload; each view maintains independent configuration; URL reflects active view ID and is shareable

---
*Phase: 08-view-persistence*
*Completed: 2026-03-18*
