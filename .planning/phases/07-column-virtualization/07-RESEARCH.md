# Phase 7: Column Virtualization - Research

**Researched:** 2026-03-18
**Domain:** TanStack Virtualizer (@tanstack/react-virtual v3) — horizontal/bi-directional virtualization
**Confidence:** HIGH (API verified from installed node_modules source + GitHub examples)

---

## Summary

Phase 7 adds a column virtualizer alongside the existing row virtualizer. The project already has `@tanstack/react-virtual@3.13.23` installed, which is the current stable version. The library supports horizontal virtualization via `horizontal: true` on `useVirtualizer` — the same hook already used for rows. No new package installs are required.

The standard pattern for column virtualization (confirmed from the TanStack Table `virtualized-columns` example) is the **virtual padding spacer pattern**: rather than absolute-positioning each cell, two fake spacer `<td>/<th>` elements with calculated widths hold the horizontal space for off-screen columns on the left and right. Virtual items only exist for the columns in the current horizontal viewport. This integrates naturally with the existing `display:flex` row pattern.

The critical concern flagged in STATE.md is GitHub issue #685: bi-directional scroll lag where the `maybeNotify` method can consume up to 400ms with large datasets. As of March 2025 (the latest version is v3.13.23, released March 16, 2025), the issue remains open with no official fix merged. The mitigation strategy is **threshold-based activation**: below ~20 columns, render all columns without a column virtualizer (zero bi-directional overhead). Above the threshold, activate column virtualization. This prevents the issue entirely for typical table sizes.

**Primary recommendation:** Use `useVirtualizer` with `horizontal: true` plus the virtual padding spacer pattern. Apply threshold-based activation (< 20 columns: render all; >= 20: virtualize). Keep the row number + checkbox column outside of column virtualization by treating it as a non-virtual fixed cell in every row.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | 3.13.23 (installed) | Column + row virtualization | Already in project; `horizontal: true` enables column mode |

### Supporting

No additional packages required. Column virtualization is a configuration of the same `useVirtualizer` hook.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| virtual padding spacers | absolute translateX per column | Padding spacers work with existing `display:flex` rows; translateX per cell requires more transform math and doesn't compose cleanly with the existing row translateY |
| threshold activation | always virtualize columns | Avoids GitHub #685 bi-directional lag for typical tables (<20 cols); zero overhead below threshold |

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. Changes are confined to:
```
src/components/grid/
├── GridTable.tsx    # Add columnVirtualizer; change column render loop
├── GridHeader.tsx   # Add virtual padding spacers in <thead> row
├── GridView.tsx     # Add COLUMN_VIRTUALIZATION_THRESHOLD constant; thread colVirtualizer down
```

### Pattern 1: Horizontal Virtualizer with Virtual Padding Spacers

**What:** A second `useVirtualizer` instance with `horizontal: true` tracks which column indexes are visible. Two spacer elements (one left, one right) pad the row to the correct total width without rendering off-screen cells.

**When to use:** When column count >= threshold (e.g., 20).

**Example:**
```typescript
// Source: TanStack Table virtualized-columns example (GitHub), verified against installed source
const columnVirtualizer = useVirtualizer({
  count: visibleColumnIds.length,           // only visible (non-hidden) columns
  estimateSize: (index) => columnWidths[visibleColumnIds[index]] ?? 180,
  getScrollElement: () => parentRef.current, // same scroll container as rowVirtualizer
  horizontal: true,
  overscan: 3,                               // 3 columns buffer on each side
})

const virtualColumns = columnVirtualizer.getVirtualItems()

// Padding spacers:
const virtualPaddingLeft = virtualColumns[0]?.start ?? 0
const virtualPaddingRight =
  columnVirtualizer.getTotalSize() - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
```

Then in each `<tr>` row (and the `<thead>` row):
```tsx
<>
  {/* Fixed: row number / checkbox cell — NOT virtualized */}
  <td style={{ width: 100, minWidth: 100 }}>...</td>

  {/* Left spacer: holds space for off-screen columns to the left */}
  {virtualPaddingLeft > 0 && (
    <td style={{ display: 'flex', width: virtualPaddingLeft }} />
  )}

  {/* Only visible columns */}
  {virtualColumns.map((vc) => {
    const colId = visibleColumnIds[vc.index]!
    const w = columnWidths[colId] ?? 180
    return (
      <td key={colId} style={{ display: 'flex', width: w, minWidth: w }}>
        ...
      </td>
    )
  })}

  {/* Right spacer: holds space for off-screen columns to the right */}
  {virtualPaddingRight > 0 && (
    <td style={{ display: 'flex', width: virtualPaddingRight }} />
  )}
</>
```

### Pattern 2: Threshold-Based Activation

**What:** Column virtualization is only activated when the visible column count exceeds a threshold. Below the threshold, all columns render directly (current behavior).

**When to use:** Always — prevents GitHub #685 bi-directional lag for typical tables.

```typescript
const COLUMN_VIRTUALIZATION_THRESHOLD = 20

const shouldVirtualizeColumns = visibleColumnIds.length >= COLUMN_VIRTUALIZATION_THRESHOLD

// In render:
const columnsToRender = shouldVirtualizeColumns
  ? virtualColumns.map(vc => visibleColumnIds[vc.index]!)
  : visibleColumnIds
```

When not virtualizing columns, `virtualPaddingLeft` and `virtualPaddingRight` are both 0, and no spacers are rendered.

### Pattern 3: scrollMargin for Column Virtualizer

**What:** `scrollMargin` tells the virtualizer where the scroll origin is, accounting for any fixed-width column to the left of the scrollable area.

**When to use:** If the row number/checkbox column (100px) is rendered outside the horizontal scroll zone, the column virtualizer needs to know the horizontal offset. However — see CSS section below — in this architecture the fixed column scrolls with the container and the `scrollMargin` option is NOT needed.

**Key insight:** In the existing architecture, the row number column is a regular flex child inside the scrolling `<tr>`. It scrolls left off-screen just like content columns. There is no CSS sticky left column. Therefore `scrollMargin` is 0 (the default) for the column virtualizer.

If a sticky first column were added later (via `position: sticky; left: 0`), the column virtualizer would need `scrollMargin: 100` to account for the 100px fixed column width.

### Pattern 4: Column Virtualizer Scroll Container

**Critical decision:** Both the row virtualizer and column virtualizer must share the same `getScrollElement`. In `GridTable.tsx`, `parentRef` points to the outer `overflow-auto` div. Both virtualizers get `getScrollElement: () => parentRef.current`.

The column virtualizer reads `scrollLeft` via the `horizontal: true` option's `observeElementOffset` which checks `element['scrollLeft']`. The row virtualizer reads `scrollTop`. They independently monitor the same element.

### Anti-Patterns to Avoid

- **Giving each virtualizer a different scroll element:** Both must share `parentRef`. A separate horizontal scroll container would break the unified scroll.
- **Virtualizing the fixed row-number column:** The 100px checkbox/row-number cell is NOT in the `visibleColumnIds` array and must never be virtualized. Virtualize only `visibleColumnIds`.
- **Using `scrollMargin` with the current layout:** Not needed unless CSS sticky left column is added.
- **Activating column virtualization for small tables:** GitHub #685 makes this dangerous. Always use the threshold.
- **Using `onScroll` prop to manually trigger page fetches for columns:** The column virtualizer's `onChange` callback is the correct hook for reacting to column scroll; the existing `onScroll` handler is for row page fetching only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column visibility window | Custom scroll math | `columnVirtualizer.getVirtualItems()` | Virtual items already include overscan, edge clamping, RTL, gap |
| Total horizontal width | Sum of all visible column widths | `columnVirtualizer.getTotalSize()` | Handles gap option, paddingStart/End, edge cases |
| Column scroll-to | Manual `scrollLeft` assignment | `columnVirtualizer.scrollToIndex(idx, { align: 'auto' })` | Handles RTL, smooth behavior, alignment modes |
| Per-column width measurement | Manual ResizeObserver | `measureElement` callback on `<th>` ref | Virtualizer manages cache, handles layout shift |

**Key insight:** The virtual padding spacer pattern is simpler than per-cell transform math and eliminates the need to track individual column positions in render code.

---

## Common Pitfalls

### Pitfall 1: GitHub #685 — Bi-directional Scroll Lag
**What goes wrong:** When both row and column virtualization are active simultaneously, the `maybeNotify` method in the virtualizer core can block the scroll event handler for up to 400ms on large datasets, causing blank screens and dropped frames.
**Why it happens:** Two virtualizers both respond to the same scroll event, each recalculating their virtual items. On large datasets (many rows × many columns), this computation exceeds the browser's animation frame budget.
**How to avoid:** Threshold-based activation. Only activate column virtualization when column count >= 20. Below threshold, render all columns (current behavior). Issue #685 remains open as of v3.13.23 (March 2025).
**Warning signs:** Console warnings about "scroll handler took too long"; blank screen during diagonal scroll; worse on Windows with hardware acceleration.

### Pitfall 2: Column Count for the Virtualizer Excludes Fixed Columns
**What goes wrong:** Including the row number/checkbox column (width: 100px) in the column virtualizer's `count` causes off-by-one errors and incorrect padding calculations.
**Why it happens:** The fixed column is not in `visibleColumnIds` — it's a hardcoded `<td>` before the column loop.
**How to avoid:** `count: visibleColumnIds.length` — never include the fixed row number column. The virtualizer indexes map 1:1 to `visibleColumnIds` indexes.

### Pitfall 3: Cursor/Focus Not Scrolling Horizontally
**What goes wrong:** `scrollToCell()` in GridView calls `rowVirtualizerRef.current?.scrollToIndex(rowIndex)` but has no column scroll. When a cell outside the column viewport is focused (via keyboard nav or search), it won't scroll into view horizontally.
**Why it happens:** The existing `scrollToCell` only handles vertical scroll. Column scroll requires `columnVirtualizer.scrollToIndex(colIndex, { align: 'auto' })`.
**How to avoid:** Expose `columnVirtualizerRef` from GridTable (same pattern as `rowVirtualizerRef`). In `scrollToCell`, compute `colIndex = visibleColumnIds.indexOf(columnId)` and call `columnVirtualizerRef.current?.scrollToIndex(colIndex, { align: 'auto' })` in the same double-rAF pattern.
**Warning signs:** Cursor moves to a column that's off-screen to the right, grid doesn't scroll horizontally to reveal it.

### Pitfall 4: TanStack Table Headers Still Iterate All Columns
**What goes wrong:** `table.getHeaderGroups()[0]?.headers` returns ALL column headers. If `GridHeader` maps over all headers and renders them, it bypasses column virtualization entirely.
**Why it happens:** TanStack Table's `useReactTable` instance manages column state but doesn't know about the TanStack Virtualizer. It's used here only for `header.column.columnDef.meta`.
**How to avoid:** In `GridHeader`, iterate `virtualColumns` (the array from `columnVirtualizer.getVirtualItems()`) instead of all headers. Use `virtualColumn.index` to look up the corresponding header: `headers[virtualColumn.index]`. Pass `virtualColumns`, `virtualPaddingLeft`, and `virtualPaddingRight` as props to `GridHeader`.

### Pitfall 5: Primary Column Full-Height Border Line Breaks with Horizontal Scroll
**What goes wrong:** The absolute-positioned border line for the primary column (100px + primary col width) is positioned relative to the scroll container, so it stays fixed while the header scrolls. With column virtualization active, the primary column may scroll off-screen, but the border line still renders at its original position.
**Why it happens:** The border line uses `position: absolute` and a hardcoded `left` value calculated from `columnWidths[columnIds[0]]`. It doesn't account for horizontal scroll offset.
**How to avoid:** The border line is only meaningful when the primary column is visible. Either (a) hide it when column virtualization is active and the primary column has scrolled off-screen, or (b) use a different approach (e.g., `border-right` on the primary column `<td>` itself rather than an absolute overlay). Option (b) is cleaner and works correctly with the spacer pattern.

### Pitfall 6: The `onScroll` handler (row page fetching) interfering with column virtualization
**What goes wrong:** The existing `handleScroll` in GridView triggers row page fetches based on `scrollTop`. If column scroll fires the same handler, it recalculates based on the correct `scrollTop` (no actual vertical scroll happened), which is harmless but unnecessary work.
**Why it happens:** The `onScroll` prop on `parentRef`'s div fires for both vertical and horizontal scroll events.
**How to avoid:** No change needed. The `handleScroll` math only reads `scrollTop` and `clientHeight`, so horizontal-only scroll events trigger it but result in a no-op (same pages already loaded). This is acceptable.

### Pitfall 7: Add-Column Button Width After Column Virtualization
**What goes wrong:** The "Add column" `<th>` button at the end of the header row is currently rendered unconditionally after all column headers. With column virtualization, the right padding spacer appears between the last visible column and the add-column button, breaking visual layout.
**Why it happens:** The add-column button must always appear after ALL columns (including off-screen ones), not just after the last visible virtual column.
**How to avoid:** Place the add-column `<th>` after the right padding spacer, not after the virtualColumns loop. Since the right spacer already holds space for all off-screen right columns, the add-column button correctly appears at the far right.

---

## Code Examples

Verified patterns from the installed source and official examples:

### Column Virtualizer Initialization
```typescript
// Source: @tanstack/virtual-core/src/index.ts (installed, v3.13.23) + TanStack Table virtualized-columns example
const columnVirtualizer = useVirtualizer({
  count: visibleColumnIds.length,
  estimateSize: (index) => columnWidths[visibleColumnIds[index] ?? ''] ?? 180,
  getScrollElement: () => parentRef.current,
  horizontal: true,        // reads scrollLeft, uses scrollRect.width for viewport size
  overscan: 3,             // render 3 extra columns outside viewport on each side
})
```

### Checking if Column Virtualization is Active
```typescript
// In GridTable — threshold check
const shouldVirtualizeColumns = columnIds.length >= COLUMN_VIRTUALIZATION_THRESHOLD

const virtualColumns = shouldVirtualizeColumns
  ? columnVirtualizer.getVirtualItems()
  : null  // null = render all columns

const virtualPaddingLeft = virtualColumns ? (virtualColumns[0]?.start ?? 0) : 0
const virtualPaddingRight = virtualColumns
  ? columnVirtualizer.getTotalSize() - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
  : 0

const columnsToRender: string[] = virtualColumns
  ? virtualColumns.map(vc => columnIds[vc.index]!)
  : columnIds
```

### Row Rendering with Virtual Column Spacers
```typescript
// Source: TanStack Table virtualized-columns example pattern
<tr style={{ display: 'flex', position: 'absolute', transform: `translateY(${virtualRow.start}px)`, height: 32 }}>
  {/* Fixed: row number / checkbox — always rendered, not virtualized */}
  <td style={{ display: 'flex', width: 100, minWidth: 100 }}>...</td>

  {virtualPaddingLeft > 0 && (
    <td style={{ display: 'flex', width: virtualPaddingLeft }} />
  )}

  {columnsToRender.map((colId) => {
    const w = columnWidths[colId] ?? 180
    return <td key={colId} style={{ display: 'flex', width: w, minWidth: w }}>...</td>
  })}

  {virtualPaddingRight > 0 && (
    <td style={{ display: 'flex', width: virtualPaddingRight }} />
  )}
</tr>
```

### Exposing Column Virtualizer Ref for Scroll-to-Cell
```typescript
// GridTable.tsx — expose ref (pattern mirrors existing rowVirtualizerRef)
columnVirtualizerRef.current = columnVirtualizer

// GridView.tsx — scrollToCell with horizontal scroll
const scrollToCell = useCallback((rowIndex: number, columnId: string) => {
  const colIndex = visibleColumnIds.indexOf(columnId)
  requestAnimationFrame(() => {
    rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: 'auto' })
    if (colIndex >= 0 && shouldVirtualizeColumns) {
      columnVirtualizerRef.current?.scrollToIndex(colIndex, { align: 'auto' })
    }
    requestAnimationFrame(() => {
      const cellEl = document.querySelector<HTMLElement>(
        `[data-row-index="${rowIndex}"][data-column-id="${columnId}"]`
      )
      cellEl?.focus()
    })
  })
}, [visibleColumnIds, shouldVirtualizeColumns])
```

### VirtualItem Properties (from installed source)
```typescript
// Source: @tanstack/virtual-core/src/index.ts VirtualItem interface
interface VirtualItem {
  key: number | string | bigint   // item key (index by default)
  index: number                    // position in the items array
  start: number                    // pixel offset from start of scroll container
  end: number                      // pixel offset of item end
  size: number                     // item size in px (from estimateSize or measured)
  lane: number                     // lane index (for grid layouts with lanes > 1)
}
```

---

## PERF-04: Incremental Column Fetch — Analysis

The roadmap describes "incremental horizontal column fetch wired to PERF-04." This needs clarification:

**What is NOT needed:** The column definitions (id, name, type, order, isPrimary) are already fetched upfront via `column.getByTableId`. There are typically ≤ 50 columns per table. This fetch is fast (~5ms) and should remain upfront. Column definitions do not need lazy/incremental fetching.

**What IS needed:** The cell data for each row already lives in `rowData.cells` (JSONB blob that contains ALL columns for that row). When a new page of rows is fetched (via `row.getByOffset`), the response includes all cell values for all columns. There is no per-column cell fetch mechanism to add.

**Conclusion:** PERF-04 ("columns are fetched incrementally as the user scrolls horizontally") most likely means the **column definitions** are virtualized — i.e., only rendered in the DOM incrementally — rather than separately fetched from the server. The cell data is already available in the row JSONB blob. No new tRPC procedure or server-side change is needed for PERF-04. It is satisfied purely by the column virtualizer rendering only visible columns.

**If PERF-04 was intended to mean lazy column definition fetching** (e.g., for tables with 200+ columns), a new `column.getByOffset` procedure would be required. But at v1 scale (the roadmap shows 30 columns as the performance target), this is not necessary.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| paddingTop/spacer row for row virtualization | translateY absolute positioning | Phase 04-01 decision | Confirmed working; column virtualizer uses same pattern but horizontal |
| useInfiniteQuery for row pages | ref-based page cache | Phase 04-03 decision | No interaction with column virtualizer — columns are separate |
| Virtual column absolute translateX | Virtual padding spacers (left/right fake `<td>`) | TanStack Table example, current recommendation | Simpler, compatible with existing `display:flex` rows |

**Deprecated/outdated:**
- Column virtualization with `scrollMargin`: Only needed if a sticky left column is outside the scroll area. In this project's layout, the row number column scrolls with the content, so `scrollMargin: 0` (the default) is correct.

---

## Open Questions

1. **PERF-04 interpretation**
   - What we know: Cell data is already in row JSONB; column defs are upfront fetched
   - What's unclear: Whether PERF-04 intended server-side column def pagination for 200+ column tables
   - Recommendation: Treat PERF-04 as satisfied by column virtualizer rendering (no server change needed). Note in PLAN.md that server-side column pagination is deferred if ever needed.

2. **Column resize interaction with virtualizer**
   - What we know: Column widths are hardcoded as `isPrimary ? 200 : 180` in GridView. The `estimateSize` callback is called at virtualizer init and when `measure()` is called.
   - What's unclear: If column resize (drag-to-resize header) is in scope for Phase 7. The ROADMAP mentions "column resize" in the Phase 7 description but not in the success criteria or plan details.
   - Recommendation: Treat column resize as out of scope for Phase 7 (success criteria only mention horizontal scroll without lag and DOM pruning). If it is in scope, column widths would be stored in state and `columnVirtualizer.measure()` called after resize.

3. **Sticky first column (row number + checkbox) with column virtualization**
   - What we know: Currently the row number column has no `position: sticky`. It scrolls off-screen as the user scrolls right. With column virtualization active, the primary data column also scrolls off-screen.
   - What's unclear: Whether Airtable keeps the row number column sticky when scrolling horizontally. (In real Airtable, the row number + first field are sticky.)
   - Recommendation: Do not add CSS sticky for Phase 7. The success criteria only require scroll performance, not sticky column behavior. Sticky column can be Phase 8+ work. Document this decision.

---

## CSS / Layout Impact Summary

The existing grid uses:
- Outer `<table>` with `display: grid; width: fit-content`
- `<thead>` with `display: grid; position: sticky; top: 0`
- `<tbody>` with `display: grid; height: ${totalSize}px; position: relative`
- `<tr>` rows with `display: flex; position: absolute; transform: translateY(...)`
- `<td>` cells with `display: flex; width: W; minWidth: W`

**Column virtualization changes nothing about this CSS layout.** The only change is:
- Inside each `<tr>`, the column loop changes from "all columnIds" to "virtual columns + spacers"
- Inside `<thead>`, the header loop changes from "all headers" to "virtual column headers + spacers"

The `display: flex` on `<tr>` already causes cells to lay out horizontally. Spacer `<td>` elements with the correct width automatically push subsequent columns to the right position. No `translateX` or absolute positioning is needed for individual cells.

---

## Sources

### Primary (HIGH confidence)
- `E:/websites/airtable clone/node_modules/@tanstack/virtual-core/src/index.ts` — Full `VirtualizerOptions` interface, all constructor options, `VirtualItem` interface, `getVirtualItems()`, `getTotalSize()`, `scrollToIndex()` implementation
- `E:/websites/airtable clone/node_modules/@tanstack/react-virtual/src/index.tsx` — React adapter, `useVirtualizer` hook, `useFlushSync`, `flushSync` integration

### Secondary (MEDIUM confidence)
- GitHub TanStack Table `virtualized-columns` example (fetched) — Column virtualizer config pattern, virtual padding spacer pattern, row+column virtualizer combination
- TanStack Virtual GitHub issue #685 (fetched) — Bi-directional scroll lag, `maybeNotify` 400ms issue, open as of v3.13.23 (July 2025 latest comment)
- TanStack Virtual GitHub releases page (fetched) — Confirmed v3.13.23 as current stable (March 16, 2025)
- TanStack Virtual API docs via raw GitHub markdown (fetched) — `scrollMargin` definition, all option descriptions

### Tertiary (LOW confidence)
- TanStack Virtual introduction page — General overview, confirmed headless/no-markup approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified from installed source; `horizontal: true` confirmed in source
- Architecture: HIGH — Virtual padding spacer pattern verified from official TanStack Table example
- Pitfalls: HIGH (GitHub #685) / MEDIUM (others) — #685 verified from GitHub; others derived from codebase analysis

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable library; issue #685 status could change)
