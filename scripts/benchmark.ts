import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { and, asc, eq, gt, or } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle({ client, schema });

async function runBenchmark(label: string, fn: () => Promise<unknown[]>): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const median = times.sort((a, b) => a - b)[1]!;
  const pass = median < 200;
  console.log(`${label}: ${median.toFixed(1)}ms ${pass ? "PASS" : "FAIL (>200ms)"}`);
  return median;
}

async function benchmark() {
  console.log("\n=== Cursor Pagination Benchmark ===");
  console.log("Table: seed-table-1 (1M rows)\n");

  // Benchmark 1: First page (no cursor)
  await runBenchmark("First page (100 rows, no cursor)", () =>
    db.select()
      .from(schema.rows)
      .where(eq(schema.rows.tableId, "seed-table-1"))
      .orderBy(asc(schema.rows.rowOrder), asc(schema.rows.id))
      .limit(100)
  );

  // Benchmark 2: Mid-table cursor (~500k)
  await runBenchmark("Mid-table cursor (rowOrder=500000, 100 rows)", () =>
    db.select()
      .from(schema.rows)
      .where(and(
        eq(schema.rows.tableId, "seed-table-1"),
        or(
          gt(schema.rows.rowOrder, 500000),
          and(eq(schema.rows.rowOrder, 500000), gt(schema.rows.id, "zzz"))
        )
      ))
      .orderBy(asc(schema.rows.rowOrder), asc(schema.rows.id))
      .limit(100)
  );

  // Benchmark 3: Near end (~990k)
  await runBenchmark("End-table cursor (rowOrder=990000, 100 rows)", () =>
    db.select()
      .from(schema.rows)
      .where(and(
        eq(schema.rows.tableId, "seed-table-1"),
        or(
          gt(schema.rows.rowOrder, 990000),
          and(eq(schema.rows.rowOrder, 990000), gt(schema.rows.id, "zzz"))
        )
      ))
      .orderBy(asc(schema.rows.rowOrder), asc(schema.rows.id))
      .limit(100)
  );

  // Benchmark 4: Large page
  await runBenchmark("Large page (500 rows, no cursor)", () =>
    db.select()
      .from(schema.rows)
      .where(eq(schema.rows.tableId, "seed-table-1"))
      .orderBy(asc(schema.rows.rowOrder), asc(schema.rows.id))
      .limit(500)
  );

  console.log("\nTarget: all queries < 200ms");
  await client.end();
}

benchmark().catch(console.error);
