import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, tables, columns, rows, views } from "~/server/db/schema";

export const baseRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [base] = await ctx.db
        .select()
        .from(bases)
        .where(and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)));
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });
      return base;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(bases)
      .where(eq(bases.userId, ctx.session.user.id));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(bases)
        .values({ name: input.name, userId: ctx.session.user.id })
        .returning();

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // Create default table with seed data in one go
      const [table] = await ctx.db
        .insert(tables)
        .values({ name: "Table 1", baseId: created.id })
        .returning();

      if (table) {
        const [nameCol, notesCol, statusCol] = await ctx.db
          .insert(columns)
          .values([
            { tableId: table.id, name: "Name", type: "text" as const, order: 0, isPrimary: true },
            { tableId: table.id, name: "Notes", type: "text" as const, order: 1 },
            { tableId: table.id, name: "Status", type: "text" as const, order: 2 },
          ])
          .returning();

        if (nameCol && notesCol && statusCol) {
          const { faker } = await import("@faker-js/faker");
          // Insert rows and view in parallel
          await Promise.all([
            ctx.db.insert(rows).values(
              Array.from({ length: 10 }, (_, i) => ({
                tableId: table.id,
                rowOrder: i,
                cells: {
                  [nameCol.id]: faker.person.fullName(),
                  [notesCol.id]: faker.lorem.sentence(),
                  [statusCol.id]: faker.helpers.arrayElement(["Todo", "In Progress", "Done"]),
                } as Record<string, string | number | null>,
              })),
            ),
            ctx.db.insert(views).values({
              tableId: table.id,
              name: "Grid view",
              config: { filters: [], sorts: [], hiddenColumns: [], searchQuery: "" },
            }),
          ]);
        }
      }

      return created;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(255).optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(bases)
        .set({ ...(input.name ? { name: input.name } : {}), ...(input.color !== undefined ? { color: input.color } : {}), updatedAt: new Date() })
        .where(
          and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),

  touch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(bases)
        .set({ lastOpenedAt: new Date() })
        .where(
          and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(bases)
        .where(
          and(eq(bases.id, input.id), eq(bases.userId, ctx.session.user.id)),
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return deleted;
    }),
});
