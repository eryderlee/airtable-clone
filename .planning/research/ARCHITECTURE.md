# Architecture Patterns: Airtable Clone (T3 Stack)

**Domain:** Collaborative spreadsheet / database UI
**Researched:** 2026-03-17
**Overall confidence:** HIGH (schema decision), HIGH (tRPC patterns), HIGH (index strategy), MEDIUM (build order)

---

## Decision Summary (read this first)

| Decision | Choice | Confidence |
|----------|--------|------------|
| Dynamic cell storage | Hybrid: column metadata table + JSONB cell store | HIGH |
| Schema for rows | `rows` table with `cells` JSONB column per row | HIGH |
| Index strategy | B-Tree on `(table_id, row_order, id)` + GIN on `cells` JSONB | HIGH |
| Pagination | Cursor-based via `(row_order, id)` composite key | HIGH |
| tRPC filter/sort | Dynamic `$dynamic()` query builder, `sql\`\`` for JSONB ops | HIGH |
| Virtualizer pattern | Row + column virtualizer both active simultaneously | HIGH |
| Layout structure | Nested App Router layouts: base → table → view | MEDIUM |

---

## 1. Database Schema Design

### Decision: Hybrid Column Metadata + JSONB Cell Store

Three approaches exist. The research is clear on which to use and which to avoid.

#### Option A: Pure EAV (Entity-Attribute-Value)

Separate rows table + `cell_values` table with one row per cell.

**Verdict: Do not use.**

- Requires 2 joins per column queried
- At 1M rows with 20 columns = 20M rows in `cell_values`
- ORDER BY on a column requires a self-join + pivot
- Filtering requires correlated subqueries
- Source: [cybertec-postgresql.com — EAV in PostgreSQL: don't do it](https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/)

#### Option B: Pure JSONB

Single `cells` JSONB column on the row, keyed by column ID.

**Verdict: Use with caution — viable but has a critical gotcha.**

- PostgreSQL has no column-level statistics for JSONB fields
- Query planner defaults to 0.1% selectivity estimate for any JSONB predicate
- In adversarial query plans this caused 2000x slowdowns in documented cases
- GIN index (jsonb_path_ops operator class) is 36x smaller than equivalent B-Tree
- GIN write overhead is meaningful under high write load
- Source: [heap.io — When to Avoid JSONB](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)
- Source: [crunchydata.com — Indexing JSONB in Postgres](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres)

#### Option C: Hybrid — Column Metadata Table + JSONB Cells (RECOMMENDED)

A `columns` table stores metadata (name, type, position, options) as real rows. A `rows` table has a `cells` JSONB column keyed by column ID.

**Why this wins for an Airtable clone:**

- Column metadata (name, type, field options) is structured and frequently joined — it belongs in a real table with proper indexes and foreign keys
- Cell values are user-defined, sparse, and schemaless by nature — JSONB is the right fit
- Filtering/sorting at DB level: use `cells ->> 'col_id'` with explicit casting + GIN index
- Avoids EAV's join explosion while keeping column structure queryable
- Matches how production Airtable alternatives (NocoDB, Baserow, Teable) are implemented

### Recommended Schema

```sql
-- Workspace hierarchy
bases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
)

tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     uuid NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
)

-- Column definitions (real table, not JSONB)
columns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL,      -- 'text' | 'number' | 'select' | 'date' | ...
  position    integer NOT NULL,   -- display order
  options     jsonb,              -- type-specific config (select choices, etc.)
  created_at  timestamptz DEFAULT now()
)

-- Rows: position + cell data
rows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  row_order   integer NOT NULL,   -- used for cursor pagination and display order
  cells       jsonb NOT NULL DEFAULT '{}',  -- { "col_uuid": value, ... }
  created_at  timestamptz DEFAULT now()
)

-- Views: saved UI state
views (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id          uuid NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name              text NOT NULL,
  type              text NOT NULL DEFAULT 'grid',
  filters           jsonb NOT NULL DEFAULT '[]',
  sorts             jsonb NOT NULL DEFAULT '[]',
  column_visibility jsonb NOT NULL DEFAULT '{}',  -- { "col_uuid": boolean }
  search_query      text,
  created_at        timestamptz DEFAULT now()
)
```

### Views Config Schema (within JSONB)

```typescript
// filters array element
{
  columnId: string,
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty',
  value: string | number | null
}

// sorts array element
{
  columnId: string,
  direction: 'asc' | 'desc'
}
```

---

## 2. PostgreSQL Index Strategy for 1M Rows

### Mandatory Indexes

```sql
-- 1. Primary cursor index: enables fast keyset pagination scoped to a table
CREATE INDEX idx_rows_cursor
  ON rows (table_id, row_order, id);

-- 2. GIN index for cell value queries (JSONB filtering)
CREATE INDEX idx_rows_cells_gin
  ON rows USING GIN (cells jsonb_path_ops);
  -- jsonb_path_ops is smaller and faster than default jsonb_ops for @> queries

-- 3. Column lookup within a table (frequent join)
CREATE INDEX idx_columns_table_position
  ON columns (table_id, position);

-- 4. Foreign keys on rows and columns (PostgreSQL does NOT auto-index FK)
CREATE INDEX idx_rows_table_id   ON rows (table_id);
CREATE INDEX idx_columns_table_id ON columns (table_id);
CREATE INDEX idx_views_table_id  ON views (table_id);
```

### Why GIN Not B-Tree for JSONB

The GIN index (jsonb_path_ops operator class) was measured at 2.14 MB for 1M rows versus 78 MB for an equivalent B-Tree. It supports the `@>` containment operator. The ->> extraction operator is NOT accelerated by GIN — use GIN with `@>` for equality, and raw expression indexes for range queries on a specific column.

**For filtering on a specific typed column (e.g., number comparisons):**

```sql
-- Expression index on a specific column's numeric value
CREATE INDEX idx_rows_cells_amount
  ON rows ((cells ->> 'col_uuid_here')::numeric)
  WHERE cells ? 'col_uuid_here';
```

This is a partial expression index — only rows containing that column are indexed. This approach is used when a column becomes a frequent filter target. It is NOT practical to pre-create for every user column — generate these on demand or accept GIN-only fallback for most columns.

### Index Trade-offs at 1M Rows

| Concern | Approach |
|---------|----------|
| Cursor scroll (primary sort) | B-Tree on `(table_id, row_order, id)` — always fast |
| Filter by text cell (contains) | GIN + `cells @> '{"col": "value"}'` for exact, full-text for ILIKE |
| Filter by number range | Expression index on `(cells ->> 'col_id')::numeric` |
| Multi-column sort | `ORDER BY cells ->> 'col1', cells ->> 'col2'` — no index, expensive |
| Full-text search across all cells | `tsvector` generated column or pg_trgm extension |

**Critical insight:** Multi-column sorting on JSONB values cannot use standard indexes. For the initial build, limit the UI to single-column sorts, or accept a full table scan with `LIMIT` as a practical concession. At 1M rows with a `table_id` filter, the scan is scoped to the table's row count, not the full DB.

---

## 3. Dynamic Query Construction with Drizzle ORM

### Filter/Sort/Search Builder Pattern

Drizzle's `$dynamic()` method enables composable query building. The `sql` template handles JSONB operators that Drizzle doesn't natively support.

**Verified pattern from official Drizzle docs:**

```typescript
import { and, asc, desc, ilike, sql } from 'drizzle-orm'
import type { PgSelect } from 'drizzle-orm/pg-core'
import { rows } from '@/server/db/schema'

type FilterOperator = 'eq' | 'contains' | 'gt' | 'lt' | 'is_empty'

type Filter = {
  columnId: string
  operator: FilterOperator
  value: string | number | null
}

type Sort = {
  columnId: string
  direction: 'asc' | 'desc'
}

function buildRowFilters(filters: Filter[], search: string | null) {
  const conditions: SQL[] = []

  for (const filter of filters) {
    const cellRef = sql`(${rows.cells} ->> ${filter.columnId})`

    switch (filter.operator) {
      case 'eq':
        conditions.push(sql`${cellRef} = ${String(filter.value)}`)
        break
      case 'contains':
        conditions.push(sql`${cellRef} ILIKE ${'%' + filter.value + '%'}`)
        break
      case 'gt':
        conditions.push(sql`${cellRef}::numeric > ${filter.value}`)
        break
      case 'lt':
        conditions.push(sql`${cellRef}::numeric < ${filter.value}`)
        break
      case 'is_empty':
        conditions.push(sql`(${cellRef} IS NULL OR ${cellRef} = '')`)
        break
    }
  }

  if (search) {
    // Full-text search across all cell values as text
    conditions.push(sql`${rows.cells}::text ILIKE ${'%' + search + '%'}`)
  }

  return conditions
}

function withFiltersAndSort<T extends PgSelect>(
  qb: T,
  tableId: string,
  filters: Filter[],
  sorts: Sort[],
  search: string | null,
) {
  const conditions = buildRowFilters(filters, search)

  const query = qb.where(
    and(
      eq(rows.tableId, tableId),
      ...conditions,
    )
  )

  if (sorts.length > 0) {
    const orderClauses = sorts.map(s => {
      const col = sql`(${rows.cells} ->> ${s.columnId})`
      return s.direction === 'asc' ? asc(col) : desc(col)
    })
    // Append row_order as tiebreaker
    return query.orderBy(...orderClauses, asc(rows.rowOrder), asc(rows.id))
  }

  return query.orderBy(asc(rows.rowOrder), asc(rows.id))
}
```

**Important caveat on JSONB parameter binding:** A known Drizzle issue (GitHub #4935) causes incorrect parameter binding for `@>` operator in prepared statements. Use `sql` template tag directly for JSONB operators rather than relying on Drizzle's native JSONB operators. This is verified as a bug open as of late 2025.

---

## 4. tRPC Router Structure

### File Layout

```
src/server/
  trpc.ts                    # createTRPCRouter, publicProcedure, protectedProcedure
  routers/
    _app.ts                  # mergeRouters: combines all sub-routers
    base.router.ts           # CRUD for bases
    table.router.ts          # CRUD for tables + columns
    row.router.ts            # getRows (infinite), createRow, updateCell, deleteRows
    view.router.ts           # CRUD for views, save filter/sort state
    column.router.ts         # createColumn, updateColumn, reorderColumns
```

### Row Router: Cursor Pagination

The cursor is a composite `(row_order, id)` pair, allowing consistent pagination even when rows are inserted mid-list.

```typescript
// row.router.ts
export const rowRouter = createTRPCRouter({
  getRows: protectedProcedure
    .input(z.object({
      tableId: z.string().uuid(),
      viewId: z.string().uuid().optional(),
      limit: z.number().min(1).max(200).default(100),
      cursor: z.object({
        rowOrder: z.number(),
        id: z.string().uuid(),
      }).optional(),
      // inline overrides (when user hasn't saved to view yet)
      filters: z.array(FilterSchema).optional(),
      sorts: z.array(SortSchema).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor, viewId } = input

      // Merge view config with inline overrides
      const viewConfig = viewId ? await ctx.db.query.views.findFirst(...)  : null
      const filters = input.filters ?? viewConfig?.filters ?? []
      const sorts = input.sorts ?? viewConfig?.sorts ?? []
      const search = input.search ?? viewConfig?.searchQuery ?? null

      // Build dynamic query
      let query = ctx.db
        .select()
        .from(rows)
        .$dynamic()

      query = withFiltersAndSort(query, tableId, filters, sorts, search)

      // Apply cursor (keyset pagination)
      if (cursor) {
        query = query.where(
          and(
            // existing filters already applied via $dynamic()
            sql`(${rows.rowOrder}, ${rows.id}) > (${cursor.rowOrder}, ${cursor.id})`
          )
        )
      }

      const items = await query.limit(limit + 1)

      let nextCursor: typeof cursor | undefined
      if (items.length > limit) {
        const next = items.pop()!
        nextCursor = { rowOrder: next.rowOrder, id: next.id }
      }

      return { items, nextCursor }
    }),
})
```

**Note on cursor + filter interaction:** When filters are applied, the cursor must still reference `(row_order, id)` of the last visible row in the filtered result set — not the last row in the unfiltered table. The `getNextPageParam` on the client simply uses the last item in each page.

---

## 5. Next.js App Router Layout Structure

### Route Hierarchy

```
app/
  layout.tsx                      # Root: providers, auth, TRPCProvider
  page.tsx                        # Landing / redirect to dashboard

  (app)/
    layout.tsx                    # Auth guard + shell layout
    dashboard/
      page.tsx                    # Base list

    base/
      [baseId]/
        layout.tsx                # Base layout: sidebar with table list
        page.tsx                  # Redirect to first table

        [tableId]/
          layout.tsx              # Table layout: tab bar (views), column header
          page.tsx                # Default view (first grid view)

          view/
            [viewId]/
              page.tsx            # Specific named view
```

### Layout Responsibilities

| Layout | Renders | State Held |
|--------|---------|-----------|
| `(app)/layout.tsx` | Auth check, global nav | Auth session |
| `base/[baseId]/layout.tsx` | Sidebar (table list), base name | Active table |
| `[tableId]/layout.tsx` | View tab bar, field header bar | Active view, column widths |
| `view/[viewId]/page.tsx` | Table grid (virtualizer) | Scroll position, row data |

### Why This Nesting

- The sidebar must persist when switching tables within a base — base layout wraps table segments
- The tab bar (views) must persist when switching views — table layout wraps view pages
- The grid itself is a page, not a layout — it needs to fully unmount/remount on view change to reset scroll position and flush virtualizer state

---

## 6. Component Architecture: TanStack Table + Virtualizer

### Data Flow

```
PostgreSQL
  └── Drizzle ORM (dynamic query)
        └── tRPC row.getRows (cursor paginated)
              └── TanStack Query useInfiniteQuery
                    └── TanStack Table (useReactTable)
                          └── TanStack Virtual (useVirtualizer - rows)
                                └── TanStack Virtual (useVirtualizer - columns)
                                      └── DOM: <div role="grid"> (NOT <table>)
```

### Component Boundaries

| Component | Responsibility | Input | Output |
|-----------|---------------|-------|--------|
| `<TableView>` | Top-level grid coordinator | `tableId`, `viewId` | Rendered grid |
| `<GridHeader>` | Column header row, resize handles | Column defs, column virtualizer | Sticky header DOM |
| `<GridBody>` | Virtualizer container, scroll handler | Row virtualizer, table instance | Virtualized rows |
| `<GridRow>` | Single row renderer | Virtual row + table row + column virtualizer | Row cells |
| `<GridCell>` | Individual cell, editing | Cell value, column type | Input or display |
| `<FilterBar>` | Filter UI, dispatches to view state | Active filters | Filter change events |
| `<SortBar>` | Sort config UI | Active sorts | Sort change events |
| `useTableData` | Data fetching hook | tableId, viewId, overrides | TanStack Query state |
| `useGridState` | Local UI state | - | Column widths, selection |

### Why `<div>` Not `<table>`

At large column counts, a semantic `<table>` element has layout constraints that prevent column virtualization from working correctly — `table-layout: fixed` creates its own sizing context that conflicts with the virtualizer's absolute positioning. The virtualizer community and TanStack's own examples for large grids use `<div role="grid">` with absolute-positioned cells. This is the correct approach for an Airtable-like UI.

Source: [GitHub TanStack/virtual discussion #284](https://github.com/TanStack/virtual/discussions/284) — explicit discussion of `table` vs `div` for million-row virtualization.

### Virtualizer Integration Pattern

```typescript
// Both row AND column virtualizers active simultaneously
const rowVirtualizer = useVirtualizer({
  count: hasNextPage ? allRows.length + 1 : allRows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 32,  // row height in px
  overscan: 5,
})

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: columns.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: (i) => columns[i].width ?? 150,
  overscan: 3,
})

// Infinite scroll trigger: fetch when within 500px of bottom
useEffect(() => {
  const lastVirtualRow = rowVirtualizer.getVirtualItems().at(-1)
  if (!lastVirtualRow) return
  if (lastVirtualRow.index >= allRows.length - 1 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage()
  }
}, [rowVirtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage])
```

### TanStack Table Configuration

TanStack Table does not handle virtualization itself — it provides the row model and column definitions. The virtualizer picks which rows/columns to render.

```typescript
const table = useReactTable({
  data: allRows,            // flat array from useInfiniteQuery pages
  columns: columnDefs,      // derived from `columns` table query
  getCoreRowModel: getCoreRowModel(),
  // Do NOT use client-side sorting/filtering — all done at DB level
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
})
```

**Critical:** Set `manualSorting`, `manualFiltering`, and `manualPagination` to `true`. If you use TanStack Table's built-in client sort/filter with 1M rows in memory, it will freeze the browser. All of these operations execute at the database level via the tRPC query.

---

## 7. Suggested Build Order

Dependencies determine order. Each layer requires the one before it.

```
Phase 1: Schema + DB foundation
  - Drizzle schema (bases, tables, columns, rows, views)
  - Migrations to Supabase
  - Seed script for 1M rows (performance baseline)
  Dependency: Nothing. This is the ground floor.

Phase 2: tRPC data layer
  - row.getRows with cursor pagination + dynamic filter builder
  - table/column CRUD procedures
  - view.save / view.load procedures
  Dependency: Phase 1 schema must exist

Phase 3: Base layout + navigation
  - App Router nested layouts (base → table → view)
  - Sidebar with table list
  - View tab bar
  Dependency: tRPC base/table queries (Phase 2)

Phase 4: Grid core (table + virtualizer)
  - TanStack Table setup with manual mode
  - Row virtualizer (rows only, no column virtualization yet)
  - Infinite scroll via useInfiniteQuery
  - Basic cell rendering (text only)
  Dependency: Phase 2 (data), Phase 3 (layout container)

Phase 5: Cell types + editing
  - Cell components per column type (text, number, select, date)
  - Inline editing (optimistic updates via tRPC mutation)
  - Column resize
  Dependency: Phase 4 grid

Phase 6: Column virtualization
  - Add horizontal virtualizer alongside row virtualizer
  - Switch from <table> to <div role="grid"> if not already done
  - Sticky first column
  Dependency: Phase 4 grid working correctly

Phase 7: Filter / sort / search UI
  - FilterBar component
  - SortBar component
  - Search input
  - Wire to tRPC query params (triggers refetch, resets cursor)
  Dependency: Phase 2 filter builder, Phase 4 grid

Phase 8: View persistence
  - Save/load filter+sort+search+visibility state to views table
  - View CRUD UI
  Dependency: Phase 7 filter/sort working
```

---

## 8. Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Filter/Sort on Full Dataset

**What:** Fetch all rows, filter/sort in JavaScript
**Why bad:** Chokes at 10K rows. Useless at 1M rows.
**Instead:** All filter/sort/search executes in the DB query. `manualFiltering: true` on TanStack Table.

### Anti-Pattern 2: EAV Cell Storage

**What:** One row per cell in a `cell_values` table
**Why bad:** 1M rows × 20 columns = 20M rows. Every query pivots. Aggregates become cartesian explosions.
**Instead:** JSONB cells column on the rows table.

### Anti-Pattern 3: Offset Pagination for Infinite Scroll

**What:** `LIMIT n OFFSET n*page`
**Why bad:** At page 500 with 100 rows/page, PostgreSQL scans 50,000 rows to skip them. Gets progressively slower.
**Instead:** Cursor keyset pagination on `(row_order, id)`.

### Anti-Pattern 4: Semantic `<table>` Element for Column Virtualization

**What:** Using HTML `<table>`, `<tr>`, `<td>` with column virtualization
**Why bad:** Table layout engine fights virtualizer's absolute positioning. Columns can't be virtualized correctly.
**Instead:** `<div role="grid">` with CSS grid or absolute positioning.

### Anti-Pattern 5: Accumulating All Pages in Memory Without Windowing

**What:** `useInfiniteQuery` accumulates all fetched pages as rows in TanStack Table, but no virtualizer
**Why bad:** 1M rows in a JS array freezes the browser even without rendering
**Instead:** Virtualizer is not optional — it must be active from the first page of data.

### Anti-Pattern 6: Saving Filter State Only in React State

**What:** Filters exist only in local `useState`, not persisted
**Why bad:** Refreshing the page loses all work. Views are the killer feature.
**Instead:** URL params for transient state + view.save for persistent state.

---

## 9. Scalability Considerations

| Concern | At 10K rows | At 100K rows | At 1M rows |
|---------|-------------|-------------|------------|
| Scroll performance | Virtualizer handles it | Virtualizer handles it | Virtualizer handles it (cursor must be active) |
| Filter query speed | Full scan fine | Needs index | GIN + cursor index required |
| Sort query speed | Fast | Needs sort index | JSONB sort is slow without expression index |
| Write throughput | No concern | No concern | GIN write overhead visible — consider `gin_pending_list_limit` tuning |
| Connection pool | Default | Default | Supabase connection pooler (pgBouncer) required |
| Row size | No concern | No concern | Large JSONB cells bloat WAL — keep cell values compact |

**Supabase-specific note:** Supabase uses pgBouncer in transaction mode. This means prepared statements need to be disabled or used with the session mode. When using Drizzle with Supabase at scale, use `?pgbouncer=true` in the connection string or switch to Supabase's direct connection for write-heavy operations.

---

## Sources

- [Drizzle ORM — Dynamic Query Building](https://orm.drizzle.team/docs/dynamic-query-building) (official docs — HIGH confidence)
- [Drizzle ORM — Conditional Filters](https://orm.drizzle.team/docs/guides/conditional-filters-in-query) (official docs — HIGH confidence)
- [Drizzle ORM — SQL Template Tag](https://orm.drizzle.team/docs/sql) (official docs — HIGH confidence)
- [tRPC — useInfiniteQuery / cursor pagination](https://trpc.io/docs/client/react/useInfiniteQuery) (official docs — HIGH confidence)
- [TanStack Table — Virtualization Guide](https://tanstack.com/table/v8/docs/guide/virtualization) (official docs — HIGH confidence)
- [TanStack Table — Virtualized Infinite Scrolling Example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-infinite-scrolling) (official docs — HIGH confidence)
- [heap.io — When to Avoid JSONB](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) (verified case study — MEDIUM confidence)
- [Crunchy Data — Indexing JSONB in Postgres](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) (authoritative PostgreSQL source — HIGH confidence)
- [cybertec-postgresql.com — EAV: Don't Do It](https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/) (authoritative PostgreSQL source — HIGH confidence)
- [uptrace.dev — Cursor Pagination Guide](https://bun.uptrace.dev/guide/cursor-pagination.html) (technical guide — MEDIUM confidence)
- [pganalyze — Understanding GIN Indexes](https://pganalyze.com/blog/gin-index) (technical blog, reputable source — MEDIUM confidence)
- [GitHub TanStack/virtual discussion #284](https://github.com/TanStack/virtual/discussions/284) — table vs div for virtual (community — LOW confidence, but widely cited)
- [razsamuel.com — JSONB vs EAV benchmark](https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/) (benchmark data — MEDIUM confidence)
- [Drizzle ORM issue #4935 — JSONB prepared statement bug](https://github.com/drizzle-team/drizzle-orm/issues/4935) (open bug — HIGH confidence as a gotcha)
