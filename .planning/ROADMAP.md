# Roadmap: Airtable Clone

## Overview

Ten phases build the Airtable clone from the database outward: schema, auth, and Vercel deployment first (live URL from day one), then the tRPC data layer that every UI component depends on, then layout and navigation, then the virtualized grid core, then cell editing, then the toolbar, then column virtualization, then view persistence, then a database migration to Neon, then a UX performance pass making every mutation feel instant via optimistic updates. Each phase delivers a complete, verifiable capability and deploys to the same Vercel project. The performance target — 1M rows without lag — is baked into the architecture from Phase 1 and never retrofitted.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - T3 stack scaffolding, schema, auth, Supabase connection, and live Vercel deployment
- [x] **Phase 2: Data Layer** - All tRPC routers with cursor pagination, dynamic filter/sort builder, and view config merge
- [x] **Phase 3: Navigation Shell** - App Router nested layouts, sidebar, table tab bar, views panel, base/table CRUD
- [x] **Phase 4: Grid Core** - Virtualized infinite scroll grid wired to live data, column management, 100k row insertion
- [x] **Phase 5: Cell Editing** - Inline editing with full spreadsheet keyboard navigation and optimistic updates
- [x] **Phase 6: Toolbar** - Search, filter, sort, and hide-columns controls with DB-level execution
- [x] **Phase 7: Column Virtualization** - Horizontal virtualization for large column counts, column resize
- [x] **Phase 8: View Persistence** - Full per-view state saved and restored across sessions
- [ ] **Phase 9: Neon Migration** - Database migration from Supabase to Neon, Vercel env update, production cutover
- [ ] **Phase 11: Instant Interactions & Cold Start Optimization** - Every click responds instantly, cold start mitigated, table/view/row creation never blocks the UI

## Standing Deployment Note

Every phase merges to the main branch and deploys to the same Vercel project established in Phase 1. Each phase is considered complete only when its changes are live at the Vercel URL.

## Standing UI Fidelity Checkpoint

Phases 3, 4, 5, 6, and 8 each touch the visible UI. These phases are not considered complete until the user has manually verified the result against Airtable. Playwright MCP will be used during these phases to capture Airtable screenshots as a reference. Any visible deviation from Airtable's layout, spacing, colors, or interaction behavior must be resolved before the phase is marked complete.

## Phase Details

### Phase 1: Foundation
**Goal**: The T3 stack is scaffolded, the database schema and auth are correct, and the app is deployed live on Vercel — the skeleton is publicly accessible and every subsequent phase builds on top of it.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, BASE-04
**Plans**: 3 plans
**Success Criteria** (what must be TRUE):
  1. The app is deployed to Vercel and accessible at a public URL (even if it only shows the sign-in screen)
  2. User can sign in via Google OAuth and is redirected to their dashboard
  3. User session persists across browser refresh (JWT strategy, not database sessions)
  4. User can sign out from any page and is redirected to the sign-in screen
  5. Only the authenticated user's bases are visible — no other user's data is accessible
  6. A 1M-row seed is present in the database and cursor-paginated queries against it complete in under 200ms

Plans:
- [ ] 01-01-PLAN.md — Scaffold T3 stack, configure Supabase connection, deploy to Vercel
- [ ] 01-02-PLAN.md — Drizzle schema (all tables + indexes) and Auth.js v5 Google OAuth wiring
- [ ] 01-03-PLAN.md — 1M-row seed script, ANALYZE, cursor pagination benchmark

### Phase 2: Data Layer
**Goal**: All five tRPC routers expose type-safe procedures that the UI can call — cursor pagination, dynamic filter/sort, and view config merge are defined in the contract before any UI is built.
**Depends on**: Phase 1
**Requirements**: (Infrastructure phase — no direct requirement IDs; enables all subsequent phases)
**Plans**: 2 plans
**Success Criteria** (what must be TRUE):
  1. `row.getRows` infinite query returns the first page of 1M-row table in under 200ms with correct cursor shape
  2. A filter condition (e.g., Text contains "foo") applied to `row.getRows` executes entirely in PostgreSQL and returns only matching rows
  3. A sort applied to `row.getRows` returns rows in correct order without any client-side re-sorting
  4. All procedures reject unauthenticated requests with a 401 — no data is accessible without a valid session

Plans:
- [ ] 02-01-PLAN.md — Base, table, column, and view routers with full CRUD procedures (protectedProcedure throughout)
- [ ] 02-02-PLAN.md — Row router with cursor pagination, filter/sort builders, search, view config merge, bulk create

### Phase 3: Navigation Shell
**Goal**: Users can navigate between their bases, tables, and views using an Airtable-accurate layout shell — sidebar, tab bar, and views panel are in place before any grid content is rendered.
**Depends on**: Phase 2
**Requirements**: BASE-01, BASE-02, BASE-03, TBL-01, TBL-02, TBL-03, TBL-04, UI-01, UI-02, UI-03, UI-05
**Plans**: 3 plans
**Success Criteria** (what must be TRUE):
  1. User can create, rename, and delete a base from the left sidebar and the change is immediately reflected
  2. User can create, rename, and delete a table within a base using the top tab bar
  3. New tables are pre-populated with realistic faker.js data (columns and rows visible immediately)
  4. User can switch between tables by clicking tabs — URL updates and content changes without a full page reload
  5. The overall layout matches Airtable 1:1: left sidebar (bases), top tab bar (tables), views panel, content area

Plans:
- [ ] 03-01-PLAN.md — Route hierarchy with (app) route group, nested layouts, server-side redirects, InlineEdit component
- [ ] 03-02-PLAN.md — AppSidebar (base CRUD), TableTabBar (table CRUD + seed), ViewsPanel (view list/switch)
- [ ] 03-03-PLAN.md — Pixel-accurate Airtable layout pass with Playwright reference scrape + human verification

### Phase 4: Grid Core
**Goal**: The virtualized grid renders live data from the database, handles 100k+ rows without lag, manages columns, and is ready for cell editing to be layered on top.
**Depends on**: Phase 3
**Requirements**: TBL-05, COL-01, COL-02, COL-03, COL-04, PERF-01, PERF-02, PERF-05
**Success Criteria** (what must be TRUE):
  1. The grid renders rows from the database using row virtualization — only visible rows exist in the DOM at any time
  2. Scrolling a 1M-row table is smooth with no visible lag or scroll jumps
  3. User can click "Add 100k rows" and the table gains 100k rows; a loading state is shown while the insert runs
  4. User can add Text and Number columns, rename a column by double-clicking its header, and delete a column
  5. Loading states appear during all async operations: initial fetch, page loads, column operations
**Plans**: TBD

Plans:
- [ ] 04-01: TanStack Table in manual mode (manualSorting, manualFiltering, manualPagination: true) + TanStack Virtualizer row virtualizer with spacer-div approach; useInfiniteQuery wired to row.getRows
- [ ] 04-02: Column management UI (add Text/Number, rename via double-click, delete); 100k row bulk insert button with loading state
- [ ] 04-03: Performance validation against 1M-row seed — scroll smoothness, initial load time, fetchNextPage trigger at viewport edge

## Technical Constraints

### rowOrder seek assumption (Phase 4)
`row.getByOffset` uses `WHERE row_order >= offset` instead of SQL `OFFSET` for O(log n) random-access seeks. This relies on `rowOrder` being **dense** — no gaps from deletions. When row deletion is implemented (Phase 5 or 6), this breaks: after deleting row 500, seeking to "page 5" via `row_order >= 500` returns the wrong rows.

**Fix required when row deletion lands:** Either (a) recompact `rowOrder` on delete (expensive for large tables), or (b) switch `getByOffset` back to SQL `OFFSET` with a keyset optimization, or (c) maintain a separate dense `position` column via a trigger.

---

### Phase 5: Cell Editing
**Goal**: Users can edit any cell inline using the full spreadsheet keyboard navigation model — arrow keys, Tab, Enter, Escape — with changes persisted to the database.
**Depends on**: Phase 4
**Requirements**: CELL-01, CELL-02, CELL-03, CELL-04, CELL-05
**Success Criteria** (what must be TRUE):
  1. User can click any cell to select it and press Enter (or start typing) to enter edit mode
  2. Arrow keys move the selection between cells in navigation mode without entering edit mode
  3. Tab moves to the next cell right (committing the edit); Shift+Tab moves left
  4. Escape exits edit mode and reverts any uncommitted change
  5. Cell edits are saved to the database on blur or Enter, and the new value survives a page reload
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — GridCell component with display/edit modes, cursor state in GridView, double-rAF focus management
- [ ] 05-02-PLAN.md — Full keyboard navigation model (arrows, Enter, Escape, Tab, Shift+Tab) + optimistic tRPC mutation with rollback

### Phase 6: Toolbar
**Goal**: Users can search, filter, sort, and hide columns from the toolbar — all operations execute at the database level and apply immediately to the visible grid.
**Depends on**: Phase 5
**Requirements**: SFS-01, SFS-02, SFS-03, SFS-04, SFS-05, SFS-06, SFS-07, SFS-08, UI-04
**Success Criteria** (what must be TRUE):
  1. User can type in the search bar and only rows containing the search term are displayed (executed in PostgreSQL)
  2. User can add a filter condition (Text: contains, does not contain, equals, is empty, is not empty; Number: greater than, less than) and the grid updates immediately showing only matching rows
  3. User can add one or more sort rules (Text A→Z/Z→A; Number ascending/descending) and the grid re-orders via a database query
  4. User can toggle column visibility from the Hide Fields panel and selected columns disappear from the grid
  5. The toolbar shows badge counts for active filter and sort rules
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — Extend getByOffset/count with filter/sort/search params; add toolbar state to GridView with cache invalidation
- [ ] 06-02-PLAN.md — SearchBar, FilterPanel, SortPanel components wired into toolbar with DB-level execution
- [ ] 06-03-PLAN.md — HideFieldsPanel, badge counts on Filter/Sort buttons, hidden column exclusion in grid and keyboard nav

### Phase 7: Column Virtualization
**Goal**: The grid handles large column counts without lag by activating horizontal virtualization above the threshold where rendering all columns becomes expensive.
**Depends on**: Phase 6
**Requirements**: PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. A table with 30+ columns scrolls horizontally without visible lag or scroll stuttering
  2. Only columns within (or near) the horizontal viewport are present in the DOM when column virtualization is active
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Column virtualizer with threshold-based activation (>= 20 columns), virtual padding spacers, horizontal scrollToCell

### Phase 8: View Persistence
**Goal**: Every view's filter, sort, column visibility, and search configuration is saved to the database and restored exactly on next load — views are the durable, shareable state of a grid.
**Depends on**: Phase 7
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. User can create a named view and it appears in the views panel immediately
  2. User can switch between views and each view restores its own filter, sort, column visibility, and search query
  3. A view's configuration survives a full page reload — filter, sort, hide, and search are all restored exactly
  4. The URL reflects the active view ID — sharing the URL opens the same view with the same configuration
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — SSR-seeded view config persistence (initialConfig prop from page.tsx to GridView, auto-save via 800ms debounced useEffect)
- [ ] 08-02-PLAN.md — View rename/delete UI in ViewsPanel (InlineEdit + delete button with last-view guard); end-to-end human verification

### Phase 9: Neon Migration
**Goal**: The database is fully migrated from Supabase to Neon — all data intact, Vercel env vars updated, migrations runnable directly from Vercel build nodes (no more IPv6 workaround), and the live app confirmed healthy post-migration.
**Depends on**: Phase 8
**Requirements**: (Infrastructure phase — no direct requirement IDs)
**Success Criteria** (what must be TRUE):
  1. The app is live on Vercel pointing to Neon with no errors
  2. All existing data (tables, columns, rows, views) is present and correct after migration
  3. `npx drizzle-kit push` runs successfully against Neon from a local machine
  4. The 1M-row seed is present (either migrated or re-seeded) and cursor-paginated queries complete in under 200ms
  5. Cold-start behavior is documented (Neon free tier scales to zero after inactivity)
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — Neon project setup, local env config, schema push, dev server verification
- [ ] 09-02-PLAN.md — Data migration (pg_dump/pg_restore or re-seed fallback), integrity and performance verification
- [ ] 09-03-PLAN.md — Vercel env var update, production deployment, live verification, cold-start documentation

### Phase 10: UX Performance — Optimistic Updates
**Goal**: Every user-facing mutation (create/rename/delete base, table, column, row, view; switch view; open base) feels instant — optimistic updates eliminate visible loading states for all common operations so the UI responds in under 50ms regardless of network latency.
**Depends on**: Phase 9
**Requirements**: (UX quality phase — no direct requirement IDs)
**Success Criteria** (what must be TRUE):
  1. Creating a base/table/view shows the new item in the UI immediately (before server confirms)
  2. Renaming a base/table/column/view updates the label immediately on Enter without waiting for the mutation
  3. Deleting a base/table/column/view removes it from the UI immediately with rollback on error
  4. Adding a column appears in the grid header immediately
  5. Switching views renders the cached view config instantly (no loading flash)
  6. Opening a base navigates immediately to the first table without a loading skeleton
  7. All operations still show error toasts and roll back UI state if the server returns an error
**Plans**: TBD

### Phase 11: Instant Interactions & Cold Start Optimization
**Goal**: Every click, navigation, and creation feels instantaneous — buttons never make the user wait before showing a UI change, cold start latency is mitigated with prefetching, and all view/table/row operations switch UI immediately while data loads in the background.
**Depends on**: Phase 10
**Requirements**: (UX polish phase — no direct requirement IDs)
**Plans**: 2 plans
**Success Criteria** (what must be TRUE):
  1. Cold start: opening a base on first load is not noticeably slower than a warm load — prefetch or skeleton navigation eliminates the double-wait feel
  2. Adding a table switches to the new tab immediately; data (rows/columns) loads in afterward — user never waits before the tab appears
  3. Switching tables navigates instantly to the tab; grid content loads in without blocking the switch
  4. Creating a new grid view adds it to the views panel and switches to it instantly; no gap between button press and view appearing
  5. No active-view highlight loss after creating a view — the newly created view remains visually active at all times until user interaction
  6. View order in the sidebar is stable — views never reorder themselves when switching between them
  7. Adding a new row appears in the grid immediately without visible delay
  8. Navigating home (back button / logo) is instant with no loading pause
  9. Creating a new base navigates directly to the base — it does not flash the home page with the new base card before redirecting
  10. Creating a base is visually instant — the UI responds before the server confirms
  11. Opening a base navigates immediately to the first table on click; grid loads data in the background
  12. All interactive buttons (create, delete, switch, navigate) respond with an immediate UI change; data may load afterward but the button never blocks

Plans:
- [ ] 11-01-PLAN.md — Navigation fixes: remove router.refresh() from home nav, cache-first table tab switching, view order stability
- [ ] 11-02-PLAN.md — Optimistic row add, view active highlight (pendingViewId), base creation no-flash fix, cold start prefetch

### Phase 12: Server-Side Search
**Goal**: Search filters rows at the database level — matching rows are excluded server-side so users find results across all pages of a 1M-row table, not just loaded pages.
**Depends on**: Phase 11
**Requirements**: SFS-01, SFS-02 (currently degraded — client-side highlight only)
**Gap Closure**: Closes TD-1 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Typing in the search bar triggers a server-side query — only rows containing the search term are fetched
  2. Rows not matching the search term are absent from the grid (not just un-highlighted)
  3. The row count updates to reflect the filtered result set
  4. Clearing the search restores the full unfiltered row set
  5. Search works correctly in combination with active filter and sort rules
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md — Pass searchQuery to getByOffset.fetch, row.count query, and cache-reset dep array; remove intentional-exclusion comment

---

### Phase 13: Navigation & Housekeeping
**Goal**: Cold-path base navigation is instant (no sequential fetches before router.push), prefetch cache keys are correct, and REQUIREMENTS.md accurately reflects what has been implemented.
**Depends on**: Phase 12
**Requirements**: (Housekeeping phase — no new requirements; closes TD-2, TD-5, TD-7 from v1.0 audit)
**Gap Closure**: Closes TD-2, TD-5, TD-7 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Clicking a base on cold cache navigates immediately — URL changes before data loads (same pattern as TableTabBar.handleTabClick)
  2. handleTabHover count prefetch uses the correct cache key (searchQuery: "" included) — prefetch is reused by GridView on mount
  3. REQUIREMENTS.md traceability table reflects actual implementation status (all implemented requirements checked)
**Plans**: 1 plan

Plans:
- [ ] 13-01-PLAN.md — HomeContent cold path fix (router.push first), handleTabHover prefetch key fix, REQUIREMENTS.md update

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-17 |
| 2. Data Layer | 2/2 | Complete | 2026-03-17 |
| 3. Navigation Shell | 3/3 | Complete | 2026-03-17 |
| 4. Grid Core | 3/3 | Complete | 2026-03-17 |
| 5. Cell Editing | 2/2 | Complete | 2026-03-17 |
| 6. Toolbar | 3/3 | Complete | 2026-03-18 |
| 7. Column Virtualization | 1/1 | Complete | 2026-03-18 |
| 8. View Persistence | 2/2 | Complete | 2026-03-18 |
| 9. Neon Migration | 0/3 | Not started | - |
| 10. UX Performance | 3/3 | Complete | 2026-03-18 |
| 11. Instant Interactions | 2/2 | Complete | 2026-03-19 |
| 12. Server-Side Search | 1/1 | Complete | 2026-03-19 |
| 13. Navigation & Housekeeping | 0/1 | Not started | - |
