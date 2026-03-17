# Phase 6: Toolbar — Research

**Researched:** 2026-03-17
**Domain:** tRPC offset-based pagination with filter/sort/search; React popover/panel UI patterns
**Confidence:** HIGH (all findings verified against actual source code in this repository)

---

## Summary

Phase 6 adds search, filter, sort, and hide-fields functionality to the toolbar. The critical architectural question flagged in the phase brief — "does `getByOffset` support filter/sort/search?" — has a clear answer from reading the source code: **no, `getByOffset` does not currently support any of these.** The existing `getRows` procedure has full filter/sort/search support already implemented, but `getByOffset` (used by the current grid) only accepts `{ tableId, offset, limit }`.

The core work of this phase is therefore **extending `getByOffset` to accept the same filter/sort/search params that `getRows` already supports**, then wiring those params through `GridView` → `fetchPage` → `utils.row.getByOffset.fetch()`. The `row.count` procedure also needs filter/sort/search params so the virtualizer's total row count reflects the filtered set, not the unfiltered set.

All the query-building logic — `buildFilterConditions()`, `buildSortOrder()`, schema types (`FilterCondition`, `SortCondition`), and the view config merge pattern — already exists in `row.ts`. The extension is primarily mechanical: copy the input schema fields and query-building calls from `getRows` into `getByOffset`.

The UI panels (filter builder, sort builder, hide fields) should be implemented as inline panels that appear below the toolbar (Airtable's pattern), not as floating modals. The search bar expands inline in the toolbar. No new dependencies are needed — all UI is plain React with Tailwind. `useDebounce` for the 300ms search debounce can be hand-rolled as a simple `useEffect`/`setTimeout` pattern (it is a 5-line utility, no library needed).

**Primary recommendation:** Extend `getByOffset` and `row.count` to accept `filters`, `sorts`, and `searchQuery`; store active state in `GridView` as `useState`; clear and refetch the page cache whenever any of these change; implement panels as controlled open/close divs below the toolbar.

---

## Standard Stack

No new npm packages are required. Everything needed is already installed.

### Already Installed — No New Installs

| Library | Version | Purpose | How Used in Phase 6 |
|---------|---------|---------|---------------------|
| `@tanstack/react-query` | `^5.50.0` | Cache invalidation | `utils.row.getByOffset.fetch()` calls with new params |
| `@trpc/react-query` | `^11.0.0` | tRPC procedures | `api.row.count`, `api.view.updateConfig`, `api.view.getByTableId` |
| `zod` | `^3.23.8` | Input validation | Already used in row router schemas |
| `tailwindcss` | `^3.4.3` | Panel/popover styling | Filter builder, sort builder, hide fields panels |

### No New Installs Required

```bash
# Phase 6 requires no new npm packages
# All dependencies are available from Phases 1-5
```

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── server/api/routers/
│   └── row.ts                    # MODIFY: extend getByOffset + count with filter/sort/search
├── components/grid/
│   ├── GridView.tsx              # MODIFY: add filter/sort/search/hiddenColumns state; pass to fetchPage
│   ├── GridToolbar.tsx           # MODIFY: wire toolbar buttons to open panels; pass active state for badge counts
│   ├── GridTable.tsx             # MODIFY: accept hiddenColumns prop, filter columnIds passed to render
│   ├── toolbar/
│   │   ├── SearchBar.tsx         # NEW: search input with 300ms debounce
│   │   ├── FilterPanel.tsx       # NEW: add/remove filter conditions
│   │   ├── SortPanel.tsx         # NEW: add/remove sort rules
│   │   └── HideFieldsPanel.tsx   # NEW: toggle column visibility checkboxes
```

### Pattern 1: Extending getByOffset in the Router

**What:** Copy the filter/sort/search input schema fields and query-building calls from `getRows` into `getByOffset`. The `buildFilterConditions` and `buildSortOrder` helpers are already defined at the top of `row.ts` and can be reused directly.

**Critical difference from getRows:** `getByOffset` uses `rowOrder >= offset` for the seek instead of a cursor comparison. With active sorts, the `rowOrder` seek is meaningless — sort order no longer matches `rowOrder` order. When sorts are active, `getByOffset` must fall back to true SQL `OFFSET` (the standard approach). When no sorts are active, the existing `rowOrder >= offset` seek is correct and fast.

**When to use:** Always — `getByOffset` is the only row-fetching path the grid uses.

```typescript
// In row.ts — extended getByOffset input schema
getByOffset: protectedProcedure
  .input(
    z.object({
      tableId: z.string().uuid(),
      offset: z.number().int().min(0),
      limit: z.number().int().min(1).max(500).default(100),
      // NEW fields (all optional with defaults so existing callers still work)
      filters: z.array(filterConditionSchema).default([]),
      sorts: z.array(sortConditionSchema).default([]),
      searchQuery: z.string().default(""),
    }),
  )
  .query(async ({ ctx, input }) => {
    // ... ownership check unchanged ...

    // Build WHERE conditions
    const conditions: SQL[] = [eq(rows.tableId, input.tableId)];

    // Filter conditions (reuse existing helper)
    const filterClauses = buildFilterConditions(input.filters);
    conditions.push(...filterClauses);

    // Search
    if (input.searchQuery.trim()) {
      conditions.push(
        sql`${rows.cells}::text ilike ${"%" + input.searchQuery + "%"}`,
      );
    }

    // Sort
    let columnTypeMap: Record<string, string> = {};
    if (input.sorts.length > 0) {
      const cols = await ctx.db
        .select({ id: columns.id, type: columns.type })
        .from(columns)
        .where(eq(columns.tableId, input.tableId));
      columnTypeMap = Object.fromEntries(cols.map((c) => [c.id, c.type]));
    }
    const orderClauses = buildSortOrder(input.sorts, columnTypeMap);

    // Offset strategy: when sorts are active, rowOrder seek is invalid.
    // Use true SQL OFFSET. When no sorts, keep the fast rowOrder seek.
    let query;
    if (input.sorts.length === 0 && input.filters.length === 0 && !input.searchQuery.trim()) {
      // Fast path: existing seek using rowOrder >= offset
      conditions.push(sql`${rows.rowOrder} >= ${input.offset}`);
      query = ctx.db
        .select()
        .from(rows)
        .$dynamic()
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(input.limit);
    } else {
      // General path: true SQL OFFSET (required when sort order != rowOrder order)
      query = ctx.db
        .select()
        .from(rows)
        .$dynamic()
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(input.limit)
        .offset(input.offset);
    }

    const items = await query;
    return { items };
  }),
```

**Note on performance:** SQL OFFSET degrades on large unfiltered tables (O(n) scan). But when filters or sorts are active, the result set is typically smaller, mitigating this. For the project's current scope this is acceptable. The rowOrder-seek fast path is preserved for the common case (no active filters/sorts).

### Pattern 2: Extending row.count to Accept Filters/Search

**What:** `row.count` currently does `COUNT(*) WHERE tableId = ?`. When filters/search are active, the virtualizer must be sized to the filtered count. Otherwise a 10-row filtered result still shows 100k scroll height.

```typescript
// In row.ts — extended count input schema
count: protectedProcedure
  .input(
    z.object({
      tableId: z.string().uuid(),
      // NEW fields
      filters: z.array(filterConditionSchema).default([]),
      searchQuery: z.string().default(""),
    }),
  )
  .query(async ({ ctx, input }) => {
    // ... ownership check unchanged ...

    const conditions: SQL[] = [eq(rows.tableId, input.tableId)];

    const filterClauses = buildFilterConditions(input.filters);
    conditions.push(...filterClauses);

    if (input.searchQuery.trim()) {
      conditions.push(
        sql`${rows.cells}::text ilike ${"%" + input.searchQuery + "%"}`,
      );
    }

    const [result] = await ctx.db
      .select({ count: count() })
      .from(rows)
      .$dynamic()
      .where(and(...conditions));

    return { count: Number(result?.count ?? 0) };
  }),
```

**Note:** Sorts do not affect count, so `sorts` is not needed in the count input.

### Pattern 3: Filter/Sort/Search State in GridView

**What:** The active toolbar state lives in `GridView` as `useState`. When any value changes, the page cache is cleared and page 0 is re-fetched. The count query receives the same filter/search params so the virtualizer height is correct.

```typescript
// In GridView.tsx
import type { FilterCondition, SortCondition } from "~/server/api/routers/row";

const [filters, setFilters] = useState<FilterCondition[]>([]);
const [sorts, setSorts] = useState<SortCondition[]>([]);
const [searchQuery, setSearchQuery] = useState("");
const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

// Pass to count query so virtualizer size reflects filtered rows
const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
  { tableId, filters, searchQuery },
  { staleTime: 30_000 },
);

// Cache invalidation helper — call whenever filter/sort/search changes
const resetCache = useCallback(() => {
  pageCacheRef.current = {};
  loadingPagesRef.current = new Set();
  forceUpdate();
}, []);

// fetchPage must close over current filter/sort/search values
const fetchPage = useCallback(
  async (pageIndex: number) => {
    if (pageCacheRef.current[pageIndex] !== undefined) return;
    if (loadingPagesRef.current.has(pageIndex)) return;
    loadingPagesRef.current.add(pageIndex);
    forceUpdate();
    try {
      const data = await utils.row.getByOffset.fetch({
        tableId,
        offset: pageIndex * PAGE_SIZE,
        limit: PAGE_SIZE,
        filters,
        sorts,
        searchQuery,
      });
      pageCacheRef.current[pageIndex] = data.items.map((r) => ({
        id: r.id,
        cells: r.cells as Record<string, string | number | null>,
      }));
    } finally {
      loadingPagesRef.current.delete(pageIndex);
      forceUpdate();
    }
  },
  [tableId, utils.row.getByOffset, filters, sorts, searchQuery],
);

// Clear cache + reload when filter/sort/search changes
useEffect(() => {
  resetCache();
  void refetchCount();
  if (totalCount > 0 || filters.length > 0 || sorts.length > 0 || searchQuery) {
    void fetchPage(0);
  }
}, [filters, sorts, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Critical:** `fetchPage` closes over `filters`, `sorts`, `searchQuery`. When these change, the `useEffect` fires, `resetCache()` clears the old pages, and `fetchPage(0)` fetches with the new params. TanStack Query deduplicates requests so a double-fetch won't happen.

### Pattern 4: 300ms Search Debounce

**What:** The search input shows a text box that appears when the search button is clicked. The `searchQuery` state update is debounced by 300ms to avoid issuing a database query on every keystroke.

```typescript
// In GridView.tsx (or SearchBar.tsx, returning debouncedValue up to GridView)
const [searchInput, setSearchInput] = useState(""); // immediate input value
const [searchQuery, setSearchQuery] = useState(""); // debounced, drives query

useEffect(() => {
  const timer = setTimeout(() => {
    setSearchQuery(searchInput);
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

**Alternative:** The search input local state (`searchInput`) lives in `SearchBar.tsx`, the debounced value is lifted to `GridView` via an `onSearch` callback that receives the debounced value. This keeps `GridView` cleaner.

### Pattern 5: Hidden Columns

**What:** `hiddenColumns` is a `string[]` of column IDs that should not be rendered. This is pure client-side filtering — hidden columns are excluded from the `columnIds` array passed to `GridTable`. The data is still fetched (all columns are in the JSONB cells object), only rendering is filtered.

```typescript
// In GridView.tsx
const visibleColumnIds = useMemo(
  () => columnIds.filter((id) => !hiddenColumns.includes(id)),
  [columnIds, hiddenColumns],
);

// Pass visibleColumnIds to GridTable instead of columnIds
```

**Note:** `hiddenColumns` can optionally be persisted to the view config via `view.updateConfig`. For Phase 6, persisting to the view is desirable so that hidden columns survive a page reload.

### Pattern 6: Panel UI — Inline Below Toolbar

**What:** Airtable renders filter/sort/hide-fields as panels that appear directly below the toolbar bar, overlaying the grid. They are NOT modal dialogs — they are absolutely-positioned divs that close when clicked outside.

**Implementation:** Each panel is a controlled `isOpen` boolean in `GridToolbar` (or `GridView`). When open, a `<div>` is rendered with `position: absolute; top: 44px; z-index: 50` below the toolbar. The panel can be a simple stacked form UI.

```typescript
// In GridToolbar.tsx
const [openPanel, setOpenPanel] = useState<"filter" | "sort" | "hideFields" | "search" | null>(null);

const togglePanel = (panel: "filter" | "sort" | "hideFields" | "search") => {
  setOpenPanel((prev) => (prev === panel ? null : panel));
};

// Panel container — absolutely positioned below toolbar
{openPanel === "filter" && (
  <div className="absolute top-[44px] left-0 right-0 z-50 bg-white border-b border-[#e2e0ea] shadow-md p-4">
    <FilterPanel ... />
  </div>
)}
```

**Click-outside close:** Use a `useEffect` that adds a `mousedown` listener to `document`. If the click target is outside the panel and toolbar button, close the panel.

### Pattern 7: Toolbar Badge Counts

**What:** The Filter and Sort buttons show a badge with the count of active conditions (e.g., "Filter (2)", "Sort (1)"). This is a simple derived value from the `filters.length` and `sorts.length` arrays.

```typescript
// In GridToolbar.tsx or GridView.tsx
function ToolbarButton({ icon, label, badgeCount, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1.5 text-[13px] hover:bg-[#edf0f4]
        ${isActive ? "bg-[#edf0f4] text-[#166ee1]" : "text-[#4c5667]"}`}
    >
      {icon}
      {label}
      {badgeCount > 0 && (
        <span className="ml-0.5 rounded-full bg-[#166ee1] px-1.5 py-0.5 text-[10px] font-medium text-white">
          {badgeCount}
        </span>
      )}
    </button>
  );
}
```

### Pattern 8: Filter Panel UI Structure

**What:** The filter panel allows adding conditions. Each condition row has: a column picker (dropdown), an operator picker (dropdown), and a value input. The column picker determines available operators.

```
┌─────────────────────────────────────────────────────────────────┐
│ Where                                                [+ Add filter]│
│  [Name ▼] [contains ▼]  [_____________]              [×]        │
│  [Status ▼] [equals ▼]  [_____________]              [×]        │
└─────────────────────────────────────────────────────────────────┘
```

Text operators: contains, does not contain, equals, is empty, is not empty
Number operators: greater than, less than

The `is_empty` and `is_not_empty` operators have no value input — hide the value field for these operators.

### Pattern 9: Sort Panel UI Structure

**What:** The sort panel allows adding sort rules. Each rule has a column picker and direction toggle.

```
┌──────────────────────────────────────────────────────────────┐
│ Sort by                                          [+ Add sort] │
│  [Name ▼]    [A → Z ▼]                            [×]       │
│  [Status ▼]  [Z → A ▼]                            [×]       │
└──────────────────────────────────────────────────────────────┘
```

Direction options per column type:
- Text: "A → Z" (asc) / "Z → A" (desc)
- Number: "1 → 9" (asc) / "9 → 1" (desc)

### Anti-Patterns to Avoid

- **Extending `getRows` instead of `getByOffset`:** The grid uses `getByOffset`, not `getRows`. Wiring filters to `getRows` would require replacing the entire page-cache architecture.
- **Not clearing the page cache on filter change:** Stale cached pages from the previous filter will appear briefly with wrong data. Always `pageCacheRef.current = {}` before the new fetch.
- **Sizing the virtualizer to unfiltered count:** With 100k rows and a 10-row filter result, the scroll height would show 100k rows. Always pass `filters` and `searchQuery` to the count query.
- **Floating modal for filter/sort panels:** Airtable uses inline panels below the toolbar. Modal dialogs would be non-standard for this UI.
- **Installing a debounce library:** A `useEffect`/`setTimeout` debounce is 5 lines. No library needed.
- **Persisting hiddenColumns to the view on every toggle:** Persist on panel close, not on every checkbox toggle, to avoid rapid mutations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter query builder | Custom SQL string concat | `buildFilterConditions()` already in `row.ts` | Already handles all 7 operators with proper JSONB extraction |
| Sort query builder | Custom ORDER BY logic | `buildSortOrder()` already in `row.ts` | Already handles text vs numeric CAST, nulls-last, tie-breaker |
| Debounce hook | npm debounce library | `useEffect` + `setTimeout` pattern | 5 lines; no dependency needed |
| JSONB text search | Custom cell iteration | `cells::text ilike '%query%'` in `getRows` | Already implemented; copy pattern to `getByOffset` |
| View config persistence | Custom state manager | `api.view.updateConfig.useMutation` | Already implemented in `view.ts` with partial merge |

**Key insight:** All SQL-level logic for filter/sort/search already exists in `row.ts`. The extension is mechanical — copy schemas and helpers into `getByOffset`. The UI panels are plain React with no library needed.

---

## Common Pitfalls

### Pitfall 1: fetchPage Closure Captures Stale Filter/Sort/Search

**What goes wrong:** After setting new filters, `fetchPage` still runs with the old empty filters because it closed over the old values.
**Why it happens:** `fetchPage` is a `useCallback` that depends on `[tableId, utils.row.getByOffset, filters, sorts, searchQuery]`. When filters change, a new `fetchPage` is created — but the `useEffect` that watches `[filters, sorts, searchQuery]` must explicitly trigger, clear the cache, and call `fetchPage(0)`.
**How to avoid:** Ensure the `useEffect` dependency array includes `filters`, `sorts`, `searchQuery`, AND that `fetchPage` is recreated (via its own dependency array) before the effect runs. React guarantees that `useEffect` callbacks see the current closure values as long as dependencies are correct.
**Warning signs:** Filter is applied in the count query (row count changes correctly) but the grid still shows pre-filter rows.

### Pitfall 2: SQL OFFSET on the Sorted/Filtered Query is Still O(n) for Large Unfiltered Tables

**What goes wrong:** Adding a sort to a 100k-row table makes every page scroll feel slow because `OFFSET 50000` forces PostgreSQL to scan 50k rows.
**Why it happens:** SQL OFFSET is inherently sequential — the DB must walk past `offset` rows even with an index.
**How to avoid:** This is an acceptable trade-off for Phase 6. The fast `rowOrder >= offset` seek is preserved for the no-filter/no-sort case. Document as a known limitation. Future phases could implement cursor-based pagination for sorted queries.
**Warning signs:** Page fetches on sorted large tables are noticeably slower (>200ms) at high offsets.

### Pitfall 3: row.count Doesn't Include Sort Params — But Must Include Filters and Search

**What goes wrong:** Developer adds `sorts` to the count input, which is unnecessary (sorts don't affect count) and adds query complexity.
**Why it happens:** Copying the entire `getByOffset` input schema into count without removing sorts.
**How to avoid:** The count procedure only needs `{ tableId, filters, searchQuery }`. Sorts are not needed.
**Warning signs:** No functional bug, but unnecessary SQL complexity.

### Pitfall 4: Virtualizer Uses Stale totalCount During Filter Transition

**What goes wrong:** After applying a filter that reduces rows from 100k to 10, the virtualizer still shows 100k-row scroll height briefly, then snaps to 10.
**Why it happens:** The count query has a 30-second stale time (`staleTime: 30_000`). After a filter change, the count refetch may not have completed yet.
**How to avoid:** Call `void refetchCount()` immediately when filters/search change (before the new pages load). Also reduce or eliminate `staleTime` when filters/search are active, or use `refetchOnMount: true`.
**Warning signs:** After applying a filter, the scrollbar shows the old scale briefly.

### Pitfall 5: hiddenColumns Breaks Keyboard Navigation Column Index Math

**What goes wrong:** Arrow key navigation uses `columnOrder.indexOf(columnId)` to compute left/right moves. If `columnOrder` still contains hidden column IDs, the cursor could "land" on a hidden column (invisible to user).
**Why it happens:** `columnOrder` in `GridView` includes all columns; hidden columns are only filtered from render, not from navigation state.
**How to avoid:** Use `visibleColumnIds` (the filtered list) for cursor navigation, not the full `columnIds` array.
**Warning signs:** Arrow key navigation skips cells or cursor appears to be in the wrong column.

### Pitfall 6: Filter Panel Column Picker Shows Columns by ID Not Name

**What goes wrong:** The column picker `<select>` shows UUID values like "3f4a..." instead of "Name", "Notes", "Status".
**Why it happens:** FilterCondition uses `columnId` (UUID), but the display must show the column name.
**How to avoid:** Pass `columnsData` (from `api.column.getByTableId`) to `FilterPanel` so it can render column names in the dropdown while storing column IDs in the condition objects.
**Warning signs:** Column picker shows unreadable UUIDs.

---

## Code Examples

Verified from source code in this repository.

### Current getByOffset Signature (Before Extension)

```typescript
// Source: src/server/api/routers/row.ts lines 432-473
// Current input — NO filter/sort/search support
getByOffset: protectedProcedure
  .input(
    z.object({
      tableId: z.string().uuid(),
      offset: z.number().int().min(0),
      limit: z.number().int().min(1).max(500).default(100),
      // Missing: filters, sorts, searchQuery
    }),
  )
```

### Current fetchPage in GridView (Before Extension)

```typescript
// Source: src/components/grid/GridView.tsx lines 147-171
// Current call — no params for filter/sort/search
const data = await utils.row.getByOffset.fetch({
  tableId,
  offset: pageIndex * PAGE_SIZE,
  limit: PAGE_SIZE,
  // Must add: filters, sorts, searchQuery
});
```

### Existing buildFilterConditions Helper (Already Implemented)

```typescript
// Source: src/server/api/routers/row.ts lines 48-74
// Already handles all 7 operators — reuse in getByOffset without modification
function buildFilterConditions(filters: FilterCondition[]): SQL[] {
  return filters.map((f) => {
    const colKey = sql.raw(f.columnId);
    if (f.filter.type === "text") {
      switch (f.filter.operator) {
        case "contains":
          return sql`${rows.cells}->>${colKey} ilike ${"%" + (f.filter.value ?? "") + "%"}`;
        // ... 4 more operators
      }
    } else {
      // number: CAST(cells->>'colId' AS numeric) > value
    }
  });
}
```

### Existing view.updateConfig Mutation (Already Implemented)

```typescript
// Source: src/server/api/routers/view.ts lines 115-168
// Partial merge — can call with only { hiddenColumns: [...] } without resetting filters
view.updateConfig.useMutation({
  id: viewId,
  config: {
    hiddenColumns: newHiddenColumns, // only updates this field
  },
})
```

### FilterCondition and SortCondition Types (Already Exported)

```typescript
// Source: src/server/api/routers/row.ts lines 41-42
// These are already exported — import them in GridView and panel components
export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type SortCondition = z.infer<typeof sortConditionSchema>;
```

### view.config Schema in DB (Already Supports All Fields)

```typescript
// Source: src/server/db/schema.ts lines 213-220
// hiddenColumns, filters, sorts, searchQuery already in the schema type
config: jsonb("config")
  .$type<{
    filters: unknown[];
    sorts: unknown[];
    hiddenColumns: string[];
    searchQuery: string;
  }>()
  .default({ filters: [], sorts: [], hiddenColumns: [], searchQuery: "" })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useInfiniteQuery` / `row.getRows` | Ref-based page cache / `getByOffset` | Phase 04-03 | Filter/sort/search must be added to `getByOffset`, not `getRows` |
| rowOrder-seek `getByOffset` (fast) | Must fall back to SQL OFFSET when sorts active | Phase 6 | Acceptable performance trade-off; preserve fast path for no-sort case |
| Toolbar buttons are static | Toolbar buttons open panels, show badges | Phase 6 | GridToolbar needs panel state management |

**Current state (before Phase 6):**
- `getByOffset` only accepts `{ tableId, offset, limit }` — no filter/sort/search
- `row.count` only accepts `{ tableId }` — always returns unfiltered total
- `GridToolbar` buttons are static (no onClick, no panels)
- `GridView` has no filter/sort/search state

---

## Open Questions

1. **Should filter/sort/search state be persisted to the view config immediately on every change, or only on panel close?**
   - What we know: `view.updateConfig` does partial merge so calling it on every filter add/remove is safe but chatty.
   - What's unclear: Whether the product requirement is "filters survive page reload" (persist) or "filters are session-only" (don't persist).
   - Recommendation: Persist to view config when the user closes the panel (not on every keystroke). This is Airtable's behavior. For search, don't persist (search is session-ephemeral in Airtable).

2. **Should sort + filter interactions use true SQL OFFSET, or should a cursor-based approach for sorted queries be designed now?**
   - What we know: SQL OFFSET is O(n) for the DB; for 100k rows + active sort, deep-page fetches can be slow.
   - What's unclear: Whether the target use case for sorted views involves deep pagination (most sorted views are consumed near the top).
   - Recommendation: Use SQL OFFSET for Phase 6. Document as a known limitation. The fast `rowOrder >= offset` path is preserved for the no-sort case. A cursor-for-sorted approach is a Phase 7+ optimization if needed.

3. **Where does `openPanel` state live — GridToolbar or GridView?**
   - What we know: Filter/sort/search values must be in `GridView`. The panel open/close state could be in `GridToolbar` (passed callbacks to `GridView`) or in `GridView` (passed open/close state down to `GridToolbar`).
   - Recommendation: `openPanel` state lives in `GridView`. `GridToolbar` receives `activePanel`, `onPanelToggle`, and the active condition arrays as props. This keeps all toolbar-related state in one place and avoids prop-drilling callbacks from `GridToolbar` up to `GridView`.

---

## Sources

### Primary (HIGH confidence — verified by reading actual source files)

- `src/server/api/routers/row.ts` — Full source read: `getByOffset` signature (lines 432-473), `getRows` signature with full filter/sort/search (lines 105-222), `buildFilterConditions` helper (lines 48-74), `buildSortOrder` helper (lines 76-95), exported types `FilterCondition`/`SortCondition` (lines 41-42)
- `src/server/api/routers/view.ts` — Full source read: `updateConfig` procedure with partial merge (lines 115-168), view config shape
- `src/server/db/schema.ts` — Full source read: `views.config` JSONB type includes `filters`, `sorts`, `hiddenColumns`, `searchQuery` (lines 213-226)
- `src/components/grid/GridView.tsx` — Full source read: `fetchPage` implementation calling `utils.row.getByOffset.fetch()` (lines 147-171), `row.count.useQuery` usage (lines 27-31), page cache architecture
- `src/components/grid/GridToolbar.tsx` — Full source read: Current toolbar buttons are static, no onClick handlers
- `package.json` — Verified no debounce library installed; all needed libraries present

### Secondary (MEDIUM confidence)

- Airtable UI pattern (filter/sort as inline panels below toolbar) — observed behavior; consistent with general knowledge of Airtable's UI

---

## Metadata

**Confidence breakdown:**
- getByOffset does not support filter/sort/search: HIGH — read source directly
- row.count does not accept filters: HIGH — read source directly
- buildFilterConditions/buildSortOrder can be reused: HIGH — verified at source level
- SQL OFFSET needed when sorts active: HIGH — rowOrder seek semantics are clear
- Panel UI pattern (inline below toolbar): MEDIUM — Airtable reference + general UI knowledge
- 300ms debounce without library: HIGH — standard React pattern, no library needed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable APIs; architectural findings are codebase-specific so valid until code changes)

**Critical finding for planner:**
The ROADMAP's reference to "row.getRows" is outdated — Phase 04-03 replaced it entirely with `getByOffset`. The phase must extend `getByOffset` (and `row.count`) to accept `filters`, `sorts`, and `searchQuery`. All SQL helpers already exist in `row.ts`; the extension is mechanical. No new npm packages are needed.
