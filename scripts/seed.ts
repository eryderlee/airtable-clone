import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";

// Use DATABASE_URL (transaction pooler port 6543) since Supabase direct host is IPv6-only on this machine
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle({ client, schema });

const TOTAL_ROWS = 1_000_000;
const CHUNK_SIZE = 1_000;

async function seed() {
  console.log("Starting seed...");
  const start = Date.now();

  // Upsert test user
  await db.insert(schema.users).values({
    id: "seed-user-1",
    name: "Test User",
    email: "test@example.com",
  }).onConflictDoNothing();

  // Upsert test base
  await db.insert(schema.bases).values({
    id: "seed-base-1",
    name: "Performance Test Base",
    userId: "seed-user-1",
  }).onConflictDoNothing();

  // Upsert test table
  await db.insert(schema.tables).values({
    id: "seed-table-1",
    name: "Million Row Table",
    baseId: "seed-base-1",
  }).onConflictDoNothing();

  // Upsert test columns
  await db.insert(schema.columns).values([
    { id: "col-name", tableId: "seed-table-1", name: "Name", type: "text", order: 0 },
    { id: "col-age", tableId: "seed-table-1", name: "Age", type: "number", order: 1 },
    { id: "col-email", tableId: "seed-table-1", name: "Email", type: "text", order: 2 },
  ]).onConflictDoNothing();

  // Check existing row count
  const existingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rows)
    .where(sql`${schema.rows.tableId} = 'seed-table-1'`);
  const existingCount = existingRows[0]?.count ?? 0;

  if (existingCount >= TOTAL_ROWS) {
    console.log(`Already have ${existingCount} rows, skipping insert`);
  } else {
    const startRow = existingCount;
    console.log(`Inserting rows ${startRow} to ${TOTAL_ROWS}...`);

    for (let i = startRow; i < TOTAL_ROWS; i += CHUNK_SIZE) {
      const chunk = Array.from({ length: Math.min(CHUNK_SIZE, TOTAL_ROWS - i) }, (_, j) => ({
        tableId: "seed-table-1",
        rowOrder: i + j,
        cells: {
          "col-name": faker.person.fullName(),
          "col-age": faker.number.int({ min: 18, max: 90 }),
          "col-email": faker.internet.email(),
        },
      }));
      await db.insert(schema.rows).values(chunk);
      if ((i + CHUNK_SIZE) % 100_000 === 0) {
        console.log(
          `Progress: ${i + CHUNK_SIZE} / ${TOTAL_ROWS} rows (${Math.round(((i + CHUNK_SIZE) / TOTAL_ROWS) * 100)}%)`
        );
      }
    }
  }

  // Run ANALYZE — table name uses "airtable_" prefix
  console.log("Running ANALYZE...");
  await db.execute(sql`ANALYZE "airtable_row"`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Seed complete in ${elapsed}s`);
  await client.end();
}

seed().catch(console.error);
