# Phase 2: Data Layer - Research

**Researched:** 2026-03-17
**Domain:** tRPC v11 routers, Drizzle ORM dynamic queries, cursor pagination, JSONB filtering, view config merge
**Confidence:** HIGH (primary claims verified via official docs, existing codebase, and benchmarked results from Phase 1)

---

## Summary

Phase 2 builds five tRPC routers (base, table, column, view, row) that expose the full data contract the UI will consume. The schema and auth infrastructure are already in place from Phase 1. The installed stack is `@trpc/react-query@11.13.4` + `drizzle-orm@0.36.4` + `zod@3.23.8` — all confirmed operational.

The most critical technical concern is `row.getRows`, which must use the ROW tuple comparison pattern `(row_order, id) > (cursorOrder, cursorId)` for cursor pagination. This was benchmarked in Phase 1: the OR-expanded form takes 5718ms DB-side on 1M rows; the ROW tuple form takes 2ms. This is non-negotiable. All other CRUD routers follow standard protectedProcedure patterns.

JSONB cell filtering (for "text contains foo" style filters) requires raw `sql` template tag since Drizzle 0.36.4 has no native JSONB operator helpers. The `.$dynamic()` API accumulates WHERE clauses and ORDER BY clauses without re-running the query, enabling the filter + sort + cursor + view-config-merge pipeline to be composed cleanly.

**Primary recommendation:** Build `row.getRows` with `.$dynamic()` filter/sort builder, ROW tuple cursor, and view config merge. Build all other routers as straightforward CRUD with protectedProcedure throughout. Follow the exact patterns documented below.

---

## Standard Stack

All packages are already installed. No new dependencies needed for Phase 2.

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trpc/server` | 11.13.4 | Router + procedure definitions | Project stack |
| `@trpc/react-query` | 11.13.4 | `createTRPCReact` + `useInfiniteQuery` client | Project stack (note: NOT `@trpc/tanstack-react-query`) |
| `drizzle-orm` | 0.36.4 | Query builder, `.$dynamic()`, `sql` template | Project stack |
| `zod` | 3.23.8 | Input validation schemas | Pinned at v3 — v4 banned |
| `superjson` | 2.x | tRPC transformer (already wired in trpc.ts) | Already in createTRPCContext |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `postgres` | 3.4.5 | PostgreSQL driver with `prepare: false` | Already in `src/server/db/index.ts` |
| `server-only` | 0.0.1 | Prevent server code leaking to client | Already guarding `src/server/` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sql` template for JSONB operators | Drizzle native JSONB helpers | Native helpers don't exist in 0.36.4; `sql` template is the only option |
| ROW tuple cursor | OR-expanded cursor | OR form is 3000x slower on 1M rows — benchmarked in Phase 1 |
| `.$dynamic()` chain | Conditional spread in `.where()` | Both work; `.$dynamic()` is the official pattern for building filters across function boundaries |

**No new packages needed for Phase 2.**

---

## Architecture Patterns

### Recommended Project Structure

```
src/server/api/
├── trpc.ts                      # already exists — createTRPCRouter, protectedProcedure
├── root.ts                      # currently has placeholder post router — replace with 5 routers
└── routers/
    ├── post.ts                  # DELETE — replace with real routers
    ├── bases.ts                 # base.getAll, base.create, base.update, base.delete
    ├── tables.ts                # table.getByBase, table.create, table.update, table.delete
    ├── columns.ts               # column.getByTable, column.create, column.update, column.delete, column.reorder
    ├── views.ts                 # view.getByTable, view.create, view.update, view.delete, view.updateConfig
    └── rows.ts                  # row.getRows (infinite), row.create, row.update, row.delete, row.updateCell
```

### Pattern 1: Standard CRUD protectedProcedure

**What:** Every procedure in every router must be a `protectedProcedure`. No public procedures for data access.

**When to use:** All 5 routers, all procedures.

```typescript
// Source: src/server/api/trpc.ts (already implemented)
// Pattern: ownership check inside the procedure handler, not just auth check
export const basesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(bases)
      .where(eq(bases.userId, ctx.session.user.id))
      .orderBy(asc(bases.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [base] = await ctx.db
        .insert(bases)
        .values({ name: input.name, userId: ctx.session.user.id })
        .returning();
      return base!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Ownership verification: only delete if userId matches
      await ctx.db
        .delete(bases)
        .where(and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)));
    }),
});
```

### Pattern 2: row.getRows — Infinite Query with ROW Tuple Cursor

**What:** The primary performance-critical procedure. Returns paginated rows with cursor, applies filters + sorts from the request input AND from the saved view config.

**Critical constraint:** MUST use ROW tuple comparison, not OR-expanded form.

```typescript
// Source: Drizzle docs https://orm.drizzle.team/docs/guides/cursor-based-pagination
//         Phase 1 benchmark (01-03-SUMMARY.md): ROW tuple = 2ms, OR expanded = 5718ms
import { sql, and, eq, asc, desc, ilike, gte, lte, type SQL } from "drizzle-orm";

// Zod input schema for row.getRows
const FilterConditionSchema = z.object({
  columnId: z.string(),
  operator: z.enum(["contains", "notContains", "eq", "notEq", "gt", "lt", "gte", "lte", "isEmpty", "isNotEmpty"]),
  value: z.string().optional(),
});

const SortConditionSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
});

const CursorSchema = z.object({
  rowOrder: z.number(),
  id: z.string(),
}).nullish();

const GetRowsInputSchema = z.object({
  tableId: z.string(),
  viewId: z.string().optional(),    // if provided, merge view config
  filters: z.array(FilterConditionSchema).optional().default([]),
  sorts: z.array(SortConditionSchema).optional().default([]),
  limit: z.number().min(1).max(500).default(100),
  cursor: CursorSchema,             // REQUIRED by tRPC useInfiniteQuery
});

// Procedure definition
row.getRows: protectedProcedure
  .input(GetRowsInputSchema)
  .query(async ({ ctx, input }) => {
    const { tableId, viewId, filters, sorts, limit, cursor } = input;

    // 1. If viewId provided, load view config and merge
    let mergedFilters = filters;
    let mergedSorts = sorts;
    if (viewId) {
      const [view] = await ctx.db.select().from(views).where(eq(views.id, viewId));
      if (view) {
        // view config filters/sorts are the base; request filters/sorts are overlaid
        // (Phase 2 contract: merge strategy = request overrides view)
        mergedFilters = filters.length > 0 ? filters : (view.config.filters as typeof filters);
        mergedSorts = sorts.length > 0 ? sorts : (view.config.sorts as typeof sorts);
      }
    }

    // 2. Build dynamic query
    let query = ctx.db
      .select()
      .from(rows)
      .where(eq(rows.tableId, tableId))
      .$dynamic();

    // 3. Apply filters
    const conditions: SQL[] = [eq(rows.tableId, tableId)];
    for (const f of mergedFilters) {
      const cellPath = sql`${rows.cells}->>${f.columnId}`;
      switch (f.operator) {
        case "contains":
          if (f.value) conditions.push(sql`${rows.cells}->>${f.columnId} ilike ${"%" + f.value + "%"}`);
          break;
        case "eq":
          if (f.value !== undefined) conditions.push(sql`${rows.cells}->>${f.columnId} = ${f.value}`);
          break;
        case "isEmpty":
          conditions.push(sql`(${rows.cells}->>${f.columnId}) is null or (${rows.cells}->>${f.columnId}) = ''`);
          break;
        // ... other operators follow same sql`` pattern
      }
    }
    query = query.where(and(...conditions));

    // 4. Apply cursor (ROW tuple comparison — MANDATORY)
    if (cursor) {
      query = query.where(
        and(
          and(...conditions),
          sql`(${rows.rowOrder}, ${rows.id}) > (${cursor.rowOrder}, ${cursor.id})`
        )
      );
    } else {
      query = query.where(and(...conditions));
    }

    // 5. Apply sorts (then append rowOrder, id for stable ordering)
    const orderClauses: SQL[] = mergedSorts.map((s) =>
      s.direction === "asc"
        ? asc(sql`${rows.cells}->>${s.columnId}`)
        : desc(sql`${rows.cells}->>${s.columnId}`)
    );
    // Always append stable tie-breaker
    orderClauses.push(asc(rows.rowOrder), asc(rows.id));
    query = query.orderBy(...orderClauses);

    // 6. Fetch limit + 1 to detect next page
    const results = await query.limit(limit + 1);

    let nextCursor: { rowOrder: number; id: string } | null = null;
    if (results.length > limit) {
      const nextRow = results.pop()!;
      nextCursor = { rowOrder: nextRow.rowOrder, id: nextRow.id };
    }

    return { items: results, nextCursor };
  }),
```

**Note on .$dynamic() with WHERE:** When using `.$dynamic()`, calling `.where()` multiple times replaces the previous condition. The correct pattern is to accumulate all conditions into a `conditions: SQL[]` array, then call `.where(and(...conditions))` once, or use the dynamic mode with a helper function pattern.

### Pattern 3: ROW Tuple Comparison (the mandatory cursor form)

**What:** Uses PostgreSQL ROW value comparison to enable composite index tight range scan.

```typescript
// Source: confirmed via EXPLAIN ANALYZE in Phase 1 benchmark (01-03-SUMMARY.md)
// DB execution: 2ms at cursor position 500,000 in 1M-row table
// NEVER use the OR-expanded form — it causes O(n) filter scan
import { sql } from "drizzle-orm";

// CORRECT — uses composite index as tight range (2ms)
const cursorCondition = cursor
  ? sql`(${rows.rowOrder}, ${rows.id}) > (${cursor.rowOrder}, ${cursor.id})`
  : undefined;

// WRONG — OR-expanded form (5718ms at same cursor position, do not use)
// or(gt(rows.rowOrder, cursor.rowOrder), and(eq(rows.rowOrder, cursor.rowOrder), gt(rows.id, cursor.id)))
```

### Pattern 4: tRPC useInfiniteQuery Client Usage

**What:** The client-side call pattern for `row.getRows`. The `cursor` field is passed automatically by TanStack Query; it must NOT be included in the input argument.

```typescript
// Source: https://trpc.io/docs/client/react/useInfiniteQuery
// Installed package: @trpc/react-query v11.13.4 (uses createTRPCReact)
import { api } from "~/trpc/react";

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  api.row.getRows.useInfiniteQuery(
    {
      tableId: "table-id",
      viewId: "view-id",  // optional
      filters: [],        // additional request-level filters
      sorts: [],          // additional request-level sorts
      limit: 100,
      // NOTE: cursor is NOT passed here — TanStack Query manages it
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      // initialCursor: undefined,  // start from beginning
    }
  );
```

### Pattern 5: Dynamic Filter Builder using .$dynamic()

**What:** The official Drizzle pattern for building query conditions at runtime. Type-safe helper function that accepts `PgSelect` generic.

```typescript
// Source: https://orm.drizzle.team/docs/dynamic-query-building
import { and, type SQL } from "drizzle-orm";
import { type PgSelect } from "drizzle-orm/pg-core";

function withFilters<T extends PgSelect>(
  qb: T,
  conditions: SQL[],
): T {
  if (conditions.length === 0) return qb;
  return qb.where(and(...conditions)) as T;
}

function withSorts<T extends PgSelect>(
  qb: T,
  orderClauses: SQL[],
): T {
  if (orderClauses.length === 0) return qb;
  return qb.orderBy(...orderClauses) as T;
}
```

### Pattern 6: View Config Merge Strategy

**What:** Views save a bundle of {filters, sorts, hiddenColumns, searchQuery}. The `getRows` procedure merges view config with request-level overrides.

**Merge rule (Phase 2 contract):**
- If request sends non-empty filters: use request filters (ignore view filters)
- If request sends empty filters: use view config filters
- Same for sorts
- hiddenColumns: applied client-side by the UI (not relevant to row.getRows query)
- searchQuery: treated as an additional filter condition (cells contain searchQuery across all columns)

```typescript
// View config merge (inside row.getRows)
let effectiveFilters = input.filters ?? [];
let effectiveSorts = input.sorts ?? [];

if (input.viewId) {
  const [view] = await ctx.db
    .select()
    .from(views)
    .where(eq(views.id, input.viewId));

  if (view?.config) {
    if (effectiveFilters.length === 0) {
      effectiveFilters = view.config.filters as FilterCondition[];
    }
    if (effectiveSorts.length === 0) {
      effectiveSorts = view.config.sorts as SortCondition[];
    }
    // Apply searchQuery as an additional contains filter on all text columns
    if (view.config.searchQuery) {
      // Implementation: fetch column list, add ilike conditions
    }
  }
}
```

### Pattern 7: Root Router Assembly

**What:** Replace `post.ts` placeholder with the 5 real routers in `root.ts`.

```typescript
// src/server/api/root.ts
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { basesRouter } from "~/server/api/routers/bases";
import { tablesRouter } from "~/server/api/routers/tables";
import { columnsRouter } from "~/server/api/routers/columns";
import { viewsRouter } from "~/server/api/routers/views";
import { rowsRouter } from "~/server/api/routers/rows";

export const appRouter = createTRPCRouter({
  base: basesRouter,
  table: tablesRouter,
  column: columnsRouter,
  view: viewsRouter,
  row: rowsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
```

### Anti-Patterns to Avoid

- **OR-expanded cursor form:** `or(gt(rows.rowOrder, cursor.rowOrder), and(eq(...), gt(...)))` — benchmarked at 5718ms on 1M rows. Never use this. Always use the ROW tuple SQL expression.
- **Multiple `.where()` calls in `.$dynamic()` chain:** Each `.where()` replaces the previous. Accumulate all conditions in a `SQL[]` array and call `.where(and(...conditions))` once.
- **OFFSET in any query:** Banned per project decision. Every list procedure must return a cursor.
- **Trusting proxy.ts auth:** Every `protectedProcedure` already calls `auth()` independently via the existing `trpc.ts` context. Don't add any workaround that bypasses this.
- **Returning all rows without limit:** Every procedure that returns multiple rows must have a `.limit()`. `row.getRows` defaults to 100.
- **Missing ownership checks:** For update/delete mutations, always include `eq(table.userId, ctx.session.user.id)` in the WHERE clause. Verify via related table joins for tables, columns, rows (which don't have a direct userId — join through base).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe infinite query | Custom fetch loop | `api.row.getRows.useInfiniteQuery()` | Handles cursor state, deduplication, page merging automatically |
| Dynamic WHERE accumulation | String concatenation | `.$dynamic()` + `and(...conditions: SQL[])` | Type-safe, injection-safe, composable |
| JSONB text extraction | Custom column type | `sql\`${rows.cells}->>'columnId'\`` | PostgreSQL native operator, no library needed |
| Cursor pagination | Custom page tracking | ROW tuple comparison via `sql\`\`` | Benchmarked — 2ms vs 5718ms, cannot be improved further |
| Auth enforcement | Request header checks | `protectedProcedure` (already wired in trpc.ts) | CVE-2025-29927 — middleware bypass possible, procedure-level check required |
| Input validation | Manual type guards | Zod schemas in `.input()` | tRPC pipes Zod errors through to client automatically |

**Key insight:** The `.$dynamic()` + accumulated `SQL[]` approach is the only safe way to build dynamic queries in Drizzle. Concatenating raw SQL strings for filters introduces injection risk and loses type safety.

---

## Common Pitfalls

### Pitfall 1: OR-Expanded Cursor Destroys Performance

**What goes wrong:** Using the OR-expanded form `(rowOrder > cursor.rowOrder) OR (rowOrder = cursor.rowOrder AND id > cursor.id)` causes PostgreSQL to scan all rows up to the cursor position, even with an index.

**Why it happens:** PostgreSQL cannot use a composite index `(tableId, rowOrder, id)` as a tight range when the WHERE clause uses OR across columns. It falls back to filtering after index scan.

**How to avoid:** Always use `sql\`(${rows.rowOrder}, ${rows.id}) > (${cursor.rowOrder}, ${cursor.id})\``. This is PostgreSQL ROW value comparison syntax which allows the planner to use the composite index as a true range.

**Warning signs:** Queries taking > 1 second in production at any cursor position. EXPLAIN showing "Rows Removed by Filter" > 0 for mid-table cursors.

**Benchmark evidence (01-03-SUMMARY.md):**
- OR form at rowOrder=500,000: 5718ms DB execution, 500,001 rows filtered
- ROW tuple at rowOrder=500,000: 1.9ms DB execution, 0 rows filtered

### Pitfall 2: Multiple .where() Calls in .$dynamic() Replace, Not Append

**What goes wrong:** Calling `query.where(condition1)` then `query.where(condition2)` — only `condition2` is applied.

**Why it happens:** Drizzle's fluent API replaces the WHERE clause on each call. `.$dynamic()` enables multiple calls but doesn't accumulate them.

**How to avoid:** Build an array `const conditions: SQL[] = []`, push all conditions, then call `query.where(and(...conditions))` exactly once. Or use the helper function pattern with `PgSelect` generic.

**Warning signs:** Filters that appear to work in isolation but stop working when combined with other filters.

### Pitfall 3: JSONB ->> Operator Returns Text, Not Original Type

**What goes wrong:** Sorting by a number column using `cells->>'colId'` sorts lexicographically (1, 10, 2, 20) not numerically.

**Why it happens:** `->>` extracts JSONB values as `text`. Numeric comparison requires `CAST`.

**How to avoid:** For number columns, use CAST in the ORDER BY:
```typescript
// For number sort: cast to numeric
sql`CAST(${rows.cells}->>${columnId} AS numeric) ${direction === "asc" ? sql`ASC` : sql`DESC`} NULLS LAST`
// For text sort: use as-is
sql`${rows.cells}->>${columnId} ${direction === "asc" ? sql`ASC` : sql`DESC`} NULLS LAST`
```
The `column.type` from the `columns` table tells you which cast to apply.

**Warning signs:** Numeric column sort returning "1, 10, 100, 2, 20" instead of "1, 2, 10, 20, 100".

### Pitfall 4: Missing NULLS LAST on JSONB Sort

**What goes wrong:** Rows where a cell value is NULL (key not present in JSONB) sort to the top in ASC order, which is surprising UX.

**Why it happens:** PostgreSQL default is NULLS LAST for DESC and NULLS FIRST for ASC.

**How to avoid:** Always add `NULLS LAST` to ORDER BY expressions that touch `cells->>'columnId'`.

**Warning signs:** Empty cells appearing before populated cells when sorting ascending.

### Pitfall 5: Ownership Check Gap for Nested Resources

**What goes wrong:** A user can update/delete another user's rows by guessing the row ID.

**Why it happens:** The `rows` table has no direct `userId` column — ownership flows through `tableId → baseId → userId`.

**How to avoid:** For mutations on rows, columns, views (any table without direct userId), verify ownership with a JOIN or subquery:
```typescript
// Option 1: Subquery ownership check
.where(
  and(
    eq(rows.id, input.rowId),
    sql`${rows.tableId} IN (
      SELECT t.id FROM ${tables} t
      JOIN ${bases} b ON b.id = t.base_id
      WHERE b.user_id = ${ctx.session.user.id}
    )`
  )
)

// Option 2: Fetch-then-verify (simpler, two queries)
const [row] = await ctx.db.select().from(rows).where(eq(rows.id, input.rowId));
if (!row) throw new TRPCError({ code: "NOT_FOUND" });
const [table] = await ctx.db.select().from(tables).where(eq(tables.id, row.tableId));
// ... join to base, check userId
```

**Warning signs:** Mutations that only check `eq(rows.id, input.rowId)` without any ownership verification.

### Pitfall 6: Schema Column Names (snake_case in DB, camelCase in Drizzle)

**What goes wrong:** Referencing `rows.row_order` instead of `rows.rowOrder` in TypeScript.

**Why it happens:** The schema maps camelCase Drizzle field names to snake_case DB column names (e.g., `rowOrder: integer("row_order")`). The Drizzle field name is used in TypeScript; the DB column name is used in raw `sql` templates.

**How to avoid:** In Drizzle query builder methods: use `rows.rowOrder`, `rows.tableId`. In `sql` template tag: use the DB column name: `sql\`row_order\``. When referencing schema columns inside `sql\`\``, use the Drizzle column reference `${rows.rowOrder}` (Drizzle interpolates the correct quoted DB column name).

**Warning signs:** TypeScript errors accessing `rows.row_order`; SQL errors with "column does not exist" for camelCase names.

### Pitfall 7: tRPC Cursor Must Be Nullable in Zod Schema

**What goes wrong:** `cursor: z.object({...})` (non-nullable) causes the first page query (no cursor) to fail input validation.

**Why it happens:** tRPC passes `undefined` as the cursor for the first page. The Zod schema must allow null/undefined for the cursor field.

**How to avoid:** Always define cursor as `z.object({...}).nullish()` — accepts `null`, `undefined`, or the object.

**Warning signs:** First-page query throws ZodError about cursor being undefined.

### Pitfall 8: The timingMiddleware Adds Artificial Delay in Dev

**What goes wrong:** Performance testing in development shows 100-400ms baseline for every procedure.

**Why it happens:** The existing `trpc.ts` adds `timingMiddleware` to all procedures with an artificial `waitMs = Math.floor(Math.random() * 400) + 100` delay in development.

**How to avoid:** This is expected dev behavior — do not remove it. When benchmarking, test against production or use the `scripts/benchmark.ts` direct Drizzle approach (not tRPC).

**Warning signs:** All procedures appearing slow in development even when the SQL query is fast.

---

## Code Examples

Verified patterns from official sources and Phase 1 benchmarks:

### Row.getRows Procedure — Complete Working Pattern

```typescript
// src/server/api/routers/rows.ts
// Source: tRPC docs + Drizzle docs + Phase 1 benchmark (01-03-SUMMARY.md)
import { z } from "zod";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { rows, views, tables, bases, columns } from "~/server/db/schema";

const FilterConditionSchema = z.object({
  columnId: z.string(),
  operator: z.enum([
    "contains", "notContains",
    "eq", "notEq",
    "gt", "lt", "gte", "lte",
    "isEmpty", "isNotEmpty",
  ]),
  value: z.string().optional(),
});

const SortConditionSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
});

export const rowsRouter = createTRPCRouter({
  getRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        viewId: z.string().optional(),
        filters: z.array(FilterConditionSchema).default([]),
        sorts: z.array(SortConditionSchema).default([]),
        limit: z.number().min(1).max(500).default(100),
        cursor: z.object({ rowOrder: z.number(), id: z.string() }).nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      // 1. View config merge
      let effectiveFilters = input.filters;
      let effectiveSorts = input.sorts;

      if (input.viewId) {
        const [view] = await ctx.db
          .select()
          .from(views)
          .where(eq(views.id, input.viewId));
        if (view) {
          if (effectiveFilters.length === 0) {
            effectiveFilters = view.config.filters as typeof effectiveFilters;
          }
          if (effectiveSorts.length === 0) {
            effectiveSorts = view.config.sorts as typeof effectiveSorts;
          }
        }
      }

      // 2. Accumulate WHERE conditions
      const conditions: SQL[] = [eq(rows.tableId, input.tableId)];

      for (const f of effectiveFilters) {
        switch (f.operator) {
          case "contains":
            if (f.value) {
              conditions.push(
                sql`${rows.cells}->>${f.columnId} ilike ${"%" + f.value + "%"}`
              );
            }
            break;
          case "notContains":
            if (f.value) {
              conditions.push(
                sql`${rows.cells}->>${f.columnId} not ilike ${"%" + f.value + "%"}`
              );
            }
            break;
          case "eq":
            if (f.value !== undefined) {
              conditions.push(sql`${rows.cells}->>${f.columnId} = ${f.value}`);
            }
            break;
          case "notEq":
            if (f.value !== undefined) {
              conditions.push(sql`${rows.cells}->>${f.columnId} != ${f.value}`);
            }
            break;
          case "gt":
            if (f.value !== undefined) {
              conditions.push(
                sql`CAST(${rows.cells}->>${f.columnId} AS numeric) > ${f.value}`
              );
            }
            break;
          case "lt":
            if (f.value !== undefined) {
              conditions.push(
                sql`CAST(${rows.cells}->>${f.columnId} AS numeric) < ${f.value}`
              );
            }
            break;
          case "gte":
            if (f.value !== undefined) {
              conditions.push(
                sql`CAST(${rows.cells}->>${f.columnId} AS numeric) >= ${f.value}`
              );
            }
            break;
          case "lte":
            if (f.value !== undefined) {
              conditions.push(
                sql`CAST(${rows.cells}->>${f.columnId} AS numeric) <= ${f.value}`
              );
            }
            break;
          case "isEmpty":
            conditions.push(
              sql`(${rows.cells}->>${f.columnId} is null or ${rows.cells}->>${f.columnId} = '')`
            );
            break;
          case "isNotEmpty":
            conditions.push(
              sql`(${rows.cells}->>${f.columnId} is not null and ${rows.cells}->>${f.columnId} != '')`
            );
            break;
        }
      }

      // 3. ROW tuple cursor (MANDATORY — never use OR-expanded form)
      if (input.cursor) {
        conditions.push(
          sql`(${rows.rowOrder}, ${rows.id}) > (${input.cursor.rowOrder}, ${input.cursor.id})`
        );
      }

      // 4. ORDER BY (sorts first, then stable tie-breaker)
      // Fetch column types to determine numeric vs text cast
      const colMap = new Map<string, "text" | "number">();
      if (effectiveSorts.length > 0) {
        const cols = await ctx.db
          .select({ id: columns.id, type: columns.type })
          .from(columns)
          .where(eq(columns.tableId, input.tableId));
        cols.forEach((c) => colMap.set(c.id, c.type));
      }

      const orderClauses: SQL[] = effectiveSorts.map((s) => {
        const colType = colMap.get(s.columnId) ?? "text";
        const dir = s.direction === "asc" ? sql`ASC` : sql`DESC`;
        if (colType === "number") {
          return sql`CAST(${rows.cells}->>${s.columnId} AS numeric) ${dir} NULLS LAST`;
        }
        return sql`${rows.cells}->>${s.columnId} ${dir} NULLS LAST`;
      });
      // Stable tie-breaker always last
      orderClauses.push(asc(rows.rowOrder), asc(rows.id));

      // 5. Execute
      const results = await ctx.db
        .select()
        .from(rows)
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(input.limit + 1);

      // 6. Extract next cursor
      let nextCursor: { rowOrder: number; id: string } | null = null;
      if (results.length > input.limit) {
        const nextRow = results.pop()!;
        nextCursor = { rowOrder: nextRow.rowOrder, id: nextRow.id };
      }

      return { items: results, nextCursor };
    }),
});
```

### Standard CRUD Pattern (base router example)

```typescript
// src/server/api/routers/bases.ts
// Source: tRPC docs https://trpc.io/docs/server/procedures
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases } from "~/server/db/schema";

export const basesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(bases)
      .where(eq(bases.userId, ctx.session.user.id))
      .orderBy(asc(bases.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [base] = await ctx.db
        .insert(bases)
        .values({ name: input.name, userId: ctx.session.user.id })
        .returning();
      return base!;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(bases)
        .set({ name: input.name, updatedAt: new Date() })
        .where(and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(bases)
        .where(and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)));
    }),
});
```

### Column Reorder Pattern

```typescript
// column.reorder — update order values for multiple columns atomically
reorder: protectedProcedure
  .input(z.object({
    tableId: z.string(),
    columnIds: z.array(z.string()), // ordered list
  }))
  .mutation(async ({ ctx, input }) => {
    // Update each column's order field in a transaction
    await ctx.db.transaction(async (tx) => {
      for (let i = 0; i < input.columnIds.length; i++) {
        await tx
          .update(columns)
          .set({ order: i })
          .where(eq(columns.id, input.columnIds[i]!));
      }
    });
  }),
```

### View Config Update Pattern

```typescript
// view.updateConfig — save entire config bundle atomically
updateConfig: protectedProcedure
  .input(z.object({
    viewId: z.string(),
    config: z.object({
      filters: z.array(FilterConditionSchema),
      sorts: z.array(SortConditionSchema),
      hiddenColumns: z.array(z.string()),
      searchQuery: z.string(),
    }),
  }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(views)
      .set({ config: input.config })
      .where(eq(views.id, input.viewId))
      .returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
    return updated;
  }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OR-expanded cursor | ROW tuple `(col1, col2) > (v1, v2)` | Phase 1 benchmark confirmed | 3000x performance improvement; mandatory for 1M-row compliance |
| `createTRPCReact` (v10 pattern) | `createTRPCReact` from `@trpc/react-query` (v11) | v11 release | API is same; `useInfiniteQuery` works identically |
| `getServerSession` (Auth.js v4) | `auth()` in `createTRPCContext` | Already implemented in Phase 1 | Session is already threaded into `ctx.session` |
| `@trpc/tanstack-react-query` (newer) | `@trpc/react-query` (installed) | Divergent paths in v11 | This project uses `@trpc/react-query` — do NOT import from `@trpc/tanstack-react-query` |

**Installed package clarification:** The Phase 1 research referenced `@trpc/tanstack-react-query`. The actual installed package is `@trpc/react-query` v11.13.4 (confirmed in `node_modules/@trpc/`). The `createTRPCReact` import in `src/trpc/react.tsx` is already correct. Do not change it.

**Deprecated/outdated:**
- `@trpc/next` (installed but unused for App Router): The project uses the fetch adapter pattern via `src/app/api/trpc/[trpc]/route.ts`. The `@trpc/next` package is irrelevant for App Router.
- `post.ts` placeholder router: Must be removed and replaced with the 5 real routers.

---

## Open Questions

1. **Sort + cursor interaction with non-rowOrder sort columns**
   - What we know: When the primary sort is by a cell value (not rowOrder), the composite index `(tableId, rowOrder, id)` cannot be used as a tight cursor range. The ROW tuple must reference the actual sort columns.
   - What's unclear: Whether a partial or covering index on `cells->>'columnId'` is feasible for v1. PostgreSQL supports functional indexes but JSONB key extraction is complex.
   - Recommendation: For Phase 2, use `(rowOrder, id)` as the cursor tie-breaker for ALL sorts (even when primary sort is by cell value). This means cursor re-entry after an out-of-order page is not guaranteed stable when cell-sorted. This is acceptable for v1 since cell sorts still use the `rowOrder` tie-breaker consistently. Document as a known limitation; defer columnar sort indexes to a later phase.

2. **searchQuery as global filter across all columns**
   - What we know: The view config has a `searchQuery` field. The spec says it "hides non-matching rows" at DB level.
   - What's unclear: Whether the implementation should use `OR ilike` across all cell values or a PostgreSQL full-text search on the JSONB blob.
   - Recommendation: For Phase 2, implement as `cells::text ilike '%searchQuery%'` (cast entire JSONB to text and search). This is simple, correct, and fast enough for v1. Full-text search optimization is deferred.

3. **Transaction support for row bulk operations**
   - What we know: `ctx.db.transaction()` is available in Drizzle with the postgres.js driver.
   - What's unclear: Whether Supavisor transaction pooler (port 6543) properly handles Drizzle transactions (as opposed to individual statements).
   - Recommendation: The `prepare: false` setting was required for Supavisor; transactions should work since each `BEGIN/COMMIT` round-trip is a single connection in transaction mode. Use transactions only for `column.reorder` (multiple updates). Verify with a test if uncertain.

---

## Sources

### Primary (HIGH confidence)
- Phase 1 benchmark `01-03-SUMMARY.md` — ROW tuple vs OR cursor benchmark results confirmed in Supabase with 1M rows
- `src/server/db/schema.ts` (codebase read) — confirmed actual schema field names, column types, index definitions
- `src/server/api/trpc.ts` (codebase read) — confirmed protectedProcedure, timingMiddleware, createTRPCContext patterns already in place
- `package.json` (codebase read) — confirmed actual installed versions: `@trpc/react-query@^11.0.0` (resolved 11.13.4), `drizzle-orm@^0.36.4`, `zod@^3.23.8`
- https://trpc.io/docs/client/react/useInfiniteQuery — useInfiniteQuery API, cursor input requirements, getNextPageParam pattern
- https://orm.drizzle.team/docs/dynamic-query-building — `.$dynamic()` API, `PgSelect` type, filter accumulation pattern
- https://orm.drizzle.team/docs/guides/cursor-based-pagination — composite cursor, ROW tuple SQL syntax
- https://orm.drizzle.team/docs/guides/conditional-filters-in-query — `and()` with undefined, ilike pattern
- https://orm.drizzle.team/docs/operators — ilike, inArray, and, or, gt, lt, gte, lte operators confirmed available
- https://orm.drizzle.team/docs/column-types/pg#jsonb — `.$type<>()` pattern, `sql` template for JSONB operators
- https://trpc.io/docs/server/procedures — protectedProcedure pattern, .input()/.query()/.mutation()

### Secondary (MEDIUM confidence)
- https://orm.drizzle.team/docs/select#order-by — dynamic ORDER BY with sql template for JSONB fields
- `node_modules/@trpc/` directory listing — confirmed `@trpc/react-query` is the installed package (not `@trpc/tanstack-react-query`)
- `node_modules/drizzle-orm/sql/expressions/conditions.d.ts` — confirmed `ilike` and `inArray` exports in 0.36.4

### Tertiary (LOW confidence)
- JSONB `cells::text ilike '%query%'` pattern for full-text search: logical inference from PostgreSQL capabilities, not benchmarked; treat as starting point
- Supavisor + Drizzle transaction compatibility: confirmed `prepare: false` needed for statements; transaction behavior not explicitly tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from `package.json` and `node_modules`
- Architecture: HIGH — follows existing tRPC patterns in codebase; routers are standard
- ROW tuple cursor: HIGH — benchmarked result from Phase 1, 3000x performance difference confirmed
- JSONB filter pattern: HIGH — official Drizzle docs, `sql` template is the documented approach
- Sort + cursor interaction for non-rowOrder sorts: MEDIUM — logical inference, not benchmarked
- searchQuery full-JSONB-cast approach: LOW — not benchmarked; may be slow on large datasets

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days — stack is stable; Drizzle 0.36.4 and tRPC 11.13.4 are the pinned versions)
