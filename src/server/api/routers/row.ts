import { and, asc, count, eq, gte, inArray, max, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, columns, rows, tables, views } from "~/server/db/schema";

// ---------------------------------------------------------------------------
// Filter / Sort schemas
// ---------------------------------------------------------------------------

const textFilterSchema = z.object({
  type: z.literal("text"),
  operator: z.enum([
    "contains",
    "does_not_contain",
    "equals",
    "is_empty",
    "is_not_empty",
  ]),
  value: z.string().optional(),
});

const numberFilterSchema = z.object({
  type: z.literal("number"),
  operator: z.enum(["greater_than", "less_than"]),
  value: z.number(),
});

const filterConditionSchema = z.object({
  columnId: z.string().uuid(),
  filter: z.discriminatedUnion("type", [textFilterSchema, numberFilterSchema]),
});

const sortConditionSchema = z.object({
  columnId: z.string().uuid(),
  direction: z.enum(["asc", "desc"]),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type SortCondition = z.infer<typeof sortConditionSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFilterConditions(
  conditions: (SQL | undefined)[],
  filters: FilterCondition[],
  conjunction: "and" | "or",
) {
  const clauses = buildFilterConditions(filters);
  if (clauses.length === 0) return;
  if (conjunction === "or") {
    conditions.push(or(...clauses));
  } else {
    conditions.push(...clauses);
  }
}

function buildFilterConditions(filters: FilterCondition[]): SQL[] {
  return filters.flatMap((f) => {
    if (f.filter.type === "text") {
      switch (f.filter.operator) {
        case "contains":
          return [sql`${rows.cells}->>${f.columnId} ilike ${"%" + (f.filter.value ?? "") + "%"}`];
        case "does_not_contain":
          return [sql`(${rows.cells}->>${f.columnId} is null or ${rows.cells}->>${f.columnId} not ilike ${"%" + (f.filter.value ?? "") + "%"})`];
        case "equals":
          return [sql`${rows.cells}->>${f.columnId} = ${f.filter.value ?? ""}`];
        case "is_empty":
          return [sql`(${rows.cells}->>${f.columnId} is null or ${rows.cells}->>${f.columnId} = '')`];
        case "is_not_empty":
          return [sql`(${rows.cells}->>${f.columnId} is not null and ${rows.cells}->>${f.columnId} != '')`];
      }
    } else {
      // number
      switch (f.filter.operator) {
        case "greater_than":
          return [sql`CAST(${rows.cells}->>${f.columnId} AS numeric) > ${f.filter.value}`];
        case "less_than":
          return [sql`CAST(${rows.cells}->>${f.columnId} AS numeric) < ${f.filter.value}`];
      }
    }
  });
}

function buildSortOrder(sorts: SortCondition[], columnTypeMap: Record<string, string>): SQL[] {
  const clauses: SQL[] = sorts.map((s) => {
    const dir = sql.raw(s.direction === "asc" ? "asc nulls last" : "desc nulls last");
    const key = sql.raw(`'${s.columnId.replace(/'/g, "''")}'`);
    if (columnTypeMap[s.columnId] === "number") {
      return sql`CAST(${rows.cells}->>${key} AS numeric) ${dir}`;
    } else {
      return sql`${rows.cells}->>${key} ${dir}`;
    }
  });

  // Stable tie-breaker: (rowOrder asc, id asc)
  clauses.push(sql`"row_order" ASC`);
  clauses.push(sql`"id" ASC`);

  return clauses;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const rowRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // getRows: cursor-paginated query with filters, sorts, search, and view merge
  // -------------------------------------------------------------------------
  getRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        cursor: z
          .object({
            rowOrder: z.number().int(),
            id: z.string().uuid(),
          })
          .optional(),
        limit: z.number().int().min(1).max(1000).default(100),
        filters: z.array(filterConditionSchema).default([]),
        sorts: z.array(sortConditionSchema).default([]),
        searchQuery: z.string().default(""),
        viewId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Verify ownership
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // 2. Resolve view config — call-time params override stored values
      let effectiveFilters: FilterCondition[] = input.filters;
      let effectiveSorts: SortCondition[] = input.sorts;
      let effectiveSearch: string = input.searchQuery;

      if (input.viewId) {
        const viewResult = await ctx.db
          .select()
          .from(views)
          .where(eq(views.id, input.viewId))
          .limit(1);

        const view = viewResult[0];
        if (view) {
          if (effectiveFilters.length === 0) {
            effectiveFilters = view.config.filters as FilterCondition[];
          }
          if (effectiveSorts.length === 0) {
            effectiveSorts = view.config.sorts as SortCondition[];
          }
          if (!effectiveSearch) {
            effectiveSearch = view.config.searchQuery ?? "";
          }
        }
      }

      // 3. Fetch column types (only if sorts present)
      let columnTypeMap: Record<string, string> = {};
      if (effectiveSorts.length > 0) {
        const cols = await ctx.db
          .select({ id: columns.id, type: columns.type })
          .from(columns)
          .where(eq(columns.tableId, input.tableId));

        columnTypeMap = Object.fromEntries(cols.map((c) => [c.id, c.type]));
      }

      // 4. Build WHERE conditions
      const conditions: SQL[] = [
        sql`${rows.tableId} = ${input.tableId}`,
      ];

      if (input.cursor) {
        // ROW tuple comparison — uses composite index directly
        conditions.push(
          sql`(${rows.rowOrder}, ${rows.id}) > (${input.cursor.rowOrder}, ${input.cursor.id})`,
        );
      }

      // Filter conditions
      const filterClauses = buildFilterConditions(effectiveFilters);
      conditions.push(...filterClauses);

      // Search
      if (effectiveSearch.trim()) {
        conditions.push(
          sql`${rows.cells}::text ilike ${"%" + effectiveSearch + "%"}`,
        );
      }

      // 5. Build ORDER BY
      const orderClauses = buildSortOrder(effectiveSorts, columnTypeMap);

      // 6. Execute query — .$dynamic() required for runtime-composed where/orderBy
      const result = await ctx.db
        .select()
        .from(rows)
        .$dynamic()
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(input.limit + 1);

      // 7. Compute nextCursor
      const hasNextPage = result.length > input.limit;
      const items = hasNextPage ? result.slice(0, input.limit) : result;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasNextPage && lastItem
          ? { rowOrder: lastItem.rowOrder, id: lastItem.id }
          : null;

      return { items, nextCursor };
    }),

  // -------------------------------------------------------------------------
  // create: insert a new row with auto-incremented rowOrder
  // -------------------------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        cells: z
          .record(z.string(), z.union([z.string(), z.number(), z.null()]))
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify table ownership
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Get max rowOrder
      const [maxResult] = await ctx.db
        .select({ maxOrder: max(rows.rowOrder) })
        .from(rows)
        .where(eq(rows.tableId, input.tableId));

      const maxRowOrder = maxResult?.maxOrder ?? -1;

      const [created] = await ctx.db
        .insert(rows)
        .values({
          tableId: input.tableId,
          rowOrder: maxRowOrder + 1,
          cells: input.cells,
        })
        .returning();

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return created;
    }),

  // -------------------------------------------------------------------------
  // update: patch cells without overwriting unmodified keys
  // -------------------------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        cells: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.null()]),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 3-level ownership check: row -> table -> base -> userId
      const result = await ctx.db
        .select({ rowId: rows.id, cells: rows.cells })
        .from(rows)
        .innerJoin(tables, eq(rows.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(eq(rows.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [currentRow] = result as [NonNullable<(typeof result)[0]>];

      // Patch: merge without overwriting unmodified keys
      const mergedCells = {
        ...currentRow.cells,
        ...input.cells,
      };

      const [updated] = await ctx.db
        .update(rows)
        .set({ cells: mergedCells })
        .where(eq(rows.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),

  // -------------------------------------------------------------------------
  // delete: remove a row and recompact row_order to close the gap
  // -------------------------------------------------------------------------
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 3-level ownership check — also grab tableId and rowOrder for recompaction
      const result = await ctx.db
        .select({ rowId: rows.id, tableId: rows.tableId, rowOrder: rows.rowOrder })
        .from(rows)
        .innerJoin(tables, eq(rows.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(eq(rows.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const row = result[0];

      await ctx.db.delete(rows).where(eq(rows.id, input.id));

      // Recompact: decrement row_order for all rows after the deleted one
      // so the sequence stays dense (required for the O(log n) fast-path seek).
      await ctx.db
        .update(rows)
        .set({ rowOrder: sql`${rows.rowOrder} - 1` })
        .where(
          and(
            eq(rows.tableId, row.tableId),
            sql`${rows.rowOrder} > ${row.rowOrder}`,
          ),
        );

      return { id: input.id };
    }),

  // -------------------------------------------------------------------------
  // deleteMany: remove multiple rows and fully recompact row_order
  // -------------------------------------------------------------------------
  deleteMany: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(10000),
        tableId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify table ownership
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Delete all rows (scoped to tableId for safety)
      await ctx.db
        .delete(rows)
        .where(
          and(eq(rows.tableId, input.tableId), inArray(rows.id, input.ids)),
        );

      // Full recompaction: renumber all remaining rows from 0 in row_order order.
      // O(n) write, but runs once for the whole batch — correct for any deletion pattern.
      await ctx.db.execute(sql`
        UPDATE "airtable_row" r
        SET row_order = sub.rn
        FROM (
          SELECT id,
                 (ROW_NUMBER() OVER (ORDER BY row_order ASC, id ASC) - 1) AS rn
          FROM "airtable_row"
          WHERE table_id = ${input.tableId}
        ) sub
        WHERE r.id = sub.id
          AND r.table_id = ${input.tableId}
      `);

      return { count: input.ids.length };
    }),

  // -------------------------------------------------------------------------
  // bulkCreate: insert up to 100k rows in a single Postgres generate_series query
  // -------------------------------------------------------------------------
  bulkCreate: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        count: z.number().int().min(1).max(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify table ownership
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Get max rowOrder
      const [maxResult] = await ctx.db
        .select({ maxOrder: max(rows.rowOrder) })
        .from(rows)
        .where(eq(rows.tableId, input.tableId));

      const startOrder = (maxResult?.maxOrder ?? -1) + 1;

      // Fetch columns to build per-column JSONB expression
      const cols = await ctx.db
        .select({ id: columns.id, type: columns.type })
        .from(columns)
        .where(eq(columns.tableId, input.tableId));

      // Dynamic import for faker (production dep, avoid static bundle cost)
      const { faker } = await import("@faker-js/faker");

      // Build a 200-word vocabulary from faker once, then compose unique 3-word
      // phrases per row using Math.random() (native V8, ~100x faster than faker RNG).
      // 200³ = 8M combinations — unique for every row in 100k.
      const VOCAB = 200;
      const words = Array.from({ length: VOCAB }, () => faker.lorem.word());

      const allCells = Array.from({ length: input.count }, () => {
        const cells: Record<string, string | number | null> = {};
        for (const col of cols) {
          if (col.type === "number") {
            cells[col.id] = Math.floor(Math.random() * 10001);
          } else {
            cells[col.id] = `${words[Math.floor(Math.random() * VOCAB)]!} ${words[Math.floor(Math.random() * VOCAB)]!} ${words[Math.floor(Math.random() * VOCAB)]!}`;
          }
        }
        return cells;
      });

      // 5 parallel inserts via jsonb_array_elements — each chunk is ONE parameter,
      // no Postgres parameter limit, only 5 round-trips total (concurrent).
      const PARALLEL = 5;
      const chunkSize = Math.ceil(input.count / PARALLEL);

      await Promise.all(
        Array.from({ length: PARALLEL }, (_, i) => {
          const offset = i * chunkSize;
          const chunk = allCells.slice(offset, offset + chunkSize);
          if (chunk.length === 0) return Promise.resolve();
          const chunkStart = startOrder + offset;
          return ctx.db.execute(sql`
            INSERT INTO "airtable_row" (id, table_id, row_order, cells)
            SELECT
              gen_random_uuid(),
              ${input.tableId}::uuid,
              (${chunkStart} + (ordinality - 1))::int,
              value::jsonb
            FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb) WITH ORDINALITY
          `);
        }),
      );

      return { count: input.count };
    }),

  // -------------------------------------------------------------------------
  // deleteFromOrder: delete all rows at or above a given rowOrder (benchmark cleanup)
  // -------------------------------------------------------------------------
  deleteFromOrder: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        fromOrder: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db
        .delete(rows)
        .where(
          and(
            eq(rows.tableId, input.tableId),
            gte(rows.rowOrder, input.fromOrder),
          ),
        );

      return { deleted: true };
    }),

  // -------------------------------------------------------------------------
  // getByOffset: offset-based row fetch for random-access virtual scrolling
  // -------------------------------------------------------------------------
  getByOffset: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        offset: z.number().int().min(0),
        limit: z.number().int().min(1).max(500).default(100),
        filters: z.array(filterConditionSchema).default([]),
        filterConjunction: z.enum(["and", "or"]).default("and"),
        sorts: z.array(sortConditionSchema).default([]),
        searchQuery: z.string().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const isFastPath =
        input.sorts.length === 0 &&
        input.filters.length === 0 &&
        !input.searchQuery.trim();

      if (isFastPath) {
        // Fast path: rowOrder >= offset seek — O(log n) via composite index.
        // Assumes dense rowOrder (no gaps from deletions). Valid for this phase.
        const items = await ctx.db
          .select()
          .from(rows)
          .where(
            and(
              eq(rows.tableId, input.tableId),
              sql`${rows.rowOrder} >= ${input.offset}`,
            ),
          )
          .orderBy(asc(rows.rowOrder), asc(rows.id))
          .limit(input.limit);

        return { items };
      }

      // General path: filter/sort/search active — must use true SQL OFFSET
      // because sort order may not match rowOrder order.

      // Build WHERE conditions
      const conditions: SQL[] = [eq(rows.tableId, input.tableId)];

      applyFilterConditions(conditions, input.filters, input.filterConjunction);

      if (input.searchQuery.trim()) {
        conditions.push(
          sql`${rows.cells}::text ilike ${"%" + input.searchQuery + "%"}`,
        );
      }

      // Fetch column types for sort (only if sorts present)
      let columnTypeMap: Record<string, string> = {};
      if (input.sorts.length > 0) {
        const cols = await ctx.db
          .select({ id: columns.id, type: columns.type })
          .from(columns)
          .where(eq(columns.tableId, input.tableId));
        columnTypeMap = Object.fromEntries(cols.map((c) => [c.id, c.type]));
      }

      const orderClauses = buildSortOrder(input.sorts, columnTypeMap);

      const items = await ctx.db
        .select()
        .from(rows)
        .$dynamic()
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(input.limit)
        .offset(input.offset);

      return { items };
    }),

  // -------------------------------------------------------------------------
  // getAllIds: return all row IDs for a table — used for select-all
  // -------------------------------------------------------------------------
  getAllIds: protectedProcedure
    .input(z.object({ tableId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const result = await ctx.db
        .select({ id: rows.id })
        .from(rows)
        .where(eq(rows.tableId, input.tableId))
        .orderBy(asc(rows.rowOrder), asc(rows.id));

      return result.map((r) => r.id);
    }),

  // -------------------------------------------------------------------------
  // count: COUNT(*) for a table with optional filter/search — drives virtualizer height
  // -------------------------------------------------------------------------
  count: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        filters: z.array(filterConditionSchema).default([]),
        filterConjunction: z.enum(["and", "or"]).default("and"),
        searchQuery: z.string().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ownership = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(tables.id, input.tableId),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (ownership.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const conditions: SQL[] = [eq(rows.tableId, input.tableId)];

      applyFilterConditions(conditions, input.filters, input.filterConjunction);

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
});
