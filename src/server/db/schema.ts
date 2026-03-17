import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Multi-project schema prefix. All tables are prefixed with "airtable_".
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `airtable_${name}`);

// ---------------------------------------------------------------------------
// Auth.js adapter tables (required by @auth/drizzle-adapter)
// ---------------------------------------------------------------------------

export const users = createTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  bases: many(bases),
}));

export const accounts = createTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_user_id_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const bases = createTable(
  "base",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (base) => ({
    userIdIdx: index("base_user_id_idx").on(base.userId),
  }),
);

export const basesRelations = relations(bases, ({ one, many }) => ({
  user: one(users, { fields: [bases.userId], references: [users.id] }),
  tables: many(tables),
}));

export const tables = createTable(
  "table",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    baseId: text("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    baseIdIdx: index("table_base_id_idx").on(table.baseId),
  }),
);

export const tablesRelations = relations(tables, ({ one, many }) => ({
  base: one(bases, { fields: [tables.baseId], references: [bases.id] }),
  columns: many(columns),
  rows: many(rows),
  views: many(views),
}));

export const columns = createTable(
  "column",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["text", "number"] }).default("text").notNull(),
    order: integer("order").default(0).notNull(),
  },
  (column) => ({
    tableIdIdx: index("column_table_id_idx").on(column.tableId),
  }),
);

export const columnsRelations = relations(columns, ({ one }) => ({
  table: one(tables, { fields: [columns.tableId], references: [tables.id] }),
}));

export const rows = createTable(
  "row",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    rowOrder: integer("row_order").default(0).notNull(),
    cells: jsonb("cells")
      .$type<Record<string, string | number | null>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (row) => ({
    // Keyset cursor pagination index: (tableId, rowOrder, id)
    tableIdRowOrderIdIdx: index("row_tableId_rowOrder_id_idx").on(
      row.tableId,
      row.rowOrder,
      row.id,
    ),
  }),
);

export const rowsRelations = relations(rows, ({ one }) => ({
  table: one(tables, { fields: [rows.tableId], references: [tables.id] }),
}));

export const views = createTable(
  "view",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config")
      .$type<{
        filters: unknown[];
        sorts: unknown[];
        hiddenColumns: string[];
        searchQuery: string;
      }>()
      .default({ filters: [], sorts: [], hiddenColumns: [], searchQuery: "" })
      .notNull(),
  },
  (view) => ({
    tableIdIdx: index("view_table_id_idx").on(view.tableId),
  }),
);

export const viewsRelations = relations(views, ({ one }) => ({
  table: one(tables, { fields: [views.tableId], references: [tables.id] }),
}));
