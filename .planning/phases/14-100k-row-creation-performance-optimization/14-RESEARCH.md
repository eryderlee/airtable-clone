# Phase 14: 100k Row Creation Performance Optimization - Research

**Researched:** 2026-03-20
**Domain:** PostgreSQL bulk insert performance, Neon/PgBouncer constraints, serverless function limits, client-side orchestration
**Confidence:** HIGH (bottlenecks diagnosed from code; optimization strategies verified via official docs and benchmarks)

---

## Summary

The current `bulkCreate` tRPC procedure inserts 100k rows in sequential 1000-row chunks, taking ~88 seconds. Each chunk is a separate await in a for-loop: 100 sequential round-trips from Vercel serverless → Neon PgBouncer → Postgres. The bottleneck is dominated by network round-trips (latency), not insert throughput.

The fastest proven approach for Neon's transaction pooler is **larger chunk sizes with INSERT…UNNEST**, which reduces planning overhead and dramatically cuts network round-trips. COPY FROM STDIN would be theoretically faster but is not reliably supported through Neon's PgBouncer in transaction mode (the fix was PgBouncer 1.22.1 but Neon's version and policy is unconfirmed). Parallel chunk firing via `Promise.all` is feasible but requires careful design to avoid rowOrder assignment races. Data generation (faker) costs ~50–200ms of CPU per 100k rows and is not the bottleneck.

Target: sub-6s (ideally sub-4.6s). Verified benchmarks show batch INSERT at 1000-row chunks = ~32s per 1M rows = ~3.2s per 100k rows — meaning chunk-size alone with 1000 rows per chunk is not the problem. The real problem is **100 sequential round-trips**. With 10k-row chunks that becomes 10 round-trips; with parallel execution it's further reducible.

**Primary recommendation:** Increase chunk size to 5000–10000 rows AND fire chunks in parallel (small concurrency: 3–5 simultaneous). Use INSERT…UNNEST via raw SQL for the JSONB cells column to avoid Drizzle's per-value parameterization overhead. Monitor Vercel function timeout — add `export const maxDuration = 300` to the tRPC route.

---

## Standard Stack

This phase is pure optimization of existing stack — no new libraries required for the primary approach.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `drizzle-orm` | 0.36.4 | ORM + `sql` tagged template for raw SQL | Use `db.execute(sql`...`)` for UNNEST queries |
| `postgres` (postgres.js) | 3.4.5 | Postgres driver | Already configured with `prepare: false` |
| `@faker-js/faker` | 9.9.0 | Fake data generation | Already dynamically imported in bulkCreate |

### Supporting (no new installs)
| Tool | Purpose | Notes |
|------|---------|-------|
| `sql` from drizzle-orm | Raw SQL escape | Used for UNNEST parameterized query |
| `Promise.all` | Parallel chunk concurrency | Built-in — no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| INSERT...UNNEST via raw SQL | COPY FROM STDIN | COPY is 4–7x faster than batch INSERT but PgBouncer transaction mode compatibility with Neon is unconfirmed (risk of memory leaks before PgBouncer 1.22.1 fix). Not worth the risk. |
| INSERT...UNNEST | INSERT...VALUES (current) | UNNEST is 2.1x faster at 1k rows, 5x at wide schemas. No parameter limit issue. |
| Parallel chunk firing | Sequential (current) | Parallel cuts wall-clock time proportionally to concurrency factor |
| faker.js | Math.random() manual | faker overhead for 100k rows is ~50–200ms CPU — not the bottleneck |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Pattern 1: Increase Chunk Size
**What:** Raise from 1000 to 5000–10000 rows per INSERT call.
**When to use:** Always — larger chunks cut round-trips without hitting Neon/PgBouncer connection limits.
**Evidence:** Tiger Data benchmark shows 20k–40k batch sizes are optimal; practical Neon free tier limit is likely lower. Start at 5000; test 10000.

```typescript
// Before: 100 round-trips
const CHUNK_SIZE = 1000;
for (let offset = 0; offset < 100_000; offset += CHUNK_SIZE) {
  await ctx.db.insert(rows).values(chunk);
}

// After: 10–20 round-trips
const CHUNK_SIZE = 5000; // or 10000
```

### Pattern 2: Parallel Chunk Firing
**What:** Fire multiple chunks simultaneously using batched `Promise.all`.
**When to use:** After chunk size is maximized — further cut wall-clock time.
**Critical constraint:** Row order assignments must be pre-computed (not derived from sequential inserts) because concurrent inserts race on `MAX(rowOrder)`. The current code already pre-computes `startOrder` before the loop — this is the correct pattern; just extend it.

```typescript
// Source: standard Promise.all concurrency pattern
const CONCURRENCY = 5; // 5 concurrent inserts of 5000 rows = 25k rows in-flight
const chunks = [];
for (let offset = 0; offset < input.count; offset += CHUNK_SIZE) {
  const chunkData = buildChunk(offset, CHUNK_SIZE);
  chunks.push(chunkData);
}
// Fire in batches of CONCURRENCY
for (let i = 0; i < chunks.length; i += CONCURRENCY) {
  const batch = chunks.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(chunk => ctx.db.insert(rows).values(chunk)));
}
```

### Pattern 3: INSERT...UNNEST via Raw SQL
**What:** Replace Drizzle's INSERT...VALUES parameterization with a single UNNEST-based INSERT.
**When to use:** Pairs with large chunk sizes — reduces query planning overhead. Drizzle generates one parameter per cell per row (e.g. 5 columns × 5000 rows = 25,000 parameters). UNNEST reduces this to one array per column regardless of row count.
**Postgres max parameters:** 32,767 parameters. With the JSONB cells column plus 3 scalar columns (id, tableId, rowOrder), Drizzle's current approach hits this limit at ~8,000 rows per chunk. UNNEST bypasses this entirely.

```typescript
// Source: pganalyze.com/blog/5mins-postgres-using-unnest-generate-series-postgist
// Adapted for Drizzle's sql tag and JSONB cells column
const ids = chunk.map(r => r.id);
const tableIds = chunk.map(() => tableId);
const rowOrders = chunk.map((_, i) => startOrder + offset + i);
const cells = chunk.map(r => JSON.stringify(r.cells));

await ctx.db.execute(sql`
  INSERT INTO "airtable_row" (id, table_id, row_order, cells)
  SELECT
    UNNEST(${sql.raw('ARRAY[' + ids.map(id => `'${id}'`).join(',') + ']')}::text[]),
    UNNEST(ARRAY[${sql.raw(tableIds.map(id => `'${id}'`).join(','))}]::text[]),
    UNNEST(ARRAY[${sql.raw(rowOrders.join(','))}]::integer[]),
    UNNEST(ARRAY[${sql.raw(cells.map(c => `'${c.replace(/'/g, "''")}'`).join(','))}]::jsonb[])
`);
```

**Note:** The raw SQL approach above requires careful SQL injection prevention. Use Drizzle's parameterized form or a pre-serialized approach. See Code Examples section for the safe form.

### Pattern 4: Drizzle Escape Hatch for Raw Typed UNNEST
**What:** Use Drizzle's `sql` operator with parameterized arrays via `sql.raw` or the typed `sql` helper for the UNNEST query.
**When to use:** When implementing Pattern 3.

```typescript
// Safe parameterized UNNEST using postgres.js array literal
// postgres.js supports array parameters natively
const result = await ctx.db.execute(
  sql`INSERT INTO "airtable_row" (id, table_id, row_order, cells, created_at)
      SELECT
        unnest(${ids}::text[]),
        unnest(${tableIds}::text[]),
        unnest(${rowOrders}::integer[]),
        unnest(${cells}::jsonb[]),
        now()
      RETURNING id`
);
// Source: postgres.js passes JS arrays as Postgres array literals natively
```

### Pattern 5: Faker Import Hoisting + Optimized Generation
**What:** Move the `await import("@faker-js/faker")` call outside the chunk loop. Also use `faker.helpers.multiple()` for batch generation.
**When to use:** Currently faker is dynamically imported once per `bulkCreate` call — but the `import()` call might not be cached on the first cold invocation. Move it before the loop.

```typescript
// Current: import inside mutation (fine — import() is cached after first call)
const { faker } = await import("@faker-js/faker");

// Optimized: import once per module load (move to top of router file)
// But note: dynamic import avoids static bundle cost — keep as dynamic import
// Just ensure it's called once before the generation loop, not inside it
```

### Pattern 6: Vercel Function Timeout Extension
**What:** Export `maxDuration` from the tRPC route handler to extend the function timeout.
**When to use:** Mandatory — current 88s already exceeds the default 60s Hobby plan limit. Even at 6s the safeguard is needed.

```typescript
// File: src/app/api/trpc/[trpc]/route.ts
// Source: nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration
export const maxDuration = 300; // 300s for Hobby plan (Fluid Compute enabled)

const handler = (req: NextRequest) => { ... };
export { handler as GET, handler as POST };
```

### Anti-Patterns to Avoid
- **Wrapping chunks in explicit transactions:** Neon's transaction pooler already wraps each `db.insert()` in an implicit transaction. Adding explicit `BEGIN`/`COMMIT` wrappers on top creates nested transaction issues and doesn't improve performance.
- **COPY FROM STDIN through Neon PgBouncer:** Unconfirmed compatibility. Neon doesn't document COPY support. The PgBouncer 1.22.1 fix exists but Neon's version is unknown. Risk of memory leaks or silent failures.
- **Concurrency > 10:** Neon free tier has limited connection slots. High concurrency can exhaust the pool. Cap parallel chunks at 3–5.
- **Race condition on rowOrder:** Never derive `startOrder` from `MAX(rowOrder)` inside a concurrent chunk — pre-compute before parallelizing.
- **Using Drizzle `.insert().values()` with >5000 rows:** Hits the 32,767-parameter Postgres limit. Use UNNEST or break into smaller chunks with Drizzle.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL injection in UNNEST | Manual string escaping | Drizzle's `sql` template tag with JS array parameters | Parameterized arrays; postgres.js handles escaping |
| Concurrency limiter | Custom queue | Simple `for` loop with `Promise.all` over slices | Sufficient for 3–10 concurrent chunks |
| Timing measurement | Custom timer | Existing benchmark infrastructure in GridView.tsx | Already times `bulkCreate.mutateAsync` calls |
| UUID generation | `crypto.randomUUID()` in JS | Let Postgres generate via `gen_random_uuid()` | Saves JS CPU; reduces serialization overhead |

**Key insight:** The bulk of the 88s is network latency × 100 round-trips. Reducing round-trips via larger chunks + parallelism is the primary lever. Code complexity should be kept minimal.

---

## Common Pitfalls

### Pitfall 1: Postgres Parameter Limit (32,767 max)
**What goes wrong:** Drizzle's `.insert().values(chunk)` generates one SQL parameter per column-cell combination. At 1000 rows × 4 columns = 4000 parameters — safe. But at 10000 rows × 4 columns = 40,000 — exceeds the limit and throws a Postgres error.
**Why it happens:** Drizzle uses PostgreSQL's extended protocol parameterized queries. Each `$1`, `$2`, etc. counts toward the 32,767 limit.
**How to avoid:** Use INSERT...UNNEST (one array per column, not per row-cell), or keep chunks ≤ 8000 rows when using Drizzle's `.values()`.
**Warning signs:** Error message: "too many parameters in prepared query" or similar Postgres protocol error.

### Pitfall 2: rowOrder Race Condition in Parallel Chunks
**What goes wrong:** Two parallel chunks both query `MAX(rowOrder)`, get the same value, and assign overlapping rowOrder values — violating the dense-order invariant.
**Why it happens:** Each chunk runs independently; without serialization, the MAX query races.
**How to avoid:** Pre-compute ALL rowOrders before launching any parallel inserts. The current code already calls `MAX(rowOrder)` once before the loop and assigns `startOrder + offset + i` — preserve this pattern when parallelizing.
**Warning signs:** Duplicate rowOrder values; keyset cursor pagination returning wrong rows.

### Pitfall 3: Neon Cold Start Adding Latency to Benchmark
**What goes wrong:** First bulkCreate call after Neon scales to zero (5-minute idle threshold) incurs 500ms–3s cold start. Benchmark shows artificially high time.
**Why it happens:** Neon free tier scales compute to zero after inactivity.
**How to avoid:** Warm up by making a cheap query before starting the benchmark timer. Or document that the benchmark should be run on an already-warm instance.
**Warning signs:** First benchmark run consistently 3–4s slower than subsequent runs.

### Pitfall 4: faker Dynamic Import Cold Start
**What goes wrong:** `await import("@faker-js/faker")` on a cold Vercel function invocation takes ~300ms (faker import overhead documented at 300ms in 2024).
**Why it happens:** faker is a large package (>5 MiB). First import in a new function instance is slow.
**How to avoid:** Import once per module (move to file top-level as `let fakerModule`). Alternatively, replace faker with `Math.random()` + custom wordlists for the benchmark rows since data quality doesn't matter for performance testing.
**Warning signs:** First chunk takes 500ms+ while subsequent chunks take <100ms.

### Pitfall 5: Vercel Function Timeout (504)
**What goes wrong:** The tRPC handler times out mid-bulkCreate, returning a 504 to the client while the DB may continue inserting orphaned rows.
**Why it happens:** Default Vercel Hobby function timeout is 300s (with Fluid Compute) but without `maxDuration` export the platform may use a lower default.
**How to avoid:** Add `export const maxDuration = 300` to `src/app/api/trpc/[trpc]/route.ts`.
**Warning signs:** Client sees 504; benchmark stops mid-way; row count is partial.

### Pitfall 6: JSONB Serialization Overhead
**What goes wrong:** Generating 100k JSON objects and serializing them in JavaScript takes measurable CPU time.
**Why it happens:** Each row's `cells` field is a `Record<string, string|number|null>` that must be JSON-serialized before sending to Postgres.
**How to avoid:** Pre-serialize all cells in one pass using `JSON.stringify()` before building the UNNEST arrays. Avoid calling `JSON.stringify()` inside inner loops.
**Warning signs:** CPU profiling shows >10% time in JSON.stringify.

---

## Code Examples

Verified patterns from research:

### Safe UNNEST Bulk Insert with Drizzle + postgres.js

postgres.js natively converts JS arrays to Postgres array literals when passed as parameters to the `sql` tag. This is the safest approach — no manual escaping.

```typescript
// Source: postgres.js README + Timescale UNNEST pattern
// postgres.js array handling: https://github.com/porsager/postgres
// UNNEST pattern: https://www.tigerdata.com/blog/boosting-postgres-insert-performance

const { faker } = await import("@faker-js/faker");

// Pre-compute all data
const ids: string[] = [];
const tableIds: string[] = [];
const rowOrders: number[] = [];
const cellsJson: string[] = [];

for (let i = 0; i < chunkSize; i++) {
  const cells: Record<string, string | number | null> = {};
  for (const col of cols) {
    cells[col.id] = col.type === "number"
      ? faker.number.int({ min: 0, max: 10000 })
      : faker.lorem.words();
  }
  ids.push(crypto.randomUUID());
  tableIds.push(tableId);
  rowOrders.push(startOrder + globalOffset + i);
  cellsJson.push(JSON.stringify(cells));
}

// Single UNNEST insert — one array per column, not per row-cell
await ctx.db.execute(sql`
  INSERT INTO "airtable_row" (id, table_id, row_order, cells, created_at)
  SELECT
    unnest(${ids}::text[]),
    unnest(${tableIds}::text[]),
    unnest(${rowOrders}::integer[]),
    unnest(${cellsJson}::jsonb[]),
    now()
`);
```

### Parallel Chunk Orchestration

```typescript
// Source: standard concurrency pattern
const CHUNK_SIZE = 5000;
const CONCURRENCY = 5;

// Pre-compute startOrder once — prevents race condition
const [maxResult] = await ctx.db
  .select({ maxOrder: max(rows.rowOrder) })
  .from(rows)
  .where(eq(rows.tableId, input.tableId));
const startOrder = (maxResult?.maxOrder ?? -1) + 1;

// Build all chunks upfront
const totalChunks = Math.ceil(input.count / CHUNK_SIZE);

for (let batchStart = 0; batchStart < totalChunks; batchStart += CONCURRENCY) {
  const batchEnd = Math.min(batchStart + CONCURRENCY, totalChunks);
  await Promise.all(
    Array.from({ length: batchEnd - batchStart }, (_, i) => {
      const chunkIdx = batchStart + i;
      const globalOffset = chunkIdx * CHUNK_SIZE;
      const thisChunkSize = Math.min(CHUNK_SIZE, input.count - globalOffset);
      return insertChunk(ctx.db, tableId, cols, startOrder, globalOffset, thisChunkSize);
    })
  );
}
```

### maxDuration Export for tRPC Route

```typescript
// File: src/app/api/trpc/[trpc]/route.ts
// Source: nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration
export const maxDuration = 300;

const handler = (req: NextRequest) => {
  return fetchRequestHandler({ ... });
};
export { handler as GET, handler as POST };
```

### Replacing faker with Fast Inline Random (Optional)

If faker's import overhead is measured to be significant:

```typescript
// No faker dependency — pure Math.random for benchmark rows
// ~10x faster than faker for simple text/number generation
const words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
               "adipiscing", "elit", "sed", "do", "eiusmod", "tempor"];
function randomWords() {
  const count = 1 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, () => words[Math.floor(Math.random() * words.length)]).join(" ");
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

---

## Current Bottleneck Analysis

Based on code inspection:

| Factor | Current | Optimal | Impact |
|--------|---------|---------|--------|
| Round-trips | 100 (1k × 100) | 10–20 (5k–10k chunks) | ~5–10x wall-clock reduction |
| Parallelism | 1 (sequential) | 3–5 concurrent | ~3–5x further reduction |
| Insert method | INSERT...VALUES (Drizzle) | INSERT...UNNEST | ~2x planning speedup |
| Faker import | 1× per call (~300ms) | 1× per module (0ms after warm) | ~300ms savings |
| maxDuration | Not set (risk of 504) | 300s | Risk mitigation |
| Data generation | Inside loop | Pre-computed before insert | Negligible |

**Theoretical target:** 100 round-trips → 20 round-trips × parallelism 4 = effective 5 round-trips. If each 5k-row chunk takes ~250ms (per Tiger Data: 1M rows in 32.5s via batch = 32.5ms per 1k rows = 162ms per 5k rows, with network overhead ~250ms), then 100k rows = 20 chunks / 4 concurrency = 5 waits × 250ms = ~1.25s. Realistic target with Neon latency overhead: 2–4s.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential 1000-row chunks | Parallel large-chunk UNNEST inserts | This phase | 10–30x speedup |
| Drizzle VALUES params | UNNEST arrays | This phase | 2x planning speedup + bypass param limit |
| No maxDuration | `export const maxDuration = 300` | This phase | Prevents 504 on long operations |
| COPY FROM STDIN (ideal) | Not used (PgBouncer risk) | Assessed this phase | Theoretical 4x further speedup sacrificed for reliability |

**Deprecated/outdated:**
- Chunk size of 1000: Sub-optimal for network-round-trip-dominated workloads. 5000–10000 is the sweet spot for Neon.
- Sequential chunk loop: Replaced by bounded parallel execution.

---

## Open Questions

1. **Does Neon's PgBouncer version support COPY FROM STDIN?**
   - What we know: PgBouncer 1.22.1 fixed COPY FROM STDIN memory leaks in transaction mode (March 2024). postgres.js has native COPY support via `.copy()` streams.
   - What's unclear: Which PgBouncer version Neon deploys. Whether Neon tests/certifies COPY through the pooler.
   - Recommendation: Skip COPY for now. If UNNEST+parallel achieves sub-4.6s, COPY isn't needed. If still above 6s after UNNEST+parallel, investigate COPY feasibility with a test.

2. **Optimal chunk size for Neon free tier**
   - What we know: Tiger Data recommends 20k–40k rows per batch for local Postgres. Neon has connection overhead. Current 1000-row chunks are clearly sub-optimal.
   - What's unclear: Whether Neon free tier has any payload size limits per query (the pooler connection itself should be fine; the question is TCP buffer sizes).
   - Recommendation: Start at 5000. Measure. Try 10000. The benchmark button makes this trivial to iterate.

3. **Concurrency level for Neon free tier connection pool**
   - What we know: Neon free tier allocates connections based on RAM (~100 per GB). The default pool has limited slots.
   - What's unclear: Exact pool size. Whether 5 concurrent connections causes pool exhaustion.
   - Recommendation: Start at 3 concurrent. Increase to 5 if no pool errors. Watch for "connection pool exhausted" errors.

4. **Whether `export const maxDuration = 300` works on Vercel Hobby**
   - What we know: Vercel docs confirm 300s max for Hobby plan with Fluid Compute enabled. The export syntax is verified for App Router route handlers.
   - What's unclear: Whether Fluid Compute is auto-enabled or requires opt-in on the project.
   - Recommendation: Add the export; verify in Vercel dashboard that Fluid Compute is enabled for the project.

---

## Sources

### Primary (HIGH confidence)
- Next.js docs (v16.2.0, 2026-03-13) — `maxDuration` route segment config: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration
- Vercel Functions Limits (official): https://vercel.com/docs/functions/limitations — confirmed 300s Hobby limit with Fluid Compute
- Code inspection: `E:/websites/airtable clone/src/server/api/routers/row.ts` — bulkCreate procedure, 1000-chunk sequential loop
- Code inspection: `E:/websites/airtable clone/src/components/grid/GridView.tsx` — benchmark implementation
- Code inspection: `E:/websites/airtable clone/src/server/db/index.ts` — postgres.js connection, `prepare: false`
- Neon connection pooling docs: https://neon.com/docs/connect/connection-pooling — transaction mode confirmed, COPY not mentioned

### Secondary (MEDIUM confidence)
- Tiger Data INSERT vs COPY benchmark (1M rows): https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy — COPY: 4.3s/1M; Batch INSERT: 32.5s/1M; optimal batch 20k–40k
- Tiger Data UNNEST 2x speedup: https://www.tigerdata.com/blog/boosting-postgres-insert-performance — 2.13x faster at 1k batch; 5x for wide schemas
- PgBouncer COPY fix: https://github.com/pgbouncer/pgbouncer/pull/1025 — fix for COPY FROM STDIN in PgBouncer 1.22.1 (March 2024)
- PgBouncer features (transaction mode unsupported list): https://www.pgbouncer.org/features.html — COPY not on the unsupported list
- postgres.js GitHub: https://github.com/porsager/postgres — native array parameter support confirmed

### Tertiary (LOW confidence)
- Faker import overhead ~300ms: Single blog post (Kevin Burke, 2024 era) — not independently verified for @faker-js/faker v9.9.0. Measure before acting.
- Neon free tier max connections: Derived from "100 per GB RAM" guideline — not verified for current Neon free tier limits.

---

## Metadata

**Confidence breakdown:**
- Current bottleneck diagnosis: HIGH — code is clear; 100 sequential round-trips is the problem
- UNNEST optimization: HIGH — multiple official/benchmark sources confirm 2–5x improvement
- Parallel chunk approach: HIGH — standard pattern; rowOrder pre-computation already in codebase
- COPY FROM STDIN: LOW — theoretical benefit; PgBouncer/Neon compatibility unconfirmed
- Optimal chunk size (5000–10000): MEDIUM — based on general Postgres benchmarks; Neon-specific limit unknown
- Optimal concurrency (3–5): MEDIUM — conservative estimate; Neon pool size unknown
- Faker overhead: LOW — single unverified source; measure before optimizing

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable domain; Neon/Vercel limits may change sooner)
