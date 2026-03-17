---
phase: 05-cell-editing
plan: 01
subsystem: ui
tags: [react, virtualization, cell-editing, tanstack-virtual, cursor-state]

# Dependency graph
requires:
  - phase: 04-grid-core
    provides: GridTable with virtual scroll, page cache, TanStack Table headers
provides:
  - GridCell component with display/edit modes per column type
  - Cursor state (cursor + editingCell) in GridView as useState
  - Cell selection and edit mode interaction via two-click pattern
  - Double-rAF scrollToIndex + DOM focus pattern for virtualized grids
  - rowVirtualizerRef exposed from GridTable to GridView
affects:
  - 05-02 (keyboard navigation builds directly on cursor/editingCell state and scrollToCell)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Double-rAF pattern: first rAF scrolls virtualizer, second rAF queries newly rendered DOM cell"
    - "Two-click cell interaction: first click selects (cursor), second click edits (editingCell)"
    - "Cursor state as plain useState in GridView (NOT context) — co-located with handlers"
    - "rowVirtualizerRef.current assigned after useVirtualizer in GridTable — passed up to GridView"

key-files:
  created:
    - src/components/grid/GridCell.tsx
  modified:
    - src/components/grid/GridView.tsx
    - src/components/grid/GridTable.tsx

key-decisions:
  - "Cursor state as two separate useState (cursor + editingCell) in GridView, not combined — cleaner separation of selection vs editing"
  - "handleCommit deferred mutation to 05-02 — only setEditingCell(null) for now; interaction model established first"
  - "isNaN() check restructured to avoid 'as number' type assertion — ESLint non-nullable-type-assertion-style rule"
  - "tabIndex={0} on scroll container div for keyboard handler readiness in 05-02"

patterns-established:
  - "GridCell: self-contained display/edit with local draft state; parent manages selection/editing boolean flags"
  - "Two-click pattern: onSelect on first click (unfocused), onStartEditing on second click (focused, not editing)"
  - "scrollToCell: double requestAnimationFrame wraps scrollToIndex + DOM querySelector focus"

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 05 Plan 01: Cell Editing Foundation Summary

**GridCell component with two-click select/edit, cursor state in GridView, double-rAF scroll-to-focus for virtualized grids.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T11:53:41Z
- **Completed:** 2026-03-17T11:58:32Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 created, 2 updated)

## Accomplishments

- Created GridCell with display mode (span) and edit mode (input), two-click select-then-edit pattern, Escape reverts, Enter/blur commits
- Added cursor + editingCell useState to GridView; scrollToCell uses double-rAF (scroll then DOM focus) for virtualized grid correctness
- Replaced plain `<td>` cell rendering in GridTable with GridCell per real row; rowVirtualizerRef exposed upward for scrollToIndex calls

## Task Commits

1. **Task 1: Create GridCell with display/edit modes** - `aee3eff` (feat)
2. **Task 2: Add cursor state to GridView and wire GridCell through GridTable** - `31ed364` (feat)

**Plan metadata:** _(forthcoming docs commit)_

## Files Created/Modified

- `src/components/grid/GridCell.tsx` — New component: display/edit modes, draft state, two-click handler, Escape/Enter/blur commit
- `src/components/grid/GridView.tsx` — Added cursor, editingCell useState; rowVirtualizerRef; scrollToCell double-rAF; handleSelect/handleStartEditing/handleRevert/handleCommit
- `src/components/grid/GridTable.tsx` — Added cell interaction props; rowVirtualizerRef assignment; GridCell render loop; tabIndex={0} on scroll container

## Decisions Made

- **Commit null for empty number fields, reject NaN silently:** ESLint forced restructuring away from `as number` cast — split into two branches (empty → null, else → Number() + isNaN check). Same behavior, cleaner types.
- **handleCommit in GridView defers mutation:** Only `setEditingCell(null)` now; optimistic cell update mutation added in 05-02. Deliberately phased.
- **`contain: "strict"` on scroll container** (was `contain: "layout style"`): Stronger containment; compatible with `tabIndex={0}` for keyboard events.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restructured number commit logic to avoid ESLint non-nullable-type-assertion-style error**

- **Found during:** Task 1 build
- **Issue:** `isNaN(numValue as number)` where `numValue: number | null` triggered `@typescript-eslint/non-nullable-type-assertion-style` — rule requires `!` not `as T` for non-null narrowing
- **Fix:** Split into `if (trimmed === "") { onCommit(null) } else { const n = Number(trimmed); if (isNaN(n)) return; onCommit(n); }` — no type assertion needed
- **Files modified:** `src/components/grid/GridCell.tsx`
- **Commit:** aee3eff (fix applied before commit)

## Next Phase Readiness

05-02 (keyboard navigation) requires:
- cursor + editingCell state: ready (useState in GridView)
- scrollToCell: ready (double-rAF in GridView)
- Container tabIndex={0}: ready (GridTable scroll div)
- GridCell stopPropagation on Escape/Enter: ready (prevents double-handling)
