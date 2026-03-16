# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 8 (Foundation)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Roadmap revised: Vercel deployment added to Phase 1; standing deployment note added for all phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 4: Sticky header + spacer-div virtualizer pattern has limited official docs — verify paddingTop/paddingBottom spacer approach against TanStack Virtualizer v3 API before implementing
- Phase 5: Focus management in virtualized grids is under-documented — validate scrollToIndex + requestAnimationFrame focus restoration pattern before implementing
- Phase 7: If v1 regularly exceeds 30 columns, bi-directional virtualizer scroll performance issue (GitHub #685) needs mitigation strategy before implementation

## Session Continuity

Last session: 2026-03-17
Stopped at: Roadmap revised (Vercel deployment in Phase 1); ready to begin Phase 1 planning
Resume file: None
