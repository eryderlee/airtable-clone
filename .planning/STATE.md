# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.
**Current focus:** Phase 5 — Cell Editing

## Current Position

Phase: 4 of 8 (Grid Core) — Complete ✓
Plan: 3/3 complete
Status: Phase 4 verified 5/5. Ready for Phase 5.
Last activity: 2026-03-17 — Completed 04-03. Random-access virtual scroll, skeleton rows, live bulk insert count, rowOrder seek optimization. User verified in browser.

Progress: [██████████] ~55% (12 of ~20 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~18 min
- Total execution time: ~134 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 complete | ~78 min | ~26 min |
| 02-data-layer | 2/2 complete | ~47 min | ~24 min |
| 03-navigation-shell | 3/3 complete | ~10 min | ~3 min |
| 04-grid-core | 3/3 complete | ~9 min | ~4.5 min |

**Recent Trend:**
- Last 5 plans: 03-01 (~5 min), 03-02 (~5 min), 03-03 (~unknown), 04-01 (~4 min), 04-02 (~5 min)
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

### Pending Todos

- None — Phase 4 complete. Phase 5 (Cell Editing) is next.

### Blockers/Concerns

- Phase 5: Focus management in virtualized grids is under-documented — validate scrollToIndex + requestAnimationFrame focus restoration pattern before implementing
- Phase 7: If v1 regularly exceeds 30 columns, bi-directional virtualizer scroll performance issue (GitHub #685) needs mitigation strategy before implementation

## Session Continuity

Last session: 2026-03-17
Stopped at: Phase 4 complete — all 3 plans done, verified 5/5. Ready for Phase 5.
Resume file: /gsd:plan-phase 05
