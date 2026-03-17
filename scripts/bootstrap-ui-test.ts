import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle({ client, schema });

async function bootstrap() {
  const userId = "ui-user-1";
  const baseId = "ui-base-1";
  const tableId = "ui-table-1";
  const viewId = "ui-view-1";
  const columns: Array<{ id: string; name: string; type: "text" | "number"; order: number }> = [
    { id: "ui-col-name", name: "Name", type: "text", order: 0 },
    { id: "ui-col-notes", name: "Notes", type: "text", order: 1 },
    { id: "ui-col-status", name: "Status", type: "text", order: 2 },
  ];

  await db
    .insert(schema.users)
    .values({ id: userId, name: "UI Tester", email: "ui@test.com" })
    .onConflictDoNothing();

  await db
    .insert(schema.bases)
    .values({ id: baseId, name: "Untitled Base", userId })
    .onConflictDoNothing();

  await db
    .insert(schema.tables)
    .values({ id: tableId, name: "Table 1", baseId })
    .onConflictDoNothing();

  await db
    .insert(schema.columns)
    .values(
      columns.map((col) => ({
        ...col,
        tableId,
      })),
    )
    .onConflictDoNothing();

  // Reset rows for deterministic UI tests
  await db.delete(schema.rows).where(eq(schema.rows.tableId, tableId));
  await db.insert(schema.rows).values(
    Array.from({ length: 10 }, (_, idx) => ({
      tableId,
      rowOrder: idx,
      cells: {
        "ui-col-name": `Row ${idx + 1}`,
        "ui-col-notes": "Layout verification row",
        "ui-col-status": idx % 2 === 0 ? "Todo" : "In Progress",
      },
    })),
  );

  await db
    .insert(schema.views)
    .values({
      id: viewId,
      tableId,
      name: "Grid view",
      config: {
        filters: [],
        sorts: [],
        hiddenColumns: [],
        searchQuery: "",
      },
    })
    .onConflictDoNothing();

  console.log("UI test data ready.");
  await client.end();
}

bootstrap().catch((error) => {
  console.error(error);
  return client.end();
});
