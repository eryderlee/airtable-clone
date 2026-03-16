# Project Research Summary

**Project:** Airtable Clone (T3 Stack)
**Domain:** Spreadsheet-database hybrid table UI with 1M-row performance target
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

This project is a high-performance Airtable clone built on the T3 stack: Next.js App Router, tRPC v11, Drizzle ORM, Auth.js v5, and TanStack Table + Virtualizer. The core technical challenge is not the CRUD plumbing — it is making a grid with 1 million rows feel instantaneous. Every major architectural decision flows from that constraint: cursor-based pagination instead of offsets, server-side filtering instead of client-side, row virtualization from the first page of data, and JSONB cell storage instead of EAV. The research finds strong, high-confidence consensus across all four areas on how to build this correctly.

The recommended approach is a hybrid database schema where user-defined column metadata lives in a real relational `columns` table while cell values are stored in a JSONB `cells` column on each row. This avoids EAV's join explosion at scale while keeping column definitions queryable. Dynamic filters and sorts are executed entirely in PostgreSQL via Drizzle's `.$dynamic()` query builder with `sql` template tags for JSONB operators. The UI layer composes TanStack Table (headless data model, manual mode) with TanStack Virtualizer (DOM windowing) to render only visible rows out of millions. These are separate libraries that must be wired together — not a single integrated solution.

The most dangerous risks are architectural and must be addressed in Phase 1, before any UI is built: using offset pagination (causes 30-second queries at row 900,000), not creating the correct PostgreSQL indexes upfront (full table scans on every filter), and mishandling the Auth.js v5 JWT/middleware split (a known CVE and silent auth bypass). The second tier of risk lives in the virtualization layer: scroll jumpiness from dynamic row heights, focus loss when cells scroll off-screen, and TanStack Table data reference instability causing O(n²) re-renders. All of these are preventable with the patterns documented in research but unrecoverable without architectural rewrites if ignored.

---

## Key Findings

### Recommended Stack

The T3 stack is well-suited to this project because tRPC v11's end-to-end type safety directly supports the complex dynamic filter/sort input schemas this app requires. Drizzle ORM wins decisively over Prisma for this use case: its bundle is ~200x smaller (7KB vs 1.6MB), it is edge-runtime compatible, and its SQL-close API makes dynamic WHERE clause construction natural rather than requiring raw SQL fallbacks. Auth.js v5 (`next-auth@beta`) is required — not v4 — because App Router + edge middleware demands the two-file `auth.config.ts / auth.ts` split that only v5 formalizes.

One critical package naming trap: in tRPC v11, the React Query integration package was renamed from `@trpc/react-query` to `@trpc/tanstack-react-query`. Using the old name causes import errors. Similarly, Zod v4 has breaking changes from v3; pin to `zod@3` until tRPC v11 compatibility with Zod v4 is confirmed.

**Core technologies:**
- **Next.js 16 (App Router):** Full-stack framework — Server Components enable server-side tRPC calls without HTTP round-trips; edge middleware for auth
- **tRPC v11 + @trpc/tanstack-react-query:** Type-safe API — end-to-end types for complex filter/sort schemas; `useInfiniteQuery` drives cursor pagination
- **Drizzle ORM 0.45.1 + postgres.js:** Database layer — 7KB bundle, edge-safe, SQL-close API for dynamic WHERE construction; `{ prepare: false }` required for Supabase transaction pooler
- **Auth.js v5 (`next-auth@beta`) + @auth/drizzle-adapter:** Authentication — universal `auth()` for RSCs, edge-safe middleware split, JWT strategy required
- **@tanstack/react-table v8:** Headless table logic — `manualSorting: true`, `manualFiltering: true`, `manualPagination: true` required (all ops at DB level)
- **@tanstack/react-virtual v3:** DOM virtualization — separate from react-table; composes by index; row virtualizer first, column virtualizer deferred
- **Supabase (PostgreSQL only):** Managed database host — use Supavisor transaction mode (port 6543); do NOT use Supabase Auth, Realtime, or JS client
- **TanStack Query v5:** Async state — `useInfiniteQuery` for paginated row data; `placeholderData: keepPreviousData` prevents flicker on filter changes

### Expected Features

Research finds strong consensus on the complete Airtable interaction model. The layout is fixed: left sidebar (bases), table tab bar, views panel, toolbar, grid. The grid has a defined anatomy: row number column, expand icon on hover, frozen primary field, inline-editable cells. The keyboard navigation model is exact spreadsheet convention: arrow keys to navigate, Enter/F2/typing to enter edit mode, Tab to commit and move right, Escape to cancel.

The v1 scope is deliberately narrow but complete: Grid view only, Text and Number column types only, full filter/sort/search/hide-fields toolbar, per-view state persistence. The 1M-row performance target is the differentiating feature — it requires infrastructure (virtualization + indexed DB queries) that must be built in from the start.

**Must have (table stakes — without these it is not an Airtable clone):**
- Google OAuth, private bases, user session
- Left sidebar (bases), table tab bar, views panel
- Grid view: virtualized rows, Text and Number columns
- Cell editing: inline edit, full keyboard navigation (arrow/tab/enter/escape)
- Row CRUD: add, delete, expand record
- Toolbar: Hide fields, Filter (per-type operators), Sort (cascading), Search (highlight-only, not filter)
- Views: create, switch, name, persist filter/sort/hide config per view

**Should have (polish that makes it feel professional):**
- Toolbar badge counts showing active filter/sort count
- Column resize (drag header edge) and reorder (drag header)
- Primary field always frozen
- Optimistic cell updates with immediate UI feedback
- URL reflects active view ID

**Defer to v2+:**
- Additional column types (date, select, checkbox, formula, linked record, attachment)
- Additional view types (Kanban, Gallery, Calendar, Form)
- Record grouping, record coloring, row height variants
- Real-time collaboration (last-write-wins is acceptable for v1)
- CSV import, API access, mobile optimization

### Architecture Approach

The architecture centers on a hybrid JSONB schema, server-side query execution, and a composed virtualization stack. The database uses a real `columns` table for column metadata and a `rows` table with a `cells jsonb` column keyed by column UUID. Dynamic filter and sort logic runs entirely in PostgreSQL via Drizzle's `.$dynamic()` builder — the UI passes filter/sort configs to tRPC, which constructs and executes the SQL. The frontend never holds or processes more rows than are currently visible, thanks to the TanStack Virtualizer which renders only the ~30-50 rows in the viewport at any time. Infinite scroll is triggered when the last virtual row nears the viewport edge, fetching the next page via `useInfiniteQuery`.

The Next.js route hierarchy mirrors the Airtable navigation model: `(app)/base/[baseId]/[tableId]/view/[viewId]`. Each layout level persists across navigation (sidebar survives table switching; tab bar survives view switching; grid unmounts/remounts on view change to reset scroll state).

**Major components:**
1. **Database schema** (`bases`, `tables`, `columns`, `rows`, `views`) — foundation; column metadata is relational, cell values are JSONB
2. **PostgreSQL indexes** — B-Tree on `(table_id, row_order, id)` for cursor pagination; GIN `jsonb_path_ops` on `cells` for containment queries; expression indexes for numeric range filters
3. **tRPC routers** (`base`, `table`, `column`, `row`, `view`) — `row.getRows` is the critical path: cursor paginated, dynamic filter/sort/search, merges view config with inline overrides
4. **App Router nested layouts** — base layout (sidebar), table layout (tab bar + view panel), view page (grid); grid is a page not a layout so it remounts on view switch
5. **TableView component tree** (`<TableView>` → `<GridHeader>` + `<GridBody>` → `<GridRow>` → `<GridCell>`) — TanStack Table provides row model; TanStack Virtualizer controls which rows/columns render in DOM
6. **View persistence layer** — filter/sort/column visibility saved to `views` table; server state is source of truth; `updatedAt` conflict detection for multi-tab scenarios

### Critical Pitfalls

1. **Offset pagination at scale** — `OFFSET n LIMIT 20` causes 30-second queries at 1M rows; implement keyset (cursor) pagination with composite `(row_order, id)` cursors from day one; never use `offset()` even temporarily
2. **JSONB write amplification** — every cell edit rewrites the entire row under PostgreSQL MVCC, causing lock contention under concurrent users; PITFALLS.md recommends per-cell EAV for write-heavy scenarios, but ARCHITECTURE.md recommends JSONB with the accepted trade-off (single-user v1 makes this acceptable); see Conflict note below
3. **Missing indexes before data insertion** — create `idx_rows_cursor (table_id, row_order, id)` and GIN `idx_rows_cells_gin` before inserting any data; stale statistics after bulk inserts require manual `ANALYZE`
4. **Middleware-only authorization (CVE-2025-29927)** — Next.js middleware can be bypassed via `x-middleware-subrequest` header; all tRPC procedures must implement `protectedProcedure` with explicit session checks; middleware is for UX redirects only
5. **TanStack Table data reference instability** — defining `data` inline in `useReactTable({ data: rows.map(...) })` creates a new array reference on every render causing O(n²) recalculation; always `useMemo` the `data` and `columns` options
6. **Focus loss in virtualized grid** — when a focused cell scrolls off-screen, the DOM element unmounts and browser moves focus to `document.body`; maintain logical cursor state in a ref, use `virtualizer.scrollToIndex` + `requestAnimationFrame` to restore DOM focus

**Conflict note on JSONB vs EAV for cell storage:** PITFALLS.md (Pitfall 2) recommends per-cell EAV rows for concurrent write scenarios. ARCHITECTURE.md recommends the hybrid JSONB approach. These are not contradictory — JSONB is correct for v1 (single-user, no real-time collaboration), and EAV becomes worth reconsidering if real-time multi-user editing is added in v2. The ARCHITECTURE.md hybrid approach is the right starting point.

---

## Implications for Roadmap

Based on the feature dependency graph and architectural build order from research, 8 phases are suggested. The first three phases are pure foundation — no UI — because every UI component depends on all three layers being correct.

### Phase 1: Foundation — Schema, Auth, and DB Infrastructure

**Rationale:** The database schema, indexes, and auth session strategy are the decisions with the highest cost-of-change. They must be done first and done correctly. The CVE-2025-29927 auth pattern and JSONB vs EAV cell storage decision cannot be meaningfully changed after the first migration.

**Delivers:** Drizzle schema (`bases`, `tables`, `columns`, `rows`, `views`), all indexes, Auth.js v5 with Google OAuth (two-file edge middleware split, JWT strategy), Supabase connection with `prepare: false`, seed script generating 1M rows for performance baseline.

**Features addressed:** Google OAuth, private bases, user session (prerequisite for all other features)

**Pitfalls to avoid:**
- Pitfall 1: No `OFFSET` — cursor pagination baked in from the schema design
- Pitfall 2: JSONB write amplification accepted for v1, deferred concern
- Pitfall 3: All indexes created in initial migration, `ANALYZE` run after seed
- Pitfall 7: `protectedProcedure` pattern established before any routes exist
- Pitfall 12: JWT session strategy locked in at auth setup
- Pitfall 13: RLS policies (if used) indexed and benchmarked at creation

**Research flag:** Standard patterns, well-documented. Skip `/gsd:research-phase`.

---

### Phase 2: tRPC Data Layer

**Rationale:** The tRPC router layer is the interface between database and UI. All frontend phases depend on these procedure contracts. The cursor schema, filter/sort input types, and view config merge logic must be defined here — changing them later means updating every UI component that calls them.

**Delivers:** All five tRPC routers (`base`, `table`, `column`, `row`, `view`). The `row.getRows` infinite query procedure with cursor pagination, `.$dynamic()` filter builder, sort builder, view config merge. All procedures use `protectedProcedure`. Type-safe filter/sort schemas in Zod.

**Features addressed:** Foundational data access for all subsequent features

**Pitfalls to avoid:**
- Pitfall 8: Drizzle `.$dynamic()` with `PgSelect` typed helpers — no `as any` casts
- Pitfall 9: Composite cursor `{ rowOrder, id }` defined in router contract, not as ad-hoc implementation
- Pitfall 16: Metadata queries (columns, views) separated from data queries (rows) to avoid batch blocking

**Research flag:** Standard patterns with one important gotcha (Drizzle JSONB prepared statement bug #4935 — use `sql` template tag for JSONB operators). Skip `/gsd:research-phase`.

---

### Phase 3: Base Navigation and Layout Shell

**Rationale:** The App Router nested layout structure must be built before grid components can be placed. Sidebar, table tab bar, and view panel are layout-level concerns that wrap all subsequent UI phases.

**Delivers:** Nested App Router layouts (`(app)/base/[baseId]/[tableId]/view/[viewId]`). Left sidebar with bases list. Table tab bar. Views panel (list views, switch views, create view). Base and table CRUD UI.

**Features addressed:** Left sidebar (bases navigation), top tab bar (tables), views panel

**Pitfalls to avoid:**
- Pitfall 11 design prerequisite: view config must be loaded from server state here, not local state

**Research flag:** Standard Next.js App Router patterns. Skip `/gsd:research-phase`.

---

### Phase 4: Grid Core — Virtualized Table Rendering

**Rationale:** This is the highest-risk phase. TanStack Table + TanStack Virtualizer composition requires careful setup that is hard to retrofit. Row virtualization must be active from the first rendered row — adding it later to an already-working non-virtualized table requires touching every cell component. The `<div role="grid">` vs `<table>` decision is also made here and cannot be easily changed.

**Delivers:** `<TableView>` component with `<div role="grid">` DOM structure. TanStack Table in manual mode (`manualSorting`, `manualFiltering`, `manualPagination` all `true`). Row virtualizer with spacer-div approach (not `translateY`) for sticky header compatibility. `useInfiniteQuery` wired to `row.getRows` with `fetchNextPage` triggered when last virtual row approaches viewport edge. Basic cell rendering (text values only, no editing yet). Performance validated against 1M-row seed data.

**Features addressed:** Grid view, virtualized rendering, infinite scroll

**Pitfalls to avoid:**
- Pitfall 4: Fixed row height enforced in CSS from the start
- Pitfall 5: Row virtualization only — column virtualization deferred to Phase 6
- Pitfall 6: `data` and `columns` options wrapped in `useMemo` from first implementation
- Pitfall 15: Database UUID used as React `key`, never array index

**Research flag:** This phase needs careful implementation against documented examples. The TanStack Table virtualized infinite scrolling example (official docs) is the primary reference. Consider `/gsd:research-phase` if the sticky header + spacer div pattern needs deeper investigation.

---

### Phase 5: Cell Editing and Keyboard Navigation

**Rationale:** Cell editing is the core interaction loop. Keyboard navigation is the most user-expectation-sensitive surface in the product — any deviation from spreadsheet conventions (arrow keys, Tab, Enter, Escape) is immediately felt as broken. This phase also introduces optimistic updates.

**Delivers:** `<GridCell>` component with display/edit states per column type (Text, Number). Full keyboard navigation model: arrow keys (navigate), Enter/F2/typing (enter edit), Tab (commit + move right), Escape (cancel). Optimistic cell updates via tRPC mutation with `AbortController` cancellation for race conditions. Focus management: logical cursor state in ref, `scrollToIndex` + `requestAnimationFrame` focus restoration.

**Features addressed:** Cell selection, inline editing, keyboard navigation, optimistic updates, row CRUD (add row, delete row, expand record)

**Pitfalls to avoid:**
- Pitfall 10: Logical cursor state separate from DOM focus; save race condition handled with `AbortController`
- Pitfall 14: Column resize deferred commit to `mouseup`; `React.memo` on table body

**Research flag:** Focus management in virtualized grids is sparsely documented. The thecandidstartup.org spreadsheet series is the best available reference. Consider `/gsd:research-phase` for the keyboard navigation + focus trap implementation.

---

### Phase 6: Toolbar — Filter, Sort, Hide Fields, Search

**Rationale:** Filter, sort, and hide fields are grouped because they all modify view state and are best built together. A half-built toolbar (filters without sorts) creates an incomplete feeling. Search is different in character (UI highlighting, not data filtering) but belongs in the same toolbar phase.

**Delivers:** Toolbar component with badge counts. Filter panel: add/remove conditions, field + operator + value per row, AND/OR toggle, live preview. Sort panel: add/remove rules, field + direction, drag to reorder. Hide fields panel: toggle per column, show all / hide all. Search: inline search bar, cell highlighting, "X matches in Y records" counter (highlights only, does not hide rows). All toolbar state wired to view config save.

**Features addressed:** Hide fields, Filter (text and number operators), Sort (cascading), Search (highlight), toolbar badge counts, column header sort click

**Pitfalls to avoid:**
- Pitfall 9: Filter/sort changes reset infinite query cursor; debounce filter input (300ms) before triggering query key change; `placeholderData: keepPreviousData` prevents loading flicker

**Research flag:** Standard patterns. Skip `/gsd:research-phase`.

---

### Phase 7: Column Virtualization and Column Management

**Rationale:** Column virtualization is separated from row virtualization (Phase 4) because it has its own complexity (dual-axis scroll lag, `<div>` DOM requirement already established) and is only needed when column count grows. Column resize and reorder are added here alongside because they interact with column width state that the column virtualizer needs.

**Delivers:** Horizontal column virtualizer alongside row virtualizer. Column resize (drag header edge, defer state commit to `mouseup`, live visual preview). Column reorder (drag-and-drop header). Sticky/frozen primary field column. Column virtualization enabled only above ~20 columns (below that threshold, rendering all columns is cheaper).

**Features addressed:** Column resize, column reorder, primary field frozen, column virtualization

**Pitfalls to avoid:**
- Pitfall 5: Column virtualizer only enabled above column count threshold; `requestAnimationFrame` scroll throttling if needed
- Pitfall 14: Column resize `React.memo` boundary established in Phase 5 is relied on here

**Research flag:** Bi-directional virtualization scroll performance is a known problem area (GitHub #685). Consider `/gsd:research-phase` if column count will regularly exceed 30 in v1 scope.

---

### Phase 8: View Persistence and Polish

**Rationale:** View state persistence is last because it requires all the toolbar and grid features to be working before there is anything meaningful to persist. This phase also covers the "should have" polish items that make the product feel complete.

**Delivers:** Full view config persistence: filters, sorts, column visibility, column widths, and search query saved to `views` table. `updatedAt` conflict detection for multi-tab scenarios. URL reflects active view ID. Toolbar badge counts (already built in Phase 6, verified here). Per-view state survives page reload. View creation, renaming, deletion UI.

**Features addressed:** Persistent view state, URL reflects view, all "should have" polish items

**Pitfalls to avoid:**
- Pitfall 11: Server state as truth for view configs; `updatedAt` conflict detection; debounced auto-save for column widths and search

**Research flag:** Standard patterns. Skip `/gsd:research-phase`.

---

### Phase Ordering Rationale

The order strictly follows the feature dependency graph from FEATURES.md: schema before data layer, data layer before layout, layout before grid, grid before editing, editing before toolbar, toolbar before persistence. The key decisions that enforce this ordering:

- Schema and indexes must precede all data operations — changing them later is a migration that touches every row
- Auth session strategy (JWT) cannot be changed after deployment without invalidating all active sessions
- Row virtualization must be active from the first page of data — retrofitting it into an existing non-virtualized grid requires refactoring all cell components
- `manualSorting/Filtering/Pagination: true` on TanStack Table must be set from Phase 4 — if client-side sort/filter ever processes 1M rows in memory, the browser freezes
- Column virtualization is deferred to Phase 7 because it requires the `<div role="grid">` DOM (established in Phase 4) and adds scroll complexity; under ~20 columns it is slower than rendering all columns

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 4 (Grid Core):** The sticky header + spacer-div approach with TanStack Virtualizer has limited official documentation. The TanStack virtual examples use `translateY` which breaks sticky headers. Verify the `paddingTop/paddingBottom` spacer pattern in the current v3 API before implementation.
- **Phase 5 (Cell Editing):** Focus management in virtualized grids is under-documented. The `scrollToIndex` + `requestAnimationFrame` focus restoration pattern is from community sources, not official docs. Validate the pattern works correctly with the chosen virtualizer version.
- **Phase 7 (Column Virtualization):** If column count in v1 will regularly exceed 30, the bi-directional virtualizer scroll performance issue (GitHub #685) needs a concrete mitigation strategy before implementation begins.

**Phases with standard patterns (skip `/gsd:research-phase`):**

- **Phase 1 (Foundation):** All patterns (Auth.js v5 edge split, Drizzle + Supabase connection, index creation) are well-documented in official sources.
- **Phase 2 (tRPC Data Layer):** Drizzle `.$dynamic()` and tRPC cursor pagination are official documented patterns. One gotcha (JSONB prepared statement bug #4935) is known and the fix is documented.
- **Phase 3 (Navigation Layout):** Standard Next.js App Router nested layouts.
- **Phase 6 (Toolbar):** Filter/sort/search UI patterns are standard React state management with tRPC query key invalidation.
- **Phase 8 (View Persistence):** Standard server-state mutation patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry 2026-03-17. Compatibility matrix confirmed. One flag: Zod v4 + tRPC v11 compatibility unconfirmed — pin to zod@3 initially. |
| Features | HIGH (core) / MEDIUM (details) | Keyboard shortcuts and views behavior from multiple official/community sources. Exact toolbar button order and layout not directly verified against current 2026 Airtable UI — described behavior may have changed in "New Base UI" update. |
| Architecture | HIGH | Schema decision (JSONB hybrid), index strategy, and tRPC cursor pagination are backed by authoritative PostgreSQL and ORM sources. Build order follows verifiable dependency graph. |
| Pitfalls | HIGH | 13 specific pitfalls with concrete prevention strategies. 8 are backed by official docs, open GitHub issues, or named CVEs. 5 are from high-quality community benchmarks and case studies. |

**Overall confidence: HIGH**

### Gaps to Address

- **Zod v4 + tRPC v11 compatibility:** Pin to `zod@3.23.x` at project init. Test Zod v4 upgrade as an explicit task in Phase 2 before relying on any Zod v4-specific features.
- **Current Airtable UI layout:** The toolbar button order and exact layout dimensions are described from pre-2024 sources. Visually verify against current Airtable before implementing the toolbar in Phase 6.
- **Supabase RLS decision:** Research covers both using Supabase RLS (Pitfall 13) and not using it. The recommended tRPC `protectedProcedure` approach at the application layer makes RLS optional. Decide at Phase 1 whether to enable RLS as defense-in-depth or skip it entirely for v1.
- **Column count planning:** The decision to activate column virtualization (Phase 7) depends on expected column count. If v1 scope includes more than 20 user-defined columns routinely, column virtualization should move up to Phase 4 alongside row virtualization.
- **Drizzle `.$dynamic()` + cursor WHERE interaction:** The ARCHITECTURE.md cursor pattern applies a second `.where()` after `withFiltersAndSort()`. Drizzle's `.$dynamic()` should handle multiple `.where()` calls correctly, but this specific pattern (filter conditions + cursor condition composed) should be tested with the actual Drizzle version before Phase 2 is complete.

---

## Sources

### Primary (HIGH confidence)
- tRPC v11 official docs (trpc.io) — cursor pagination, useInfiniteQuery, httpBatchStreamLink
- Drizzle ORM official docs (orm.drizzle.team) — dynamic query building, Supabase connection, sql template tag
- Auth.js v5 official docs (authjs.dev) — edge middleware split, Drizzle adapter
- TanStack Table v8 official docs — virtualization guide, manual mode, infinite scroll example
- TanStack Virtualizer v3 official docs — useVirtualizer API, scrollToIndex
- CrunchyData blog — GIN index sizing and jsonb_path_ops operator class
- cybertec-postgresql.com — EAV anti-pattern in PostgreSQL (authoritative source)
- CVE-2025-29927 — Next.js middleware bypass (CVSS 9.1, patched in 14.2.25/15.2.3)
- npm registry (2026-03-17) — all package versions verified

### Secondary (MEDIUM confidence)
- heap.io — JSONB query planner selectivity issues and 2000x slowdown case
- makerkit.dev — Drizzle vs Prisma comparison (2026)
- Airtable community forums — keyboard shortcut behavior, sort behavior text vs number
- Softr/SwitchLabs Airtable guides — views system behavior, column freeze
- Supabase docs — RLS performance best practices, connection modes

### Tertiary (LOW confidence)
- GitHub TanStack/virtual discussion #284 — `<table>` vs `<div>` for column virtualization (community consensus, not official recommendation)
- thecandidstartup.org spreadsheet series — focus management and event handling in React grids (single author, well-reasoned but not official)
- Community descriptions of Airtable toolbar layout — may not reflect 2026 UI after "New Base UI" update

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
