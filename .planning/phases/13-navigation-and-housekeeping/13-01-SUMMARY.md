---
phase: 13-navigation-and-housekeeping
plan: 01
subsystem: ui
tags: [nextjs, trpc, react-query, navigation, prefetch]

# Dependency graph
requires:
  - phase: 12-server-side-search
    provides: searchQuery wired into row.count and getByOffset cache keys
  - phase: 10-optimistic-ui
    provides: warm-cache navigation pattern in handleBaseClick
provides:
  - Instant cold-path base navigation (router.push fires before any fetch)
  - Correct prefetch cache key in handleTabHover (includes searchQuery)
  - Accurate REQUIREMENTS.md traceability for all 45 v1 requirements
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget IIFE pattern for background fetch after immediate navigation"
    - "Prefetch cache keys must exactly match consumption keys (include all query params)"

key-files:
  created: []
  modified:
    - src/components/home/HomeContent.tsx
    - src/components/nav/TableTabBar.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "13-01: Cold-path navigation fires router.push immediately then fetches in background IIFE — URL changes before data arrives"
  - "13-01: handleTabHover prefetch cache key includes searchQuery: '' to match GridView mount cache key"
  - "13-01: UI-05 (pixel-comparison) left unchecked — verification pass 03-03 never ran; cannot assert 1:1 Airtable match"

patterns-established:
  - "Background IIFE fetch: void (async () => { ... })() after router.push for non-blocking data warm-up"

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 13 Plan 01: Navigation and Housekeeping Summary

**Instant cold-path base navigation (router.push-first IIFE pattern) and correct row.count prefetch cache key, closing TD-2, TD-5, and TD-7 from v1.0 audit**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-19T06:33:28Z
- **Completed:** 2026-03-19T06:36:56Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- TD-2 closed: cold-path `handleBaseClick` now calls `router.push(/base/${baseId})` immediately, then fetches tables/views in a fire-and-forget IIFE — URL changes before any network call completes
- TD-5 closed: `handleTabHover` prefetch now passes `searchQuery: ""` to `utils.row.count.prefetch`, matching the exact cache key that GridView reads on mount — hover prefetch is now a cache hit on navigation
- TD-7 closed: REQUIREMENTS.md updated with 44 checked requirements; traceability table shows Complete with correct phase numbers for all implemented requirements; UI-05 remains Pending (pixel-comparison pass never ran)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix cold-path navigation and prefetch cache key** - `eb5ee9c` (fix)
2. **Task 2: Update REQUIREMENTS.md traceability** - `433b8bc` (docs)

## Files Created/Modified

- `src/components/home/HomeContent.tsx` - Cold path rewritten: router.push fires first, async IIFE fetches in background
- `src/components/nav/TableTabBar.tsx` - handleTabHover prefetch includes `searchQuery: ""`
- `.planning/REQUIREMENTS.md` - 44 requirements checked, traceability table updated to Complete

## Decisions Made

- Cold path uses fire-and-forget IIFE rather than `await` — ensures URL changes immediately so the user sees navigation feedback; SSR redirect handles view resolution if the background fetch is still in flight
- UI-05 left unchecked deliberately — the pixel-comparison verification pass (03-03) was never executed, so a 1:1 Airtable layout match cannot be asserted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 13 is the final phase. All 3 v1.0 audit items (TD-2, TD-5, TD-7) are now closed. The project is complete.

- 44 of 45 v1 requirements verified and checked
- TypeScript compiles cleanly
- No open technical debt items

---
*Phase: 13-navigation-and-housekeeping*
*Completed: 2026-03-19*
