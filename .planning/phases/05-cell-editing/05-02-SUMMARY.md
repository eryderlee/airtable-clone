---
phase: 05-cell-editing
plan: "02"
subsystem: ui
tags: [react, trpc, tanstack-virtual, keyboard-navigation, optimistic-update]

# Dependency graph
requires:
  - phase: 05-01
    provides: GridCell component, cursor/editingCell useState in GridView, scrollToCell double-rAF pattern
  - phase: 04-03
    provides: ref-based page cache (pageCacheRef), forceUpdate, row.update tRPC router
provides:
  - Container-level keyboard handler on GridTable div (arrow keys, Tab, Enter, Escape, printable chars)
  - Optimistic row.update mutation with pageCacheRef direct mutation and rollback on error
  - initialDraft prop on GridCell for printable-char-to-edit-mode entry
  - moveCursor helper wiring setCursor + scrollToCell
  - Full Airtable-style spreadsheet navigation and cell editing
affects: [06-search-filter, 07-column-types, 08-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container-level keyboard handler: single onKeyDown on the scroll container div handles all key events; individual cells do not have keyboard handlers"
    - "Edit-mode key interception: Enter and Escape handled by GridCell input with stopPropagation; Tab intercepted by container even in edit mode"
    - "Optimistic mutation against ref cache: pageCacheRef mutated directly in onMutate, forceUpdate() triggers re-render; no React Query infinite cache involved"
    - "initialDraft pattern: printable char sets initialDraft state; passed to editing GridCell only; resets to undefined after use"

key-files:
  created: []
  modified:
    - src/components/grid/GridView.tsx
    - src/components/grid/GridCell.tsx
    - src/components/grid/GridTable.tsx

key-decisions:
  - "Optimistic mutation targets pageCacheRef directly (not React Query cache) — Phase 04-03 replaced useInfiniteQuery with a ref-based page cache; utils.row.getRows does not exist"
  - "Tab is intercepted by container even in edit mode; Enter/Escape are handled by GridCell input's onKeyDown with stopPropagation — prevents double-handling"
  - "Printable-char detection: e.key.length === 1 && !ctrlKey && !metaKey && !altKey — catches all typeable chars, excludes modifier combos like Ctrl+C"
  - "Arrow keys stop at grid boundaries (no wrap); Tab wraps from end of row to start of next row (and Shift+Tab wraps the reverse)"
  - "No onSettled invalidation — pageCacheRef is the source of truth until next navigation; page reload fetches fresh data from DB"

patterns-established:
  - "Container keyboard handler pattern: place onKeyDown on outermost scrollable div, tabIndex=0, outline-none"
  - "Optimistic ref mutation pattern: snapshot prevCells in onMutate return value, restore in onError context"

# Metrics
duration: ~10min
completed: 2026-03-17
---

# Phase 5 Plan 02: Keyboard Navigation and Optimistic Cell Mutation Summary

**Full Airtable-style spreadsheet keyboard navigation (arrow keys, Tab, Enter, Escape, printable-char entry) with instant optimistic cell edits persisted via tRPC row.update and pageCacheRef direct mutation + rollback**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-17
- **Completed:** 2026-03-17
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments

- Container-level `handleKeyDown` on GridTable's scroll div handles all spreadsheet keyboard interactions without per-cell event handlers
- Optimistic mutation mutates `pageCacheRef` directly (bypassing React Query) for instant flicker-free cell updates with rollback on server error
- `initialDraft` prop on GridCell enables "type to start editing" — pressing any printable char on a selected cell enters edit mode with that character already in the input

## Task Commits

Each task was committed atomically:

1. **Task 1: Container keyboard handler + optimistic mutation** - `caeb614` (feat)
2. **Task 2: checkpoint:human-verify** - approved by human (no code commit)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `src/components/grid/GridView.tsx` — Added `initialDraft` state, `updateCell` optimistic mutation, `columnOrder` useMemo, `moveCursor` helper, `handleKeyDown` container keyboard handler; updated `handleCommit` to call mutation, `handleRevert` to clear draft
- `src/components/grid/GridCell.tsx` — Added `initialDraft` prop; useEffect initializes draft from `initialDraft` when entering edit mode, places cursor at end (vs. select-all for Enter/click)
- `src/components/grid/GridTable.tsx` — Added `onKeyDown` prop wired to container div; passes `initialDraft` to GridCell for the editing cell only

## Decisions Made

- Optimistic mutation targets `pageCacheRef` directly — Phase 04-03 replaced `useInfiniteQuery` with a ref-based page cache; `utils.row.getRows` does not exist, so `setInfiniteData` cannot be used
- Tab is intercepted at container level even in edit mode; Enter and Escape are handled by GridCell's input `onKeyDown` with `stopPropagation` to prevent double-handling
- No `onSettled` cache invalidation — `pageCacheRef` is source of truth until navigation; page reload fetches fresh DB data

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full cell editing feature complete: selection, navigation, edit mode, persistence, optimistic updates all verified by human
- Phase 5 has one remaining plan (05-03) if defined; otherwise phase 5 is complete
- Phase 6 (search/filter) can begin — cell editing foundation is solid
- Known constraint: rowOrder seek in `getByOffset` breaks on row deletion (documented in ROADMAP Technical Constraints) — not relevant until row deletion is added

---
*Phase: 05-cell-editing*
*Completed: 2026-03-17*
