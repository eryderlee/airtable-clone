import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, tables, views } from "~/server/db/schema";

export const viewRouter = createTRPCRouter({
  getByTableId: protectedProcedure
    .input(z.object({ tableId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify table ownership via 2-level join
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
        .from(views)
        .where(eq(views.tableId, input.tableId))
        .orderBy(asc(views.id));
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify table ownership
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

      const [created] = await ctx.db
        .insert(views)
        .values({
          tableId: input.tableId,
          name: input.name,
          config: {
            filters: [],
            sorts: [],
            hiddenColumns: [],
            searchQuery: "",
          },
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
      // 3-level ownership check: view -> table -> base -> userId
      const result = await ctx.db
        .select({ viewId: views.id })
        .from(views)
        .innerJoin(tables, eq(views.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(eq(views.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(views)
        .set({ name: input.name })
        .where(eq(views.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        config: z.object({
          filters: z.array(z.any()).optional(),
          sorts: z.array(z.any()).optional(),
          hiddenColumns: z.array(z.string().uuid()).optional(),
          searchQuery: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 3-level ownership check
      const result = await ctx.db
        .select({ viewId: views.id, config: views.config })
        .from(views)
        .innerJoin(tables, eq(views.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(eq(views.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // result.length > 0 guaranteed by guard above; extract first element safely
      const [currentView] = result as [NonNullable<(typeof result)[0]>];

      // Partial merge: only overwrite fields that are provided
      const mergedConfig = {
        ...currentView.config,
        ...Object.fromEntries(
          Object.entries(input.config).filter(([, v]) => v !== undefined),
        ),
      } as {
        filters: unknown[];
        sorts: unknown[];
        hiddenColumns: string[];
        searchQuery: string;
      };

      const [updated] = await ctx.db
        .update(views)
        .set({ config: mergedConfig })
        .where(eq(views.id, input.id))
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
        .select({ viewId: views.id })
        .from(views)
        .innerJoin(tables, eq(views.tableId, tables.id))
        .innerJoin(bases, eq(tables.baseId, bases.id))
        .where(
          and(eq(views.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deleted] = await ctx.db
        .delete(views)
        .where(eq(views.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return deleted;
    }),
});
