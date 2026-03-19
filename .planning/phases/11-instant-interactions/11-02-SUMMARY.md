---
plan: 11-02
phase: 11-instant-interactions
status: complete
subsystem: optimistic-ui
tags: [optimistic, react-query, mutations, ux, performance]
requires: [10-02, 10-03]
provides: [optimistic-row-create, instant-view-highlight, instant-base-create, cold-start-prefetch]
affects: []
tech-stack:
  added: []
  patterns: [optimistic-mutation-with-rollback, onMutate-close-modal, cold-start-prefetch]
key-files:
  created: []
  modified:
    - src/components/grid/GridView.tsx
    - src/components/nav/ViewsPanel.tsx
    - src/components/nav/AppShell.tsx
decisions:
  - "cells ?? {} pattern instead of cells as T cast — ESLint non-nullable-type-assertion-style prohibits redundant type casts"
  - "pendingViewId tracks optimistic view before navigation confirms — activeViewId is the URL param which only updates on navigation"
  - "base.getAll NOT set in onMutate to prevent home page flash — only invalidated in createTable.onSettled after navigation"
  - "pendingBaseIdRef stores baseId between createBase.onSuccess and createTable.onSuccess closures"
metrics:
  duration: "~8 min"
  completed: "2026-03-19"
---

# Phase 11 Plan 02: Optimistic Interactions Summary

## What Was Built

Three responsiveness fixes and one cold start optimization:

1. **Optimistic row creation (GridView.tsx)** — `createRow` upgraded from plain mutation to full optimistic pattern. `onMutate` inserts the row into `pageCacheRef` immediately with an `optimistic-${Date.now()}` ID, bumps the row count, and scrolls/focuses the new row. `onSuccess` swaps the optimistic ID for the real server ID. `onError` removes the row and shows a toast. `handleAddRow` simplified from async/await to a single `createRow.mutate(...)` call. `handleCommit` guards against optimistic IDs with `rowId.startsWith('optimistic-')` to skip server mutations for rows not yet confirmed.

2. **View active highlight via pendingViewId (ViewsPanel.tsx)** — `pendingViewId` state tracks the optimistic view ID created in `createView.onMutate`. The `isActive` check in the view list now uses `view.id === activeViewId || view.id === pendingViewId`, so the new view row is highlighted blue immediately before the router navigates. A `useEffect` clears `pendingViewId` once the real `activeViewId` is set.

3. **Instant base creation without home flash (AppShell.tsx)** — Replaced `mutateAsync` chain with proper `onMutate`/`onSuccess` pattern. `createBase.onMutate` closes the modal immediately. `createBase.onSuccess` chains to `createTable.mutate`. `createTable.onSuccess` fetches views and navigates. `base.getAll` is only invalidated in `createTable.onSettled` (after navigation), preventing the home page from flashing a new base card.

4. **Cold start prefetch (AppShell.tsx)** — `utils.base.getAll.prefetch()` called on mount so the base list is cached before the user navigates home, mitigating the cold start delay from Neon scaling to zero.

## Commits

- `49f824c` — feat(11-02): optimistic row creation via onMutate
- `a9e2fa7` — feat(11-02): view active highlight, base creation instant feedback, cold start prefetch

## Deviations

**1. [Rule 1 - Bug] cells cast removed, replaced with null coalescing**

- Found during: Task 1 build verification
- Issue: `cells as Record<string, string | number | null>` triggered ESLint `@typescript-eslint/non-nullable-type-assertion-style` (redundant cast since the zod schema types cells as that exact type, though TypeScript infers it as `T | undefined` due to `.default({})`)
- Fix: Changed `cells as Record<string, string | number | null>` to `cells ?? {}` which satisfies both TypeScript and ESLint
- Files modified: `src/components/grid/GridView.tsx`
- Commit: a9e2fa7 (included in Task 2 commit)

## Issues

None — build passes cleanly after lint fix.
