# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 8 (Foundation)
Plan: 1 of 3 complete in this phase (01-01 complete, 01-02 next)
Status: In progress
Last activity: 2026-03-17 — Completed 01-01-PLAN.md (T3 scaffold + Vercel deploy)

Progress: [█░░░░░░░░░] ~8% (1 of 3 plans in phase 1 complete; ~1/24 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~60 min
- Total execution time: ~60 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1/3 complete | ~60 min | ~60 min |

**Recent Trend:**
- Last 5 plans: 01-01 (60 min)
- Trend: —

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

### Pending Todos

- Add https://airtable-clone-flame.vercel.app/api/auth/callback/google to Google Console OAuth authorized redirect URIs
- Run 01-02: Drizzle schema definition and migrations against Supabase

### Blockers/Concerns

- Phase 4: Sticky header + spacer-div virtualizer pattern has limited official docs — verify paddingTop/paddingBottom spacer approach against TanStack Virtualizer v3 API before implementing
- Phase 5: Focus management in virtualized grids is under-documented — validate scrollToIndex + requestAnimationFrame focus restoration pattern before implementing
- Phase 7: If v1 regularly exceeds 30 columns, bi-directional virtualizer scroll performance issue (GitHub #685) needs mitigation strategy before implementation

## Session Continuity

Last session: 2026-03-17T07:16:00Z
Stopped at: Completed 01-01-PLAN.md (all 3 tasks done — scaffold, env vars, Vercel deploy)
Resume file: .planning/phases/01-foundation/01-02-PLAN.md
