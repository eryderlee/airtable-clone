---
phase: 07-column-virtualization
plan: 01
subsystem: ui
tags: [react, tanstack-virtual, virtualization, grid, performance]

requires:
  - phase: 06-toolbar
    provides: visibleColumnIds filtering, hidden columns state in GridView

provides:
  - Column virtualizer (horizontal) with threshold-based activation (>=20 columns)
  - Virtual padding spacer pattern for header and body rows
  - scrollToCell with horizontal scroll via columnVirtualizerRef
  - COLUMN_VIRTUALIZATION_THRESHOLD exported constant

affects:
  - future-grid-enhancements
  - testing

tech-stack:
  added: []
  patterns:
    - "useVirtualizer(horizontal:true) with enabled flag for threshold-based activation"
    - "Virtual padding spacer pattern: left/right <td>/<th> elements hold space for off-screen columns"
    - "columnsToRender derived from virtualColumns.getVirtualItems() — replaces columnIds.map() in all row renders"
    - "columnVirtualizerRef threaded from GridView to GridTable via prop, same pattern as rowVirtualizerRef"
    - "Declarations reordered in GridView: column defs + visibleColumnIds moved before scrollToCell to fix block-scoped use-before-declare"

key-files:
  created: []
  modified:
    - src/components/grid/GridTable.tsx
    - src/components/grid/GridHeader.tsx
    - src/components/grid/GridView.tsx

key-decisions:
  - "COLUMN_VIRTUALIZATION_THRESHOLD=20 — avoids GitHub #685 bi-directional virtualizer scroll lag for tables under threshold"
  - "Virtual padding spacer pattern chosen over translateX per cell — simpler, more compatible with display:grid table layout"
  - "columnVirtualizerRef.current assigned each render (same pattern as rowVirtualizerRef) — no useMemo needed"
  - "columnsToRender uses flatMap with undefined guard instead of non-null assertion — required to satisfy @typescript-eslint/no-unnecessary-type-assertion"
  - "column defs, columnIds, columnWidths, visibleColumnIds moved before scrollToCell in GridView to fix block-scoped variable used before declaration TypeScript error"

patterns-established:
  - "Threshold-based virtualizer activation: enabled prop + shouldVirtualize flag derived from count vs threshold"
  - "Spacer elements pattern: check > 0 before rendering spacer <td>/<th> to keep DOM clean when not virtualized"

duration: 7min
completed: 2026-03-18
---

# Phase 7 Plan 1: Column Virtualization Summary

**Horizontal column virtualizer using @tanstack/react-virtual with threshold activation (>=20 columns), virtual padding spacers in header and body rows, and columnVirtualizerRef wired into scrollToCell for arrow-key horizontal navigation.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T02:50:09Z
- **Completed:** 2026-03-18T02:57:09Z
- **Tasks:** 2 (+ checkpoint)
- **Files modified:** 3

## Accomplishments

- Added `useVirtualizer({ horizontal: true, enabled: shouldVirtualizeColumns })` in GridTable alongside the existing row virtualizer
- Computed `columnsToRender` / `virtualPaddingLeft` / `virtualPaddingRight` from virtual items; replaced all `columnIds.map()` loops in real rows, skeleton rows, and add-row row with `columnsToRender.map()` + spacer elements
- Updated GridHeader to accept `columnsToRender`, `virtualPaddingLeft`, `virtualPaddingRight` props and render spacer `<th>` elements with the virtual padding widths
- Added `columnVirtualizerRef` in GridView and updated `scrollToCell` to call `columnVirtualizerRef.current?.scrollToIndex(colIndex)` when column virtualization is active

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Add column virtualizer and wire scrollToCell** - `51f29b9` (feat)

**Plan metadata:** (pending — added after this summary commit)

## Files Created/Modified

- `src/components/grid/GridTable.tsx` - COLUMN_VIRTUALIZATION_THRESHOLD constant, columnVirtualizerRef prop, horizontal useVirtualizer, columnsToRender/spacer rendering in all row types
- `src/components/grid/GridHeader.tsx` - columnsToRender/virtualPaddingLeft/virtualPaddingRight props, spacer th elements in header row
- `src/components/grid/GridView.tsx` - columnVirtualizerRef ref, shouldVirtualizeColumns flag, updated scrollToCell with horizontal scroll, column defs reordered before scrollToCell

## Decisions Made

- **COLUMN_VIRTUALIZATION_THRESHOLD = 20**: Below this threshold the virtualizer is disabled (`enabled: false`) — avoids bi-directional scroll lag issue for typical tables while enabling virtualization for wide tables.
- **Virtual padding spacer pattern**: Left/right spacer `<td>`/`<th>` elements hold pixel space for off-screen columns. This integrates cleanly with the `display: grid` table layout established in Phase 4.
- **Declaration reordering in GridView**: `columnDefs`, `columnIds`, `columnWidths`, `visibleColumnIds`, `columnOrder`, `shouldVirtualizeColumns`, and `scrollToCell` were moved before `handleSelect`/`moveCursor` to resolve TypeScript "block-scoped variable used before its declaration" error.
- **flatMap with undefined guard**: Used `virtualColumns.flatMap((vc) => { const id = columnIds[vc.index]; return id !== undefined ? [id] : []; })` instead of non-null assertion to satisfy `@typescript-eslint/no-unnecessary-type-assertion`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved column definitions before scrollToCell to fix TypeScript use-before-declare error**

- **Found during:** Task 2 (wiring scrollToCell in GridView)
- **Issue:** `scrollToCell` was placed after `handleSelect` in the original file, but `handleSelect` references `scrollToCell`. After moving `scrollToCell` to after `visibleColumnIds` (required dependency), TypeScript detected that `handleSelect` referenced `scrollToCell` before its block-scoped declaration.
- **Fix:** Moved `columnDefs`, `columnIds`, `columnWidths`, `visibleColumnIds`, `columnOrder`, `shouldVirtualizeColumns`, and `scrollToCell` to before `handleSelect`. Removed duplicate declarations that appeared later.
- **Files modified:** `src/components/grid/GridView.tsx`
- **Verification:** `npm run build` passes with no TypeScript errors.
- **Committed in:** `51f29b9`

---

**Total deviations:** 1 auto-fixed (blocking — TypeScript declaration ordering)
**Impact on plan:** Required fix for build to pass. No scope creep. Ordering of hooks is preserved (same hooks, same order, just earlier in the function body).

## Issues Encountered

- ESLint `@typescript-eslint/no-unnecessary-type-assertion` flagged `columnIds[vc.index]!` — replaced with `flatMap` + undefined guard.
- TypeScript `Block-scoped variable 'scrollToCell' used before its declaration` — resolved by moving column def declarations earlier in GridView function body.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Column virtualization implementation complete and build-verified
- Awaiting human verification of runtime behavior (checkpoint:human-verify) — user needs to add 25+ columns and confirm DOM only contains visible column elements
- If checkpoint approved: Phase 7 plan 1 fully complete; Phase 8 can begin

---
*Phase: 07-column-virtualization*
*Completed: 2026-03-18*
