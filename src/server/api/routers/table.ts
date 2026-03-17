import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, columns, rows, tables, views } from "~/server/db/schema";

export const tableRouter = createTRPCRouter({
  getByBaseId: protectedProcedure
    .input(z.object({ baseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db
        .select()
        .from(bases)
        .where(
          and(eq(bases.id, input.baseId), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (base.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(tables)
        .where(eq(tables.baseId, input.baseId))
        .orderBy(asc(tables.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string().uuid(),
        name: z.string().min(1).max(255),
        seed: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify base ownership
      const base = await ctx.db
        .select()
        .from(bases)
        .where(
          and(eq(bases.id, input.baseId), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (base.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Insert the table
      const [table] = await ctx.db
        .insert(tables)
        .values({ name: input.name, baseId: input.baseId })
        .returning();

      if (!table) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      if (input.seed) {
        // Create 3 default columns
        const [nameCol, notesCol, statusCol] = await ctx.db
          .insert(columns)
          .values([
            { tableId: table.id, name: "Name", type: "text", order: 0 },
            { tableId: table.id, name: "Notes", type: "text", order: 1 },
            { tableId: table.id, name: "Status", type: "text", order: 2 },
          ])
          .returning();

        if (!nameCol || !notesCol || !statusCol) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        const nameColId = nameCol.id;
        const notesColId = notesCol.id;
        const statusColId = statusCol.id;

        // Create 10 rows with faker data
        const { faker } = await import("@faker-js/faker");

        await ctx.db.insert(rows).values(
          Array.from({ length: 10 }, (_, i) => ({
            tableId: table.id,
            rowOrder: i,
            cells: {
              [nameColId]: faker.person.fullName(),
              [notesColId]: faker.lorem.sentence(),
              [statusColId]: faker.helpers.arrayElement([
                "Todo",
                "In Progress",
                "Done",
              ]),
            } as Record<string, string | number | null>,
          })),
        );

        // Create default Grid View
        await ctx.db.insert(views).values({
          tableId: table.id,
          name: "Grid View",
          config: {
            filters: [],
            sorts: [],
            hiddenColumns: [],
            searchQuery: "",
          },
        });
      }

      return table;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via join
      const result = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(and(eq(tables.id, input.id), eq(bases.userId, ctx.session.user.id)))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(tables)
        .set({ name: input.name })
        .where(eq(tables.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via join
      const result = await ctx.db
        .select({ tableId: tables.id })
        .from(tables)
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(and(eq(tables.id, input.id), eq(bases.userId, ctx.session.user.id)))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deleted] = await ctx.db
        .delete(tables)
        .where(eq(tables.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return deleted;
    }),
});
