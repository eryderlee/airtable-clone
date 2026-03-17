# Phase 4: Grid Core — Research

**Researched:** 2026-03-17
**Domain:** TanStack Table v8 + TanStack Virtual v3 + tRPC v11 useInfiniteQuery
**Confidence:** HIGH (core patterns verified against official TanStack source code and docs)

---

## Summary

Phase 4 builds the virtualized infinite-scroll grid that renders live data from the database. The three primary technologies are already locked by project decisions: TanStack Table v8 for the table data model, TanStack Virtual v3 (`useVirtualizer`) for row virtualization, and tRPC v11's `useInfiniteQuery` wired to the existing `row.getRows` cursor-paginated procedure.

**Neither `@tanstack/react-table` nor `@tanstack/react-virtual` are currently in package.json.** Both must be installed before any grid work begins.

The canonical approach — confirmed by reading the official TanStack GitHub example source — is: the `<tbody>` gets `position: relative; height: getTotalSize()px`, and each virtual row is `position: absolute; transform: translateY(virtualRow.start)`. The `<table>` and `<thead>` use `display: grid` with the header `position: sticky; top: 0; z-index: 1`. This is **not** the paddingTop/paddingBottom spacer-row pattern — it is the absolute-position + translateY pattern from the official example. The spacer-row pattern exists but is the older approach for `<table>` semantic layouts; the official infinite-scroll example uses translateY.

The existing `InlineEdit` component (built in Phase 3) directly satisfies the column rename requirement. The existing tRPC column router (`column.create`, `column.update`, `column.delete`) and row router (`row.bulkCreate`) cover all column management and bulk insert needs.

**Primary recommendation:** Follow the official TanStack `virtualized-infinite-scrolling` example pattern exactly — this is the most verified path and directly matches the project's requirements.

---

## Standard Stack

### Core (must install — not yet in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `^8.21.3` | Headless table data model (column defs, row model, visibility) | Project-specified; best-in-class headless table for React |
| `@tanstack/react-virtual` | `^3.13.23` | Row virtualization — only visible rows in DOM | Project-specified; official TanStack virtualizer |

### Already in package.json

| Library | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | `^5.50.0` | `useInfiniteQuery` for cursor-paginated data fetching |
| `@trpc/react-query` | `^11.0.0` | `api.row.getRows.useInfiniteQuery()` wrapper |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-virtual` | `react-window` | react-window requires fixed item sizes; TanStack Virtual supports dynamic measurement — use TanStack Virtual |
| `@tanstack/react-table` | Raw DOM table | TanStack Table provides type-safe column defs, visibility toggling (Phase 6), header rendering — worth the abstraction |

### Installation

```bash
npm install @tanstack/react-table @tanstack/react-virtual
```

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   └── grid/
│       ├── GridView.tsx          # "use client" — top-level component, owns data fetching
│       ├── GridTable.tsx         # Pure rendering: useReactTable + useVirtualizer
│       ├── GridHeader.tsx        # Sticky <thead> with column headers + column management
│       ├── GridRow.tsx           # Single virtualized row (tr + cells)
│       └── AddColumnButton.tsx   # Dropdown: add Text or Number column
```

The split between `GridView` (data) and `GridTable` (rendering) keeps the `useInfiniteQuery` scroll logic away from the virtualizer rendering logic, making both easier to test and reason about.

### Pattern 1: Data Fetching — tRPC useInfiniteQuery with cursor pagination

**What:** `api.row.getRows.useInfiniteQuery` with the existing `{rowOrder, id}` cursor shape.

**When to use:** Always — this is the only data-fetching pattern for rows.

```typescript
// Source: https://trpc.io/docs/client/react/useInfiniteQuery + row.getRows procedure contract
const {
  data,
  fetchNextPage,
  isFetching,
  isFetchingNextPage,
  isLoading,
} = api.row.getRows.useInfiniteQuery(
  {
    tableId,
    viewId,
    limit: 100,
    // cursor is NOT in the input here — tRPC injects it automatically from getNextPageParam
  },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialCursor: undefined,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData, // from @tanstack/react-query v5
  },
);

// Flatten pages into a single array for TanStack Table
const flatRows = React.useMemo(
  () => data?.pages.flatMap((page) => page.items) ?? [],
  [data],
);
```

**Key facts:**
- tRPC `useInfiniteQuery` automatically passes the cursor from `getNextPageParam` into the procedure's `cursor` input field
- The cursor field is omitted from the first argument — tRPC handles injection
- `getNextPageParam` returns `null` when `row.getRows` returns `nextCursor: null` → `hasNextPage` becomes false
- `keepPreviousData` is imported from `@tanstack/react-query` v5 (not from tRPC); it is passed as `placeholderData`
- `initialCursor: undefined` is the correct value for "no starting cursor" (start from the beginning)

### Pattern 2: Scroll-based fetchNextPage Trigger

**What:** `onScroll` handler on the scroll container that calls `fetchNextPage` when within 500px of bottom.

**When to use:** Always — replaces IntersectionObserver for better reliability in virtualized containers.

```typescript
// Source: official TanStack virtualized-infinite-scrolling example
const fetchMoreOnBottomReached = React.useCallback(
  (containerRef?: HTMLDivElement | null) => {
    if (containerRef) {
      const { scrollHeight, scrollTop, clientHeight } = containerRef;
      if (
        scrollHeight - scrollTop - clientHeight < 500 &&
        !isFetching &&
        flatRows.length < totalRowCount
      ) {
        void fetchNextPage();
      }
    }
  },
  [fetchNextPage, isFetching, flatRows.length, totalRowCount],
);

// Check on mount (table may already be short enough to need data immediately)
React.useEffect(() => {
  fetchMoreOnBottomReached(tableContainerRef.current);
}, [fetchMoreOnBottomReached]);
```

### Pattern 3: TanStack Table in Manual Mode

**What:** `useReactTable` with `manualSorting`, `manualFiltering`, and no server pagination model. Sorting/filtering are handled by tRPC procedure params, not the table library.

**When to use:** Always for this project — all sort/filter/search is DB-level.

```typescript
// Source: official TanStack virtualized-infinite-scrolling example + manual mode docs
const table = useReactTable({
  data: flatRows,   // all fetched rows flattened — not paginated
  columns,          // built dynamically from column definitions
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  // getSortedRowModel / getFilteredRowModel are NOT included — all DB-level
});

const { rows } = table.getRowModel();
```

### Pattern 4: Dynamic Column Definitions from JSONB cells

**What:** Column defs are built from the `column.getByTableId` result, with each column's `accessorFn` reading `row.cells[col.id]`.

**Why:** The data model is `rows.cells: Record<columnId, string | number | null>`. TanStack Table expects column-level accessors.

```typescript
// Source: TanStack Table ColumnDef API docs + project schema
const columns = React.useMemo<ColumnDef<typeof flatRows[0]>[]>(
  () =>
    columnDefs.map((col) => ({
      id: col.id,
      header: col.name,
      accessorFn: (row) => row.cells[col.id] ?? null,
      size: col.type === "number" ? 120 : 200,
      meta: { type: col.type }, // available as cell.column.columnDef.meta.type in Phase 5
    })),
  [columnDefs],
);
```

**Important:** When `columnDefs` changes (add/rename/delete column), the `useMemo` recomputes. TanStack Table handles this gracefully — no need to reset.

### Pattern 5: useVirtualizer — Absolute Position (translateY) Pattern

**What:** The official TanStack approach for virtualized tables with sticky headers. `<tbody>` is sized to `getTotalSize()` via fixed height and `position: relative`; each row is `position: absolute` offset by `translateY(virtualRow.start)`.

**When to use:** Always — this is the canonical pattern from the official example. Do NOT use paddingTop/paddingBottom spacer rows for this use case.

```typescript
// Source: https://raw.githubusercontent.com/TanStack/table/main/examples/react/virtualized-infinite-scrolling/src/main.tsx
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  estimateSize: () => 32, // Airtable short row = ~32px
  getScrollElement: () => tableContainerRef.current,
  measureElement:
    typeof window !== "undefined" &&
    navigator.userAgent.indexOf("Firefox") === -1
      ? (element) => element?.getBoundingClientRect().height
      : undefined,
  overscan: 5,
});

// Rendering pattern:
// <div ref={tableContainerRef} style={{ overflow: 'auto', position: 'relative', height: '100%' }}>
//   <table style={{ display: 'grid' }}>
//     <thead style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 1 }}>
//       ...headers...
//     </thead>
//     <tbody style={{
//       display: 'grid',
//       height: `${rowVirtualizer.getTotalSize()}px`,
//       position: 'relative',
//     }}>
//       {rowVirtualizer.getVirtualItems().map((virtualRow) => {
//         const row = rows[virtualRow.index];
//         return (
//           <tr
//             key={row.id}
//             data-index={virtualRow.index}
//             ref={(node) => rowVirtualizer.measureElement(node)}
//             style={{
//               display: 'flex',
//               position: 'absolute',
//               transform: `translateY(${virtualRow.start}px)`,
//               width: '100%',
//             }}
//           >
//             ...cells...
//           </tr>
//         );
//       })}
//     </tbody>
//   </table>
// </div>
```

**Critical:** `display: grid` on `<table>` and `<thead>` is required for sticky headers + virtual row layout to work together. This overrides native HTML table layout.

### Pattern 6: Column Management — Reuse InlineEdit

**What:** Column renaming on double-click reuses the existing `InlineEdit` component from Phase 3.

```typescript
// src/components/grid/GridHeader.tsx
import { InlineEdit } from "~/components/ui/InlineEdit";

// In column header cell:
<InlineEdit
  value={header.column.columnDef.header as string}
  onSave={(newName) => {
    renameColumn.mutate({ id: col.id, name: newName });
  }}
/>
```

The `InlineEdit` component already handles: double-click to enter edit mode, Enter to save, Escape to cancel, blur to save, empty validation.

### Anti-Patterns to Avoid

- **Using `getSortedRowModel()` or `getFilteredRowModel()`:** All sorting and filtering is DB-level via tRPC. Including these row models wastes CPU and produces incorrect results (operates on locally-fetched rows, not all DB rows).
- **Using `display: table` with `position: absolute` rows:** Native table layout and absolute positioning are incompatible. The `display: grid` override on `<table>` is required.
- **Fetching all rows at once:** The `row.getRows` procedure returns 100 rows per page by default. Never pass `limit: 1000000`.
- **Invalidating `row.getRows` after bulkCreate:** This would discard all fetched pages. Instead, use `utils.row.getRows.invalidate()` which resets to page 1 — acceptable because the user just added 100k rows.
- **Using `display: table-row` on virtual rows:** Breaks translateY positioning. Use `display: flex` on `<tr>` as shown in the official example.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row virtualization | Custom windowing logic | `useVirtualizer` from `@tanstack/react-virtual` | Handles dynamic heights, overscan, scroll position restoration, Firefox quirks |
| Table column model | Manual DOM column tracking | `useReactTable` from `@tanstack/react-table` | Type-safe column defs, visibility state (needed Phase 6), header group rendering |
| Infinite cursor pagination | Manual cursor state | `api.row.getRows.useInfiniteQuery` | tRPC auto-injects cursor, handles caching, deduplication, background refetch |
| Column rename inline edit | New input toggle | `InlineEdit` from `~/components/ui/InlineEdit` | Already built in Phase 3 with double-click, Enter, Escape, blur handling |
| Scroll threshold detection | IntersectionObserver | `onScroll` + `scrollHeight - scrollTop - clientHeight < 500` | IntersectionObserver is unreliable inside virtualized scroll containers; the onScroll pattern is what the official example uses |

**Key insight:** TanStack Table without any row models (no sort/filter/pagination model) is essentially free — it provides typed column definitions and the header/cell render API. The value is in column defs + `getRowModel()`, not in client-side data processing.

---

## Common Pitfalls

### Pitfall 1: Missing `display: grid` on table/thead

**What goes wrong:** Sticky `<thead>` disappears on scroll, or rows don't position correctly.
**Why it happens:** `position: sticky` requires the scrolling ancestor to have `overflow: auto/scroll`. Native `<table>` layout creates an implicit stacking context that fights sticky positioning.
**How to avoid:** Apply `style={{ display: 'grid' }}` to both `<table>` and `<thead>`. Apply `style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 1 }}` to `<thead>`.
**Warning signs:** Header disappears during scroll; rows overlap header.

### Pitfall 2: Firefox measureElement bug

**What goes wrong:** Dynamic row height measurement returns incorrect values in Firefox (measures table border height instead of row height).
**Why it happens:** Firefox computes `getBoundingClientRect().height` differently for table rows with borders.
**How to avoid:** Conditionally disable `measureElement` in Firefox. Use the exact guard from the official example: `navigator.userAgent.indexOf("Firefox") === -1`.
**Warning signs:** Row heights wrong in Firefox; scroll position jumps in Firefox.

### Pitfall 3: Cursor type mismatch in useInfiniteQuery

**What goes wrong:** tRPC type error or runtime error because the cursor field is included in the first argument of `useInfiniteQuery`.
**Why it happens:** tRPC `useInfiniteQuery` auto-injects the `cursor` from `getNextPageParam` — you must NOT include `cursor` in the input object.
**How to avoid:** The first argument to `api.row.getRows.useInfiniteQuery()` must NOT contain a `cursor` key. tRPC handles cursor injection automatically.
**Warning signs:** TypeScript error "cursor is required"; cursor always undefined.

### Pitfall 4: keepPreviousData import — v5 change

**What goes wrong:** `keepPreviousData` was removed as a direct option in React Query v5.
**Why it happens:** v5 merged `keepPreviousData` functionality into `placeholderData` option.
**How to avoid:** Import `keepPreviousData` as a function from `@tanstack/react-query` and pass it as `placeholderData: keepPreviousData` (not as a standalone boolean option).

```typescript
import { keepPreviousData } from "@tanstack/react-query";
// ...
placeholderData: keepPreviousData,
```

**Warning signs:** TypeScript error "keepPreviousData is not a valid option"; stale data not shown during refetch.

### Pitfall 5: Column defs not memoized

**What goes wrong:** `useReactTable` re-renders on every scroll event because `columns` prop is a new array each render.
**Why it happens:** Column defs built from `columnDefs` array without `useMemo`.
**How to avoid:** Always wrap column def construction in `React.useMemo(..., [columnDefs])`.
**Warning signs:** Performance degradation with many rows; profiler shows table re-creating on scroll.

### Pitfall 6: tableContainerRef height must be fixed

**What goes wrong:** Virtualization doesn't work — all rows render, or no rows render.
**Why it happens:** `useVirtualizer` needs a scroll container with a fixed/constrained height. If the container expands to fit content, scrolling never occurs and the virtualizer cannot calculate viewport size.
**How to avoid:** The scroll container `<div>` must have `overflow: 'auto'` and a constrained height. The existing layout already provides `flex flex-1 overflow-hidden` on `<main>` — the grid component must fill this with `height: 100%` or `flex: 1`.
**Warning signs:** All rows render simultaneously; `rowVirtualizer.getVirtualItems()` returns all items.

### Pitfall 7: Column delete leaves orphaned JSONB data

**What goes wrong:** After deleting a column, existing rows still have the deleted column's key in their `cells` JSONB object. This wastes storage but doesn't cause errors in the current schema.
**Why it happens:** The column router deletes the column record but doesn't update `rows.cells` JSONB.
**How to avoid:** This is acceptable for Phase 4 — document it as known technical debt. A Phase 8 migration or Postgres trigger can clean orphaned JSONB keys. Do NOT add cleanup logic in Phase 4.
**Warning signs:** `cells` objects contain keys for non-existent column IDs (benign for now).

---

## Code Examples

### Complete GridView component skeleton

```typescript
// Source: official TanStack virtualized-infinite-scrolling example + tRPC docs
"use client";

import React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "~/trpc/react";

interface GridViewProps {
  tableId: string;
  viewId: string;
}

export function GridView({ tableId, viewId }: GridViewProps) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // 1. Fetch column definitions
  const { data: columnDefs = [] } = api.column.getByTableId.useQuery({ tableId });

  // 2. Infinite row query
  const { data, fetchNextPage, isFetching, isLoading } =
    api.row.getRows.useInfiniteQuery(
      { tableId, viewId, limit: 100 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
      },
    );

  const flatRows = React.useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // 3. Scroll-based fetchNextPage trigger
  const fetchMoreOnBottomReached = React.useCallback(
    (container?: HTMLDivElement | null) => {
      if (container && !isFetching) {
        const { scrollHeight, scrollTop, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < 500) {
          void fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching],
  );

  React.useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current);
  }, [fetchMoreOnBottomReached]);

  // 4. Dynamic column defs from JSONB schema
  const columns = React.useMemo<ColumnDef<(typeof flatRows)[0]>[]>(
    () =>
      columnDefs.map((col) => ({
        id: col.id,
        header: col.name,
        accessorFn: (row) => row.cells[col.id] ?? null,
        size: col.type === "number" ? 120 : 200,
      })),
    [columnDefs],
  );

  // 5. TanStack Table in manual mode
  const table = useReactTable({
    data: flatRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });

  const { rows } = table.getRowModel();

  // 6. Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 32,
    getScrollElement: () => tableContainerRef.current,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
      style={{ overflow: "auto", position: "relative", height: "100%", flex: 1 }}
    >
      <table style={{ display: "grid" }}>
        <thead style={{ display: "grid", position: "sticky", top: 0, zIndex: 1 }}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ display: "flex", width: header.getSize() }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          style={{
            display: "grid",
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                ref={(node) => rowVirtualizer.measureElement(node)}
                style={{
                  display: "flex",
                  position: "absolute",
                  transform: `translateY(${virtualRow.start}px)`,
                  width: "100%",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ display: "flex", width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isFetching && <div>Loading more...</div>}
    </div>
  );
}
```

### Column rename using InlineEdit

```typescript
// In GridHeader.tsx
import { InlineEdit } from "~/components/ui/InlineEdit";
const utils = api.useUtils();
const renameColumn = api.column.update.useMutation({
  onSuccess: () => utils.column.getByTableId.invalidate({ tableId }),
});

// In header cell render:
<InlineEdit
  value={col.name}
  onSave={(newName) => renameColumn.mutate({ id: col.id, name: newName })}
/>
```

### Add 100k rows button with loading state

```typescript
const utils = api.useUtils();
const bulkCreate = api.row.bulkCreate.useMutation({
  onSuccess: () => {
    // Invalidate resets infinite query to page 1 — correct behavior
    void utils.row.getRows.invalidate({ tableId });
  },
});

<button
  onClick={() => bulkCreate.mutate({ tableId, count: 100000 })}
  disabled={bulkCreate.isPending}
>
  {bulkCreate.isPending ? "Adding rows..." : "Add 100k rows"}
</button>
```

### Row count for fetchNextPage guard

```typescript
// totalRowCount must come from somewhere — currently row.getRows does NOT return totalCount
// For Phase 4, use hasNextPage from useInfiniteQuery instead of row count comparison:
const { hasNextPage } = api.row.getRows.useInfiniteQuery(...);

// Revised fetchMoreOnBottomReached:
if (scrollHeight - scrollTop - clientHeight < 500 && !isFetching && hasNextPage) {
  void fetchNextPage();
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `paddingTop`/`paddingBottom` spacer rows | `position: absolute; transform: translateY()` on each row | TanStack Virtual v3 (the translateY pattern is the official example approach) | Simpler code; no spacer row DOM noise; works with dynamic heights |
| `keepPreviousData: true` option | `placeholderData: keepPreviousData` function | React Query v5 | Must import `keepPreviousData` function from `@tanstack/react-query` |
| `useContext()` for tRPC utils | `api.useUtils()` | tRPC v11 (project decision 03-02) | `useContext` removed in this project's pattern; use `api.useUtils()` |
| `initialPageParam: 0` (number) | `initialCursor: undefined` (via tRPC wrapper) | tRPC's `useInfiniteQuery` abstraction | tRPC wrapper uses `initialCursor` option, not `initialPageParam` directly |

**Deprecated/outdated:**
- `getSortedRowModel()` / `getFilteredRowModel()` in this project: not applicable; all data operations are DB-level
- `getServerSideRowCount()`: not needed — `hasNextPage` from `useInfiniteQuery` is sufficient for scroll trigger

---

## Open Questions

1. **totalRowCount for scroll trigger guard**
   - What we know: The `row.getRows` procedure does not return a `totalCount` field — only `{ items, nextCursor }`. The official TanStack example uses `totalDBRowCount` to guard `fetchNextPage`.
   - What's unclear: Should we add `totalCount` to `row.getRows`, or use `hasNextPage` alone?
   - Recommendation: Use `hasNextPage` from `useInfiniteQuery` as the guard — `hasNextPage` is true when `getNextPageParam` returns non-null. This avoids a `COUNT(*)` query (expensive at 1M rows) and is the correct pattern for pure cursor pagination. **Do not add `totalCount` to the procedure.**

2. **Row number column (Airtable's leftmost # column)**
   - What we know: Airtable shows a row number column as the first column.
   - What's unclear: Should Phase 4 include a row number column, or is it deferred?
   - Recommendation: Include a row number column using `virtualRow.index + 1` as the display value (not a DB column). This is a display-only concern that can be added as a static first column def.

3. **Column width for the grid**
   - What we know: The official example uses `header.getSize()` and `cell.column.getSize()`, set via `size` in column defs.
   - What's unclear: Should column widths be stored in the `columns` table or hardcoded?
   - Recommendation: Hardcode for Phase 4 (`text: 200px, number: 120px`). Column resizing is Phase 7.

4. **Query key structure for row invalidation**
   - What we know: After `bulkCreate` or column add/delete, `utils.row.getRows.invalidate({ tableId })` resets to page 1.
   - What's unclear: Does partial invalidation with `{ tableId }` work correctly when `viewId`, `filters`, etc. are also in the query key?
   - Recommendation: Use `utils.row.getRows.invalidate({ tableId })` — tRPC matches on the fields you provide; all queries for this tableId will be invalidated regardless of other input fields.

---

## Sources

### Primary (HIGH confidence)

- **Official TanStack example source** (raw GitHub): `https://raw.githubusercontent.com/TanStack/table/main/examples/react/virtualized-infinite-scrolling/src/main.tsx` — complete working code for TanStack Table + Virtual + React Query infinite scroll; the patterns in Code Examples above are directly derived from this file
- **tRPC useInfiniteQuery docs**: `https://trpc.io/docs/client/react/useInfiniteQuery` — confirmed cursor field name, `initialCursor` option, `getNextPageParam` pattern, return shape `{ items, nextCursor }`
- **TanStack Virtual API docs**: `https://tanstack.com/virtual/latest/docs/api/virtualizer` — confirmed `paddingStart`, `paddingEnd`, `overscan`, `scrollPaddingStart`, `measureElement`, `getVirtualItems`, `getTotalSize`, `scrollToIndex` options

### Secondary (MEDIUM confidence)

- **React Query v5 keepPreviousData migration**: WebSearch confirmed via multiple sources that `keepPreviousData` is now a function imported from `@tanstack/react-query` and passed as `placeholderData`
- **Firefox measureElement bug**: WebSearch + GitHub issues confirmed that `navigator.userAgent.indexOf("Firefox") === -1` guard is the established workaround; appears in the official example
- **TanStack Table display:grid sticky header pattern**: WebSearch + dev.to article confirmed that `display: grid` on `<table>` and `position: sticky` on `<thead>` is the correct approach

### Tertiary (LOW confidence)

- Specific pixel dimensions for Airtable-accurate row height (32px): estimated from Airtable's "short" row height setting; use Playwright MCP during implementation to verify exact measurement
- `@tanstack/react-table` version `8.21.3` / `@tanstack/react-virtual` version `3.13.23`: from npm search results; verify with `npm install` to get the latest

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — libraries confirmed; versions from npm (run `npm install` to get latest)
- Architecture: HIGH — core pattern is direct read from official GitHub example source
- tRPC integration: HIGH — verified against official tRPC docs for `createTRPCReact` pattern (not `useTRPC`)
- Pitfalls: HIGH — Firefox bug is in the official example; other pitfalls are from official docs and GitHub issues
- Airtable pixel-accuracy: LOW — exact CSS dimensions require Playwright MCP inspection during 04-03

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (TanStack Table/Virtual are stable; React Query v5 API is stable)

**Critical finding for planner:**
`@tanstack/react-table` and `@tanstack/react-virtual` are NOT in `package.json`. Plan 04-01 must begin with `npm install @tanstack/react-table @tanstack/react-virtual`.
