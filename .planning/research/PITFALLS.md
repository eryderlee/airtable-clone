# Domain Pitfalls

**Domain:** Airtable clone — high-performance spreadsheet UI with T3 stack
**Stack:** Next.js App Router, tRPC, Drizzle ORM, NextAuth.js, TanStack Table + Virtualizer, Supabase PostgreSQL
**Researched:** 2026-03-17
**Performance target:** 1M rows, DB-level filter/sort/search

---

## Critical Pitfalls

Mistakes that force rewrites or cause unfixable architectural problems.

---

### Pitfall 1: Offset Pagination at Scale

**What goes wrong:** Building pagination with `OFFSET n LIMIT 20` works fine at 1k rows and catastrophically fails at 1M. PostgreSQL must physically scan and skip all offset rows before returning results. At 1M rows, `OFFSET 999980` forces a full sequential scan — queries that take 2ms at row 100 take 30+ seconds at row 900,000. Additionally, inserts/deletes between paginated requests cause rows to be skipped or duplicated.

**Why it happens:** Offset pagination feels natural and matches array-index thinking. It's the default pattern in most ORM tutorials. The performance cliff is invisible until data volume grows.

**Consequences:** The entire data-loading layer must be rewritten. tRPC query signatures change. The frontend infinite scroll logic changes. Every place that touches pagination is affected.

**Prevention:** Implement keyset (cursor) pagination from day one. Use compound cursors when sorting by non-unique fields:
```sql
-- Instead of: SELECT * FROM rows OFFSET 50000 LIMIT 20
-- Use: SELECT * FROM rows
--   WHERE (sort_value, id) > ($last_sort_value, $last_id)
--   ORDER BY sort_value ASC, id ASC
--   LIMIT 20
```
The tRPC cursor must encode both the sort field value and the row ID. Create a composite index matching the sort: `CREATE INDEX ON rows (sort_value ASC, id ASC)`.

**Warning signs:** Any `offset()` call in Drizzle ORM. Any tRPC `cursor` that is an integer page number rather than an encoded value.

**Phase:** Address in Phase 1 (data loading foundation). Never use offset even for "temporary" implementations — it will not be replaced.

---

### Pitfall 2: JSONB Write Amplification Destroying Cell-Edit Performance

**What goes wrong:** Storing all dynamic cell values inside one JSONB column per row (e.g., `row.cell_data = { col_a: "foo", col_b: 42 }`) creates severe write amplification. PostgreSQL's MVCC model rewrites the entire row on every cell edit — updating one cell in a 50-column row rewrites all 50 columns' worth of data. Every index on the table also gets a new entry for the new physical row location. Under concurrent cell editing (multiple users editing the same record), this causes row-level lock contention: different users editing different cells of the same row block each other.

**Why it happens:** JSONB feels like the obvious solution for dynamic schemas. One row in `cell_data`, done. The lock contention and write amplification are invisible in development with one user.

**Consequences:** At moderate concurrent usage (10+ users editing different cells), lock contention causes noticeable latency. At high volume, autovacuum cannot keep up with dead tuple accumulation, causing index bloat and query degradation over weeks.

**Prevention:** Store each cell value as an individual row in a `cell_values` table:
```sql
CREATE TABLE cell_values (
  row_id     uuid NOT NULL,
  column_id  uuid NOT NULL,
  text_value text,
  num_value  numeric,
  PRIMARY KEY (row_id, column_id)
);
```
This is the EAV approach with a twist: lock contention is per-cell rather than per-row. The performance difference between EAV and JSONB is negligible when properly indexed (JSONB is only ~1.3x faster without GIN; with GIN containment the story changes for reads, but for write-heavy cell editing, per-cell rows win on concurrency). Use JSONB only for metadata that is read-heavy and written rarely.

**Warning signs:** A single JSONB column containing all cell values for a row. Cell-edit mutations that update the parent row directly.

**Phase:** Address in Phase 1 (schema design). This is not fixable without a migration that touches every row in the database.

---

### Pitfall 3: Missing Indexes for Dynamic Sort/Filter Causing Full Table Scans

**What goes wrong:** Users can sort and filter on any column. A filter on `text_value WHERE column_id = $col AND text_value ILIKE '%search%'` with no index scans every row in `cell_values`. At 1M base rows with 10 columns each, that is 10M cell_values rows. Without indexes, a simple filter takes seconds. With the wrong index (B-tree on a ILIKE pattern with leading wildcard), it still falls back to a sequential scan. PostgreSQL's query planner can also choose a sequential scan if statistics are stale after a large insert.

**Why it happens:** Indexes are added reactively, after slowness is noticed. Dynamic column schemas make it non-obvious which composite indexes to create upfront.

**Prevention:**
1. Always index `(column_id, text_value)` and `(column_id, num_value)` on `cell_values`.
2. For text search, use a GIN index with `pg_trgm` extension for ILIKE/full-text: `CREATE INDEX ON cell_values USING gin (text_value gin_trgm_ops)`.
3. For JSONB metadata with containment queries, use `CREATE INDEX ON table USING gin (metadata jsonb_path_ops)` — the `jsonb_path_ops` class is faster than the default `jsonb_ops` for containment (`@>`) queries but only supports that operator. Never use `->>` in WHERE clauses expecting to hit a GIN index; it will not use it.
4. Run `ANALYZE` after bulk inserts to update statistics. Stale statistics after a large data import can cause the planner to choose sequential scans for weeks.

**Warning signs:** `EXPLAIN ANALYZE` showing `Seq Scan` on `cell_values`. Query times above 100ms for filtered table views. Any `->>` operator in a WHERE clause without an expression B-tree index.

**Phase:** Address in Phase 1 (schema). Revisit in Phase 3 (filtering). Write EXPLAIN ANALYZE tests before shipping filter features.

---

### Pitfall 4: TanStack Virtualizer Scroll Jumpiness with Dynamic Row Heights

**What goes wrong:** When rows have variable heights (e.g., wrapped text, multi-line cells), the virtualizer estimates item sizes before rendering. When the user scrolls upward past un-rendered rows, the virtualizer remeasures those items as they enter the DOM. If the measured height differs from the estimate, subsequent rows shift — producing visible scroll position jumps and stuttering. This is a documented open issue (GitHub #659, #832) with no complete framework-level fix.

**Why it happens:** The virtualizer uses estimated sizes to calculate total scroll height and item positions before items are rendered. Any discrepancy between estimate and reality causes positional corrections, which manifest as jumps. Scrolling downward hides this because estimated errors push items further down (not over already-scrolled content), while scrolling upward reveals the errors as position corrections above the viewport.

**Consequences:** Scroll jumpiness that makes the product feel broken. Hard to reproduce reliably in development (depends on data content and scroll speed).

**Prevention:**
1. **Keep all rows the same fixed height.** This is the single most effective mitigation. Use `estimateSize: () => FIXED_ROW_HEIGHT` and enforce it in CSS with `height: ${FIXED_ROW_HEIGHT}px; overflow: hidden`. Airtable uses fixed row heights for this reason.
2. If variable height is required: overestimate `estimateSize` to the maximum expected height. This wastes space but eliminates upward jumps (measured items can only be smaller, never larger, than the estimate — which means no positive correction).
3. Use `measureElement` with `useCallback` referencing a stable DOM ref to avoid remeasuring on every render.
4. Set `overscan` to at least 10 (default is 5) to keep more items mounted and reduce the frequency of fresh measurements.
5. Do not clear `measurementsCache` except when column layout changes (e.g., column resize).

**Warning signs:** Rows that change height based on content. `estimateSize` returning a small value. `overscan` left at default.

**Phase:** Address in Phase 2 (virtualization). Choose row height strategy before building cell renderer — changing it later requires refactoring every cell component.

---

### Pitfall 5: Bi-Directional Virtualization Scroll Performance

**What goes wrong:** Virtualizing both rows AND columns simultaneously causes the scroll handler to execute expensive recalculations on every scroll event in both axes. With 50+ columns and 1M rows, this creates scroll handler execution times of 100-400ms (documented in GitHub #685), causing visible blank screens and "scroll handler took Xms" warnings. The issue is worse on Windows with hardware acceleration and on mobile.

**Why it happens:** Two virtualizers sharing one scroll container each need to recalculate their virtual window on every scroll event. The combined cost is not additive — it creates frame budget overruns that the browser's compositor cannot hide.

**Prevention:**
1. Implement column virtualization only when column count exceeds ~20-30. Below that, rendering all columns is cheaper than the overhead of a second virtualizer.
2. When column virtualization is required, render only the virtualized viewport — no `transform: translate3d(0,0,0)` hacks that mask the symptom.
3. Consider column virtualization as a Phase 3+ feature. The table is usable with row virtualization only for the initial launch.
4. Use `requestAnimationFrame` throttling on the scroll handler if implementing a custom scroll container.

**Warning signs:** Both `useVirtualizer` for rows and columns active simultaneously. Scroll handlers appearing in performance profiles. Blank row flashing during scroll.

**Phase:** Phase 2 for row virtualization. Phase 3+ for column virtualization if column count warrants it.

---

### Pitfall 6: TanStack Table Data Reference Instability Causing Infinite Re-renders

**What goes wrong:** TanStack Table watches the `data` and `columns` options for reference equality changes. If `data` is defined inline (`useReactTable({ data: rows.map(r => ...) })`), a new array reference is created on every render, causing the table to fully recalculate state on every render. With 1k visible rows and column definitions, this creates a render cascade. With 10k+ rows in state, it causes the browser to freeze. The "1000x faster TanStack Table" fix (documented by JP Camara) was a single-character mutation vs. spread operator difference that changed O(n²) to O(1) behavior.

**Why it happens:** JavaScript array spread inside map/reduce/groupBy operations looks harmless but creates O(n²) behavior. React's development mode is often fast enough to hide this; production with real data reveals it.

**Prevention:**
1. Memoize `data` with `useMemo` — only recompute when the underlying query data reference changes.
2. Memoize `columns` with `useMemo` or define them outside the component.
3. Never mutate `data` in place — always replace the reference when data changes (opposite of the spread trap: mutation is fine for intermediate processing, but the final `data` prop must be a new reference when content changes).
4. The only truly required memoization is for `data`. Over-memoizing (e.g., wrapping the entire table body in `React.memo`) breaks virtualization and feature toggling.
5. Watch for `data.filter()`, `data.map()`, or `data.sort()` directly in the `useReactTable` call.

**Warning signs:** React DevTools showing the table component re-rendering on every keystroke or scroll event. CPU profiler showing `useReactTable` recalculation dominating frame budget.

**Phase:** Phase 2. Establish data flow patterns before building cell renderers — retrofitting memoization into a tangled component tree is difficult.

---

## Moderate Pitfalls

Mistakes that cause significant delays or accruing technical debt.

---

### Pitfall 7: NextAuth.js Middleware-Only Authorization (CVE-2025-29927)

**What goes wrong:** Relying on Next.js middleware as the sole authorization gate is insufficient and, as of March 2025, actively exploitable. CVE-2025-29927 (CVSS 9.1) allows an attacker to bypass middleware entirely by sending the `x-middleware-subrequest` header with a crafted value. Affected versions: Next.js < 14.2.25 and < 15.2.3. Any application that guards tRPC routes only via middleware will expose all data to unauthenticated requests.

**Why it happens:** Middleware feels like the natural "guard" layer. The T3 stack scaffolds middleware-based session protection. The CVE was not disclosed until 2025 and affects applications built before the patch.

**Prevention:**
1. Always verify session at the data access layer (tRPC context, not just middleware):
```typescript
// In every tRPC procedure that accesses user data:
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { session: ctx.session } });
});
```
2. Use middleware only for redirecting unauthenticated users (UX), not for security enforcement.
3. Pin Next.js to >= 14.2.25 or >= 15.2.3. Strip the `x-middleware-subrequest` header at the load balancer/CDN layer (Cloudflare, AWS ALB) as defense-in-depth.
4. Adopt the Data Access Layer pattern: all DB queries go through an authenticated context, never called directly from RSCs without session checks.

**Warning signs:** tRPC procedures without explicit session checks. Authorization logic only in `middleware.ts`. Next.js version below 14.2.25.

**Phase:** Phase 1 (auth setup). The CVE is patched in current Next.js — just keep dependencies current and do not rely on middleware alone.

---

### Pitfall 8: Drizzle ORM Dynamic WHERE Clauses Breaking Type Safety

**What goes wrong:** Building dynamic filter queries (user can filter on any column, any operator) requires conditional WHERE clause construction. Drizzle's default query builder throws a TypeScript error if `.where()` is called multiple times on the same query. Developers work around this by casting to `any` or building raw SQL strings, losing all type safety. Separately, mixing Drizzle's relational queries (`db.query.table.findMany`) with the SQL query builder for dynamic parts creates incompatible patterns that cannot be composed.

**Why it happens:** The Drizzle docs demonstrate simple static queries. Dynamic filter building is documented but requires using `.$dynamic()` mode, which many developers discover only after the wrong pattern is already in production. Drizzle also does not support calling `.where()` more than once by default — a design constraint that is non-obvious.

**Prevention:**
1. Enable `.$dynamic()` on any query that will have conditions added conditionally:
```typescript
function buildRowQuery(filters: FilterInput[]) {
  let query = db.select().from(rows).$dynamic();
  if (filters.length > 0) {
    query = query.where(and(...filters.map(toWhereClause)));
  }
  return query.limit(PAGE_SIZE);
}
```
2. Use Drizzle's dialect-specific generic types (`PgSelect`) as function parameters to maintain type safety across function boundaries.
3. Use `and()`, `or()`, `eq()`, `gt()`, `lt()`, `like()`, `ilike()` from Drizzle's operators — never raw SQL strings for filter construction.
4. Keep relational queries (`db.query`) for simple, static lookups. Use the SQL query builder with `.$dynamic()` for the table view data loader.

**Warning signs:** `as any` casts near Drizzle query construction. `.where()` called multiple times without `.$dynamic()`. Raw template literal SQL in filter logic.

**Phase:** Phase 1 (data layer). Define the dynamic query builder pattern as a shared utility before writing individual tRPC procedures.

---

### Pitfall 9: tRPC Infinite Query Cursor Design Locking Sort Order

**What goes wrong:** The tRPC `useInfiniteQuery` cursor encodes position in the result set. If the cursor is a simple row ID, it only works when results are sorted by ID. When the user changes sort order (e.g., sort by a custom text column), the existing cursor becomes invalid and the infinite query must restart from page 0. If stale cursor values are passed for a different sort order, the query returns incorrect results or empty pages. Additionally, changing any filter input to `useInfiniteQuery` resets all pages and refetches everything from scratch — a full-data reload on every filter keystroke.

**Why it happens:** Cursor design is deferred to "later" and a simple row ID cursor is used first. The coupling between sort order and cursor format is not obvious until sort-order-switching is implemented.

**Prevention:**
1. Encode the cursor as a composite value matching the current sort: `{ sortValue: string | number, rowId: string }`. When sort order changes, reset cursor to null explicitly and start fresh.
2. Debounce filter input changes (300ms minimum) before triggering query key changes. Do not pass raw input state directly into tRPC query inputs.
3. Use `keepPreviousData: true` (TanStack Query v4) or `placeholderData: keepPreviousData` (v5) on the infinite query to avoid flickering to a loading state between filter changes.
4. For sort changes: invalidate and reset the infinite query, do not try to remap cursors across sort orders.
5. Track `hasNextPage` from `getNextPageParam` returning `undefined` when the last page returns fewer rows than the limit — not from a total row count.

**Warning signs:** Cursor encoded as a plain integer or row ID only. Filter state wired directly to tRPC query input without debouncing. `getNextPageParam` returning a page number rather than the last item's sort values.

**Phase:** Phase 2 (infinite scroll). Design the cursor schema as part of the tRPC router contract, not as an implementation detail.

---

### Pitfall 10: Cell Edit Focus Loss in Virtualized Grid

**What goes wrong:** In a virtualized table, rows outside the visible viewport are unmounted from the DOM. If a user tabs to a cell that is near the viewport edge and the scroll causes that cell to leave the viewport during the transition, the cell's input element is removed from the DOM. The HTML spec mandates that focus transfers to `document.body` when a focused element is removed. There is no browser API to recover from this — focus is silently lost. The user presses Tab and nothing happens. Additionally, when a cell edit is in flight (async save to server) and the user navigates away, two save requests can be in flight simultaneously for different values, with the earlier response arriving last and overwriting the newer edit.

**Why it happens:** Focus management in virtualized grids is fundamentally at odds with virtualization. The problem only appears when navigating with keyboard near scroll boundaries — easy to miss in manual testing.

**Prevention:**
1. Use a "focus trap" pattern: maintain focus state in a ref (not DOM focus) and re-apply DOM focus after scroll settles using `virtualizer.scrollToIndex` + `requestAnimationFrame`:
```typescript
// After scroll settles, re-focus the logical active cell
useEffect(() => {
  if (activeCellRef.current) {
    virtualizer.scrollToIndex(activeCellRowIndex, { align: 'auto' });
    requestAnimationFrame(() => activeCellRef.current?.focus());
  }
}, [activeCellRowIndex]);
```
2. Maintain logical cursor state (row, column indices) separately from DOM focus. DOM focus is a consequence of logical state, not the source of truth.
3. For race conditions on save: use debounced saves with a cancellation token. Only apply the response from the most recently issued save request. Discard earlier responses if a newer one is in flight:
```typescript
const saveRef = useRef<AbortController | null>(null);
function saveCell(value: string) {
  saveRef.current?.abort();
  saveRef.current = new AbortController();
  mutation.mutate({ value, signal: saveRef.current.signal });
}
```

**Warning signs:** Cell editor components that `useEffect` to autofocus without accounting for scroll. Save mutations not using abort/cancellation. Tab key navigation that simply moves DOM focus.

**Phase:** Phase 2 (cell editing). Address before keyboard navigation is tested — retrofitting is possible but involves touching every cell component.

---

### Pitfall 11: View Persistence State Desync with Optimistic Updates

**What goes wrong:** Views store filter/sort/column-visibility configs. When a user modifies a view (changes a filter), the UI updates optimistically while the server request is in flight. If the server request fails, the UI rolls back — but the user's subsequent interactions (e.g., typing a search term) happened against the optimistic state. Rolling back under active interaction produces a jarring jump. Separately, if two tabs have the same view open and one tab changes a filter, the other tab's view config becomes stale and will save its (now-outdated) state over the server's current state on the next mutation.

**Why it happens:** TanStack Query's optimistic update documentation shows single-mutation scenarios. Multi-tab and multi-user desync are not covered. View configs are often treated as "cheap" mutations and not given the same care as data mutations.

**Prevention:**
1. Use server-state as the source of truth for view configs. Do not hold view config in local component state — keep it only in TanStack Query cache.
2. For optimistic updates on sorted list state: invalidate rather than manually update the cache. Sorted lists are hard to update in-place because the position of entries can change.
3. Add an `updatedAt` timestamp to view configs. On save mutation, include `if_unmodified_since: view.updatedAt` and reject server-side if the view was modified more recently. Show a conflict resolution prompt.
4. Debounce auto-save of view configs (search term, column widths) — do not fire a mutation on every keystroke.

**Warning signs:** View config stored in `useState` or `useReducer` rather than kept in server state. Save mutations without conflict detection. Column width changes triggering immediate save mutations.

**Phase:** Phase 3 (views). Design the view config mutation contract before building the filter/sort UI.

---

### Pitfall 12: NextAuth.js + App Router Session in tRPC Context

**What goes wrong:** The T3 stack wires `getServerSession` into the tRPC context on every request. In Next.js App Router with React Server Components, there are multiple places to call `getServerSession` — once in the RSC page, once in the tRPC server caller, potentially once in middleware. Each call is a round-trip to the session store (database or JWT decode). If the session provider uses database sessions (not JWT), every tRPC call hits the database twice: once for session, once for data. With a virtualized table making one tRPC call per scroll event, this doubles database load.

Additionally, middleware only supports the JWT session strategy — attempting to use database sessions with middleware causes silent auth bypass.

**Why it happens:** Session strategy (JWT vs database) is chosen at project setup and its performance implications are not visible until load increases. The T3 stack defaults to JWT, which is correct, but teams sometimes switch to database sessions for refresh token control and break middleware.

**Prevention:**
1. Use JWT session strategy. Do not switch to database sessions unless refresh token rotation is a hard requirement.
2. Set `staleTime` on tRPC queries to avoid refetching on every window focus. Without `staleTime > 0` on SSR queries, TanStack Query refetches immediately on client hydration.
3. Cache `getServerSession` result in the request lifecycle — do not call it in both the page RSC and the tRPC context for the same request.
4. In App Router, use `auth()` from Auth.js v5 (the successor to NextAuth.js v4) if starting fresh — it has a cleaner RSC integration.

**Warning signs:** `getServerSession` called in multiple places per request. Database session strategy with middleware. `staleTime` not set on server-prefetched queries.

**Phase:** Phase 1 (auth setup). Session strategy cannot be changed after deployment without all active sessions invalidating.

---

### Pitfall 13: Supabase RLS Policy Overhead on Large Tables

**What goes wrong:** Row Level Security policies execute on every row PostgreSQL accesses during a query — not just the rows returned. A policy like `auth.uid() = owner_id` on a table with 1M rows means the policy function executes 1M times during a full-table scan. Without an index on `owner_id`, this causes sequential scans with per-row function overhead. RLS with join-based policies (e.g., `auth.uid() IN (SELECT user_id FROM team_members WHERE team_id = rows.team_id)`) executes the subquery once per row unless wrapped in a security-definer function that allows the planner to cache the result.

**Why it happens:** RLS is enabled at table creation and policies are added without load testing. The difference between a well-indexed RLS policy and a naive one can be 100x on large tables.

**Prevention:**
1. Index every column referenced in RLS policies: `CREATE INDEX ON rows (workspace_id)` if the policy is `workspace_id = get_user_workspace()`.
2. Wrap subquery expressions in security-definer SQL functions so the planner can cache the result (avoids per-row re-evaluation):
```sql
CREATE FUNCTION current_user_workspace_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT workspace_id FROM users WHERE id = auth.uid()
$$;
-- Then in policy: USING (workspace_id = current_user_workspace_id())
```
3. Test RLS performance by comparing query times with `SET row_security = off` (development only) vs on. More than 2x difference indicates a policy optimization problem.
4. Use `EXPLAIN (ANALYZE, BUFFERS)` to identify if RLS is adding sequential scans.

**Warning signs:** RLS policies with subqueries not wrapped in stable functions. No index on the ownership column. Query times with RLS enabled more than 2x without it.

**Phase:** Phase 1 (schema). RLS policies are set at table creation — retrofitting indexes and policy rewrites on a populated table requires careful migration.

---

## Minor Pitfalls

Mistakes that are annoying and require focused effort to fix but do not require architectural changes.

---

### Pitfall 14: Column Resize Triggering Full Table Re-render

**What goes wrong:** Column resizing fires `onMouseMove` events at 60fps. Without memoization of the table body, every mousemove triggers a re-render of all visible cells. With 20 columns × 50 visible rows = 1,000 cell components re-rendering at 60fps, this consumes the entire frame budget, causing choppy resize feedback.

**Prevention:** Wrap the table body rows in `React.memo`. Note that `React.memo` with TanStack Table must be applied carefully — the `row.getVisibleCells()` call must be memoized or the memo boundary is bypassed. Use CSS `cursor: col-resize` and defer the actual column width state update until `mouseup` (dragging moves a visual resize handle, commit happens on release).

**Phase:** Phase 2.

---

### Pitfall 15: Using Index as React Key in Virtualized Lists

**What goes wrong:** Using array index as the `key` prop for virtualized rows causes React to reuse the wrong DOM nodes when rows are reordered, filtered, or deleted. The symptom is stale cell content appearing in wrong rows after a filter change, or cell editors retaining their state after a row deletion.

**Prevention:** Always use the stable row ID (database UUID) as the React key: `key={row.id}`.

**Phase:** Phase 2. Easy fix, easy to introduce.

---

### Pitfall 16: tRPC Batch Request Collisions on Initial Page Load

**What goes wrong:** tRPC batches concurrent requests by default. On initial page load, the table fires: `getColumns`, `getViews`, `getRows` nearly simultaneously. Batching groups them into one HTTP request, which is good. However, if any one of the batched procedures is slow (e.g., `getRows` with a complex filter), it blocks the entire batch response — `getColumns` and `getViews` (which are fast) are delayed waiting for `getRows` to complete.

**Prevention:** Separate fast metadata queries (columns, views) from slow data queries (rows). Fetch columns and views first (with RSC prefetch or a high-priority query), then trigger row fetching. Alternatively, disable batching for specific query groups using tRPC's `httpBatchLink` configuration.

**Phase:** Phase 2.

---

## Phase-Specific Warning Map

| Phase | Topic | Pitfall to Watch | Mitigation |
|-------|-------|-----------------|------------|
| Phase 1 | Schema design | JSONB write amplification (Pitfall 2) | Per-cell row storage in `cell_values` table |
| Phase 1 | Schema design | Missing indexes (Pitfall 3) | Create composite + GIN indexes before inserting data |
| Phase 1 | Auth setup | Middleware-only auth / CVE-2025-29927 (Pitfall 7) | Data Access Layer pattern, tRPC procedure-level auth |
| Phase 1 | Auth setup | Session strategy lock-in (Pitfall 12) | Use JWT strategy, do not switch post-launch |
| Phase 1 | RLS | Policy overhead (Pitfall 13) | Index ownership columns, wrap subqueries in stable functions |
| Phase 2 | Pagination | Offset pagination cliff (Pitfall 1) | Keyset cursors from the start, never use OFFSET |
| Phase 2 | Virtualization | Scroll jumpiness (Pitfall 4) | Fixed row heights or overestimate `estimateSize` |
| Phase 2 | Virtualization | Dual-axis virtualizer lag (Pitfall 5) | Row virtualization only in Phase 2; column virtualization later |
| Phase 2 | Data flow | Infinite re-renders (Pitfall 6) | Memoize `data` and `columns` options |
| Phase 2 | Cell editing | Focus loss on scroll boundary (Pitfall 10) | Logical cursor state + scroll-to + rAF focus restoration |
| Phase 2 | Cell editing | Save race condition (Pitfall 10) | AbortController per save, discard stale responses |
| Phase 2 | Performance | Column resize re-renders (Pitfall 14) | `React.memo` on table body, defer resize commit to mouseup |
| Phase 3 | Filtering | Dynamic WHERE type safety (Pitfall 8) | Drizzle `.$dynamic()` with typed helper functions |
| Phase 3 | Cursor | Sort-order / cursor coupling (Pitfall 9) | Composite cursor encoding sort field + row ID |
| Phase 3 | Views | View config state desync (Pitfall 11) | Server state as truth, conflict detection with `updatedAt` |

---

## Sources

- TanStack Virtualizer scroll jumpiness (dynamic heights): https://github.com/TanStack/virtual/issues/659
- TanStack Virtualizer dual-axis lag: https://github.com/TanStack/virtual/issues/685
- TanStack Table memoization guide: https://tanstack.com/table/v8/docs/faq
- TanStack Table 1000x performance fix: https://jpcamara.com/2023/03/07/making-tanstack-table.html
- TanStack Table unnecessary re-renders issue: https://github.com/TanStack/table/issues/4794
- TanStack Virtualizer API: https://tanstack.com/virtual/latest/docs/api/virtualizer
- tRPC over-fetching with tables: https://dev.to/ardsh/how-to-solve-overfetching-with-trpc-apis-when-rendering-tables-pt-1-fbg
- Drizzle ORM dynamic query building: https://orm.drizzle.team/docs/dynamic-query-building
- PostgreSQL JSONB write amplification (no HOT updates): https://dev.to/mongodb/no-hot-updates-on-jsonb-13k7
- PostgreSQL JSONB vs EAV performance: https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/
- PostgreSQL EAV anti-pattern: https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/
- PostgreSQL GIN index pitfalls: https://dev.to/polliog/postgresql-jsonb-gin-indexes-why-your-queries-are-slow-and-how-to-fix-them-12a0
- Keyset cursor pagination: https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/
- Cursor pagination for PostgreSQL: https://bun.uptrace.dev/guide/cursor-pagination.html
- CVE-2025-29927 Next.js middleware bypass: https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass
- Supabase RLS performance: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- NextAuth.js session management pitfalls: https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues
- TanStack Query optimistic updates desync: https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query
- React spreadsheet focus management: https://www.thecandidstartup.org/2024/10/14/react-spreadsheet-selection-focus.html
- React spreadsheet event handling: https://www.thecandidstartup.org/2024/10/28/react-spreadsheet-event-handling.html
- Supabase advanced indexing: https://dev.to/damasosanoja/beyond-basic-indexes-advanced-postgres-indexing-for-maximum-supabase-performance-3oj1
