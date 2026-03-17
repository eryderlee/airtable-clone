import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, columns, tables } from "~/server/db/schema";

export const columnRouter = createTRPCRouter({
  getByTableId: protectedProcedure
    .input(z.object({ tableId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership via join
      const result = await ctx.db
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

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(columns)
        .where(eq(columns.tableId, input.tableId))
        .orderBy(asc(columns.order));
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        name: z.string().min(1).max(255),
        type: z.enum(["text", "number"]).default("text"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via join
      const result = await ctx.db
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

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Get max order value for existing columns
      const [maxResult] = await ctx.db
        .select({ maxOrder: max(columns.order) })
        .from(columns)
        .where(eq(columns.tableId, input.tableId));

      const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

      const [created] = await ctx.db
        .insert(columns)
        .values({
          tableId: input.tableId,
          name: input.name,
          type: input.type,
          order: nextOrder,
        })
        .returning();

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 3-level ownership check: column -> table -> base -> userId
      const result = await ctx.db
        .select({ columnId: columns.id })
        .from(columns)
        .innerJoin(tables, eq(columns.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(columns.id, input.id),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(columns)
        .set({ name: input.name })
        .where(eq(columns.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 3-level ownership check
      const result = await ctx.db
        .select({ columnId: columns.id })
        .from(columns)
        .innerJoin(tables, eq(columns.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(
            eq(columns.id, input.id),
            eq(bases.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deleted] = await ctx.db
        .delete(columns)
        .where(eq(columns.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return deleted;
    }),
});
