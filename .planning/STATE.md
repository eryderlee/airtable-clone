# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.
**Current focus:** Phase 2 — Data Layer

## Current Position

Phase: 2 of 8 (Data Layer) — In progress
Plan: 2 of 3 complete in this phase (02-02 complete — row router with cursor pagination, filters, sorts, view merge)
Status: In progress — 02-02 row router done; 02-03 next
Last activity: 2026-03-17 — Completed 02-02-PLAN.md. Row router with ROW tuple cursor pagination, JSONB filters, sorts, view config merge, bulkCreate. Build passing.

Progress: [█████░░░░░] ~21% (~5/24 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~25 min
- Total execution time: ~125 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 complete | ~78 min | ~26 min |
| 02-data-layer | 2/3 complete | ~47 min | ~24 min |

**Recent Trend:**
- Last 5 plans: 01-02 (~10 min), 01-03 (~8 min), 02-01 (~25 min), 02-02 (~22 min)
- Trend: Stable (~22-25 min for well-specified plans)

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

### Pending Todos

- None for 02-02 — all row router constraints met (ROW tuple, .$dynamic(), filter/sort in PostgreSQL)

### Blockers/Concerns

- Phase 4: Sticky header + spacer-div virtualizer pattern has limited official docs — verify paddingTop/paddingBottom spacer approach against TanStack Virtualizer v3 API before implementing
- Phase 5: Focus management in virtualized grids is under-documented — validate scrollToIndex + requestAnimationFrame focus restoration pattern before implementing
- Phase 7: If v1 regularly exceeds 30 columns, bi-directional virtualizer scroll performance issue (GitHub #685) needs mitigation strategy before implementation

## Session Continuity

Last session: 2026-03-17T05:56:00Z
Stopped at: Completed 02-02-PLAN.md (row router with cursor pagination, filters, sorts, view merge, bulkCreate)
Resume file: .planning/phases/02-data-layer/02-03-PLAN.md (next plan in data layer phase)
