# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.
**Current focus:** Phase 9 — Neon Migration

## Current Position

Phase: 9 of 9 (Neon Migration) — Complete
Plan: 3/3 complete
Status: ALL PHASES COMPLETE. Phase 9 done: Neon connected (09-01), data migration Option B (09-02), Vercel cutover verified (09-03). Production live at https://airtable-clone-flame.vercel.app on Neon.
Last activity: 2026-03-18 — Completed 09-03-PLAN.md (Vercel cutover: production verified HTTP 200/307, PROJECT.md updated)

Progress: [███████████████████████] 100% (27 of 27 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~17 min
- Total execution time: ~142 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 complete | ~78 min | ~26 min |
| 02-data-layer | 2/2 complete | ~47 min | ~24 min |
| 03-navigation-shell | 3/3 complete | ~10 min | ~3 min |
| 04-grid-core | 3/3 complete | ~9 min | ~4.5 min |
| 05-cell-editing | 2/2 complete | ~15 min | ~7.5 min |
| 06-toolbar | 3/3 complete | ~23 min | ~8 min |

**Recent Trend:**
- Last 5 plans: 04-01 (~4 min), 04-02 (~5 min), 05-01 (~5 min), 05-02 (~10 min), 06-01 (~8 min)
- Trend: Well-specified UI plans with clear component specs execute very quickly

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: JSONB hybrid schema for cell storage (not EAV) — accepted write amplification trade-off for v1 single-user scenario
- Init: Auth.js v5 two-file edge split required (not v4) — CVE-2025-29927 pattern must be followed from Phase 1
- Init: Cursor (keyset) pagination only — OFFSET is permanently banned; composite (row_order, id) cursor baked into schema
- Init: Pin zod@3 at project init — Zod v4 + tRPC v11 compatibility unconfirmed
- Revision: Vercel deployment is part of Phase 1, not deferred — app must be live at a public URL before Phase 1 is complete; all subsequent phases deploy to the same Vercel project
- 01-01: Manual scaffold used (create-t3-app TTY error in non-interactive terminal) — equivalent output confirmed by build passing
- 01-01: Auth.js v5 two-file edge split implemented: src/server/auth/config.ts (Node/DB) + src/server/auth/index.ts (exports) + src/proxy.ts (edge)
- 01-01: Drizzle prepare: false confirmed — required for Supabase Supavisor transaction pooler (port 6543)
- 01-01: DIRECT_URL configured as optional in src/env.js, used by drizzle.config.ts for direct migrations
- 01-01: Vercel project name = airtable-clone under eryderlee-7779s-projects scope
- 01-01: Production URL = https://airtable-clone-flame.vercel.app (HTTP 200 confirmed)
- 01-01: Google OAuth production redirect URI (https://airtable-clone-flame.vercel.app/api/auth/callback/google) must be added to Google Console before testing auth in production
- 01-02: Supabase direct host is IPv6-only; Vercel build nodes lack IPv6 egress — Drizzle migrations must be applied via local `npx drizzle-kit push` or Supabase SQL Editor (not Vercel build step)
- 01-02: JWT strategy + DrizzleAdapter: adapter persists OAuth account links, JWT carries session — no session table lookups per request
- 01-02: rows.cells is JSONB Record<string, string|number|null> with default {} — JSONB hybrid schema confirmed for v1
- 01-03: ROW tuple comparison required for cursor pagination — OR-expanded cursor pattern causes O(n) filter scan; `(row_order, id) > (cursorOrder, cursorId)` uses composite index as tight range, executes in 2ms on 1M rows
- 01-03: Benchmark baseline — first page 176ms client-side (5ms DB), large page 178ms client-side; cursor queries with correct ROW pattern are 2ms DB-side (network latency dominates)
- 01-03: 1M rows seeded via transaction pooler (DATABASE_URL port 6543); DIRECT_URL unavailable (IPv6-only) but not needed for 1000-row chunks
- 02-01: @faker-js/faker moved from devDependencies to dependencies — table.create seed runs at runtime; devDep not available in production builds
- 02-01: max(columns.order) + 1 for column auto-increment — handles gaps/deletions gracefully; no counter column needed
- 02-01: NOT_FOUND for ownership violations — avoids leaking whether a resource exists for a different user (no info leak)
- 02-01: view.updateConfig uses partial merge — clients can update only searchQuery without resetting filters
- 02-02: .$dynamic() called immediately after .from(rows) — required for Drizzle dynamic .where()/.orderBy() arrays
- 02-02: ROW tuple cursor confirmed: (row_order, id) > (cursor_order, cursor_id) — tight composite index range, ~2ms at 1M rows
- 02-02: View config merge: call-time params override stored config; empty array/string counts as "not provided"
- 02-02: bulkCreate returns { count } not items — returning 100k rows would saturate tRPC response
- 03-01: src/app/page.tsx deleted — Next.js App Router disallows app/page.tsx and app/(group)/page.tsx coexisting for same route
- 03-01: Next.js 15 layout params unused — use `await params` without destructuring to satisfy Next.js 15 requirement without triggering no-unused-vars lint
- 03-01: Non-null array assertions (!) flagged by ESLint — use optional chaining (?.) instead of non-null assertion on array[0] accesses
- 03-02: utils.view.getByTableId.fetch() for imperative view lookup in mutations — utils.client is not available in createTRPCReact (it is a @trpc/tanstack-react-query concept)
- 03-02: Server layouts pass IDs as props to client nav components; client components use useParams() only for IDs not in props
- 03-02: Table seed row count changed from 5 to 10 — TBL-04 requirement
- 04-01: display:grid on table element required for sticky thead + virtual tbody coexistence — standard table layout breaks this pattern
- 04-01: translateY absolute positioning for virtual rows (NOT spacer rows / paddingTop) — confirmed working pattern
- 04-01: keepPreviousData imported as function from @tanstack/react-query (React Query v5 change, NOT a boolean option)
- 04-01: cursor NOT passed in useInfiniteQuery input — tRPC auto-injects from getNextPageParam return value
- 04-01: RowData type exported from GridTable.tsx and imported by GridView.tsx — avoids duplication
- 04-01: Firefox measureElement guard via navigator.userAgent.includes("Firefox") check — Firefox getBoundingClientRect bug
- 04-02: GridHeader header name uses `header.id` fallback (not flexRender().toString()) — avoids no-base-to-string ESLint error; all current columns use string headers so this is safe
- 04-02: Column mutations placed in GridView (not child components) — stable callback refs passed down as props; avoids mutation hooks inside list renders
- 04-02: window.confirm() used for delete confirmation — simple browser dialog sufficient for phase 4; can be upgraded to custom modal later
- 04-03: useInfiniteQuery replaced with ref-based page cache — virtualizer sized to totalCount from row.count; fetchPage() uses utils.row.getByOffset.fetch() imperatively; forceUpdate() controls re-renders
- 04-03: getByOffset uses rowOrder >= offset seek (O(log n)) not SQL OFFSET (O(n)) — assumes dense rowOrder; breaks on row deletion (documented in ROADMAP Technical Constraints)
- 04-03: TanStack Table kept only for column header management — row rendering bypasses it entirely; cell values rendered directly from rowData.cells[colId]
- 05-01: Cursor state as two separate useState (cursor + editingCell) in GridView, NOT context — co-located with handlers
- 05-01: Double-rAF pattern confirmed for virtualized grids: first rAF scrolls virtualizer, second rAF queries newly rendered DOM cell
- 05-01: handleCommit defers mutation to 05-02 — interaction model established in 05-01, persistence in 05-02
- 05-01: isNaN() check restructured to avoid ESLint non-nullable-type-assertion-style — no type assertions needed
- 05-02: Optimistic mutation targets pageCacheRef directly (not React Query cache) — Phase 04-03 replaced useInfiniteQuery; utils.row.getRows does not exist
- 05-02: Tab intercepted at container level even in edit mode; Enter/Escape handled by GridCell input onKeyDown with stopPropagation
- 05-02: Printable-char detection: e.key.length === 1 && !ctrlKey && !metaKey && !altKey — catches all typeable chars, excludes modifier combos
- 05-02: Arrow keys stop at grid boundaries (no wrap); Tab wraps end-of-row to start-of-next-row
- 06-01: Two-path getByOffset: isFastPath = no filters + no sorts + no search uses rowOrder seek; SQL OFFSET when active — accepted O(n) trade-off for filtered/sorted queries
- 06-01: row.count only needs filters and searchQuery, not sorts — sorts don't affect row count
- 06-01: openPanel state lives in GridView alongside filters/sorts/search — all toolbar state co-located
- 06-01: isFirstRender ref guards cache-reset useEffect — prevents spurious reset on mount
- 06-01: columnOrder = visibleColumnIds (hidden columns excluded from keyboard nav index math)
- 06-02: onTogglePanel toggle API in GridToolbar (prev === panel ? null : panel in updater)
- 06-02: data-toolbar-panel attribute on panel wrappers for click-outside detection via element.closest()
- 06-02: HideFieldsPanel completed early in 06-02 — Plan 06-03 scope narrowed to view config persistence only
- 06-03: sql.raw(columnId) in buildFilterConditions/buildSortOrder embeds UUID without quotes — invalid SQL (cells->>UUID). Fixed by using columnId directly in SQL template (parameterized: cells->>$1)
- 06-03: Search changed to client-side highlight mode — rows are not hidden, matching cells get yellow highlight, navigation via prev/next arrows in search bar. searchQuery removed from row.count and getByOffset calls.
- 06-03: GridHeader hidden column fix — table.getHeaderGroups()[0]?.headers returns all columns; must filter by columnIds (visibleColumnIds from GridView) before passing to GridHeader
- 06-03: cacheVersion exposed from useReducer (was [, forceUpdate]) — drives searchMatches useMemo recompute when pages load into pageCacheRef
- 07-01: COLUMN_VIRTUALIZATION_THRESHOLD=20 — avoids GitHub #685 bi-directional scroll lag for tables under threshold; enabled: false on virtualizer skips all overhead
- 07-01: Virtual padding spacer pattern for column virtualization — left/right <td>/<th> spacers instead of translateX per cell; integrates with display:grid table layout
- 07-01: columnsToRender uses flatMap+undefined guard not non-null assertion — required by @typescript-eslint/no-unnecessary-type-assertion
- 07-01: COLUMN_VIRTUALIZATION_THRESHOLD=20 — avoids GitHub #685 bi-directional scroll lag for tables under threshold; enabled: false on virtualizer skips all overhead
- 07-01: Virtual padding spacer pattern for column virtualization — left/right <td>/<th> spacers instead of translateX per cell; integrates with display:grid table layout
- 07-01: columnsToRender uses flatMap+undefined guard not non-null assertion — required by @typescript-eslint/no-unnecessary-type-assertion
- 07-01: Column defs/visibleColumnIds moved before scrollToCell in GridView — TypeScript block-scoped use-before-declare error
- 08-01: key={viewId} on GridView forces React unmount/remount on view switch — eliminates stale state without manual cleanup
- 08-01: isFirstConfigRender ref separate from isFirstRender ref — each useEffect guard is independent
- 08-01: updateViewConfig is fire-and-forget (no optimistic update) — config save failure is silent; acceptable for v1
- 08-02: ViewsPanel rename via InlineEdit double-click + delete button with last-view guard; active-view deletion redirects to first remaining view
- 09-01: Neon PgBouncer requires prepare: false same as Supabase Supavisor — no runtime config change needed
- 09-01: sslmode=require in Neon connection URL is sufficient; no explicit ssl option in postgres() call needed
- 09-01: drizzle-kit push via DIRECT_URL (non-pooled) applied all 9 tables+indexes to fresh Neon DB cleanly
- 09-02: Option B (re-seed) chosen — pg_dump not available; Neon starts empty, user seeds via +100k button in browser UI
- 09-02: build failure (react/no-unescaped-entities in ViewsPanel.tsx) found and fixed during verification
- 09-03: Production verified live: HTTP 307 on root (auth redirect) + HTTP 200 on /sign-in = app healthy on Neon
- 09-03: Cold-start documented in PROJECT.md — Neon free tier scales to zero after 5 min idle, ~500ms-1s on first request after idle

### Pending Todos

- None — all 27 plans complete. Phase 10 (UX Performance) is the next planned phase but has not been started.

### Blockers/Concerns

- Phase 5: Focus management in virtualized grids is under-documented — RESOLVED in 05-01: double-rAF pattern works correctly
- Phase 7: GitHub #685 bi-directional scroll lag — RESOLVED via threshold-based activation (threshold=20 avoids the issue entirely for typical tables)

## Session Continuity

Last session: 2026-03-18
Stopped at: Completed 09-03-PLAN.md (Vercel cutover: production HTTP 200/307 verified, PROJECT.md updated to Neon). Phase 9 complete. All 27 plans done.
Resume file: None
