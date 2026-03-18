---
phase: "08"
plan: "01"
subsystem: view-persistence
tags: [view, config, ssr, persistence, debounce, trpc]
status: complete

dependency-graph:
  requires: [07-01]
  provides: [view-config-persistence, ssr-seeded-grid-view]
  affects: [08-02]

tech-stack:
  added: []
  patterns: [ssr-seeding, debounced-auto-save, key-prop-remount]

file-tracking:
  created: []
  modified:
    - src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx
    - src/components/grid/GridView.tsx

decisions:
  - id: "08-01-a"
    decision: "key={viewId} on GridView forces React unmount/remount on view switch — eliminates stale state without manual cleanup"
  - id: "08-01-b"
    decision: "isFirstConfigRender ref separate from isFirstRender ref — each useEffect guard is independent"
  - id: "08-01-c"
    decision: "updateViewConfig is fire-and-forget (no optimistic update) — config save failure is silent; acceptable for v1"

metrics:
  duration: "~4 min"
  completed: "2026-03-18"
---

# Phase 8 Plan 1: SSR-seeded view config persistence Summary

## Status: Complete

## One-liner
SSR-seeds view config (filters/sorts/hiddenColumns) from DB into GridView props, auto-saves changes back via 800ms debounced mutation, with key={viewId} for clean per-view state.

## What Was Built

End-to-end view config persistence:

1. **page.tsx (server component):** Fetches all views for the table via `api.view.getByTableId`, finds the active view by `viewId`, and passes its `config` as `initialConfig` prop to `GridView`. Added `key={viewId}` to force React unmount/remount when the user switches views.

2. **GridView.tsx:** Updated `GridViewProps` interface to accept optional `initialConfig`. The `filters`, `sorts`, and `hiddenColumns` useState hooks now seed from `initialConfig` instead of empty defaults. `searchInput` and `searchQuery` always initialize to `""` (ephemeral). Added `updateViewConfig` mutation and a separate `isFirstConfigRender` ref that prevents the initial mount from firing a spurious save. A debounced useEffect (800ms) auto-saves `filters`, `sorts`, and `hiddenColumns` to the DB whenever they change.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: SSR seed initialConfig | 45dad70 | page.tsx, GridView.tsx |
| Task 2: Auto-save debounced useEffect | 01b897a | GridView.tsx |

## Deviations

None — plan executed exactly as written.

## Issues

None. Build passed cleanly on first attempt after each task.
