---
phase: 09-neon-migration
plan: 01
subsystem: database
tags: [neon, postgres, drizzle, pgbouncer, connection-pooling]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: drizzle schema, db/index.ts connection setup, DIRECT_URL pattern
provides:
  - Neon project connected as primary database
  - Schema applied to Neon (all 9 tables + indexes)
  - Local dev environment running against Neon
affects: [09-02-data-migration, 09-03-vercel-env, 10-ux-performance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prepare: false retained for Neon PgBouncer transaction pooler (same requirement as Supabase Supavisor)"
    - "DIRECT_URL used by drizzle.config.ts for schema push; DATABASE_URL used at runtime for pooled queries"
    - "sslmode=require in connection URL is sufficient — no explicit ssl option needed in postgres() call"

key-files:
  created: []
  modified:
    - src/server/db/index.ts

key-decisions:
  - "Neon PgBouncer requires prepare: false just like Supabase Supavisor — no config change needed beyond comment update"
  - "sslmode=require in the Neon URL is sufficient; avoid adding ssl: 'require' as postgres() option unless SSL errors occur"
  - "drizzle-kit push reported [✓] Changes applied — Neon accepted the schema without conflict on fresh database"

patterns-established:
  - "Neon pooled URL (with -pooler hostname) -> DATABASE_URL for runtime queries"
  - "Neon direct URL (without -pooler hostname) -> DIRECT_URL for drizzle-kit push / migrations"

# Metrics
duration: ~5min
completed: 2026-03-18
---

# Phase 9 Plan 01: Neon Setup Summary

**Neon Postgres connected as new database backend — schema pushed via drizzle-kit push, local dev confirmed clean startup with no SSL or connection errors**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-18
- **Completed:** 2026-03-18
- **Tasks:** 2 (1 human, 1 auto)
- **Files modified:** 1

## Accomplishments

- User created Neon project and added pooled + direct connection strings to .env
- Updated db/index.ts comment from Supabase Supavisor to Neon PgBouncer (config unchanged)
- Applied all 9 tables and indexes to Neon via `npx drizzle-kit push` (clean apply, no conflicts)
- Verified local dev server starts cleanly against Neon with `npm run dev` (Ready in 1910ms, no errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Neon project and provide connection strings** - user action (no commit)
2. **Task 2: Configure local env and apply schema to Neon** - `fe2fbc3` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/server/db/index.ts` - Comment updated from Supabase Supavisor to Neon PgBouncer; config unchanged

## Decisions Made

- `prepare: false` is required for Neon PgBouncer transaction mode — same requirement as Supabase Supavisor, no code change needed
- `?sslmode=require` in the Neon connection URL is sufficient for SSL — no `ssl: 'require'` option added to postgres() call
- `drizzle-kit push` uses DIRECT_URL (non-pooled) via drizzle.config.ts — same pattern established in Phase 1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — drizzle-kit push applied cleanly to the fresh Neon database. Dev server started on port 3001 (3000 was in use by another process) with no connection errors.

## User Setup Required

Task 1 was a human-action checkpoint: user created a Neon account, created a project, and added `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) to `.env`. Old Supabase URLs preserved as `supabase-DATABASE_URL` and `supabase-DIRECT_URL`.

## Next Phase Readiness

- Neon database has the full schema (empty, no data yet)
- Local dev connects to Neon successfully
- Next: Phase 09-02 — migrate existing data from Supabase to Neon (pg_dump / pg_restore or direct insert)
- No blockers

---
*Phase: 09-neon-migration*
*Completed: 2026-03-18*
