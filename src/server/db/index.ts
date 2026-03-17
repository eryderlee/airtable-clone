import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 *
 * prepare: false is required for Supabase Supavisor (transaction pooler, port 6543).
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // Lazy connection - only connect when a query is actually made
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
