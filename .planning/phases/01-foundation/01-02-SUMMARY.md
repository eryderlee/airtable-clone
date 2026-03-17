---
phase: 01-foundation
plan: 02
subsystem: database
tags: [drizzle, supabase, postgres, authjs, jwt, google-oauth, trpc, drizzle-adapter]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: T3 scaffold with Drizzle config, env vars, Vercel project
provides:
  - 9-table Drizzle schema with keyset cursor pagination index on rows (tableId, rowOrder, id)
  - Auth.js v5 two-file edge split with Google OAuth, JWT strategy, DrizzleAdapter
  - protectedProcedure pattern in tRPC enforcing independent session verification
  - Schema migrated to Supabase (applied manually via SQL Editor)
affects: [02-base-crud, 03-table-crud, 04-virtual-table, 05-editing, 06-filtering-sorting, 07-views, 08-polish]

# Tech tracking
tech-stack:
  added: [@auth/drizzle-adapter, next-auth v5]
  patterns:
    - Auth.js two-file edge split (auth.config.ts for edge/proxy, auth.ts for full Node.js instance)
    - JWT session strategy with DrizzleAdapter (adapter stores OAuth account data, JWT carries session)
    - protectedProcedure calls auth() independently (CVE-2025-29927 defense)
    - JSONB cells column on rows table for flexible per-row key-value data
    - Composite keyset cursor index on (tableId, rowOrder, id) for O(log n) pagination

key-files:
  created:
    - src/server/db/schema.ts
    - src/server/auth.config.ts
    - src/server/auth.ts
    - src/app/sign-in/page.tsx
    - drizzle/0000_flowery_owl.sql
  modified:
    - src/proxy.ts
    - src/server/api/trpc.ts
    - src/server/api/root.ts
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/env.js
    - vercel.json

key-decisions:
  - "Drizzle migration applied via Supabase SQL Editor (not drizzle-kit push) - Supabase direct host is IPv6-only; Vercel build nodes lack IPv6 egress"
  - "vercel.json buildCommand restored to standard next build (no db:migrate step)"
  - "JWT session strategy with DrizzleAdapter: adapter persists OAuth account links, JWT carries session state - no session table lookups on each request"
  - "rows.cells typed as JSONB Record<string, string | number | null> with default {} - enables flexible column schema without EAV overhead"
  - "All 9 tables defined including 4 Auth.js adapter tables (users, accounts, sessions, verificationTokens)"

patterns-established:
  - "Two-file auth split: src/server/auth.config.ts (edge-safe) + src/server/auth.ts (full Node.js) - proxy.ts imports ONLY auth.config"
  - "protectedProcedure: throw TRPCError UNAUTHORIZED before any resolver runs - never trust proxy auth state"
  - "All foreign keys use cascade deletes - deleting a base cascades to tables -> columns -> rows -> views"
  - "Application table PKs use crypto.randomUUID() via $defaultFn - consistent ID generation without sequences"

# Metrics
duration: ~10min
completed: 2026-03-17
---

# Phase 1 Plan 02: Schema and Auth Summary

**9-table Drizzle schema with composite keyset cursor index, Auth.js v5 Google OAuth via two-file edge split, JWT strategy with DrizzleAdapter, and protectedProcedure pattern in tRPC**

## Performance

- **Duration:** ~10 min (code tasks executed in prior session; this session = verification + docs)
- **Started:** 2026-03-17T12:57:51Z (Task 1 commit)
- **Completed:** 2026-03-17T13:05:54Z (final task commit)
- **Tasks:** 2 + 1 manual migration
- **Files modified:** 13

## Accomplishments

- Complete Drizzle schema with 9 tables (4 Auth.js adapter tables + 5 application tables) and composite keyset cursor pagination index on rows (tableId, rowOrder, id)
- Auth.js v5 Google OAuth wired with two-file edge split: auth.config.ts for edge-safe proxy, auth.ts for full DrizzleAdapter + JWT instance
- protectedProcedure independently calls auth() on every tRPC request (CVE-2025-29927 defense)
- Schema applied to Supabase via SQL Editor (direct migration path confirmed after Vercel IPv6 constraint discovered)
- npm run build passes cleanly with all routes compiled

## Task Commits

Each task was committed atomically:

1. **Task 1: Define Drizzle schema with all 9 tables and indexes** - `2ac1ee9` (feat)
2. **Task 2: Wire Auth.js v5 with Google OAuth** - `f0dd027` (feat)
3. **Chore: Restore Vercel buildCommand to standard next build** - `ecc539a` (chore)

_Migration applied manually via Supabase SQL Editor (not via drizzle-kit push - see Deviations)._

## Files Created/Modified

- `src/server/db/schema.ts` - All 9 table definitions with relations, indexes, cascade deletes
- `src/server/auth.config.ts` - Edge-safe Auth.js config with Google provider; no DB imports
- `src/server/auth.ts` - Full Auth.js instance: DrizzleAdapter, JWT strategy, session/jwt callbacks
- `src/proxy.ts` - Middleware importing auth.config only (never auth.ts) per CVE-2025-29927 pattern
- `src/server/api/trpc.ts` - tRPC context with await auth() + protectedProcedure throwing UNAUTHORIZED
- `src/server/api/root.ts` - AppRouter merge point (empty routers for now)
- `src/app/sign-in/page.tsx` - Sign-in page with Google OAuth server action
- `src/app/page.tsx` - Dashboard placeholder showing user name + sign-out server action
- `src/app/layout.tsx` - Updated layout
- `src/env.js` - AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET validated; Discord vars removed
- `drizzle/0000_flowery_owl.sql` - Generated migration SQL (applied manually)
- `vercel.json` - buildCommand restored to standard `next build`

## Decisions Made

- **Manual migration approach:** drizzle-kit push connects via DIRECT_URL (Supabase direct host). Supabase direct hosts are IPv6-only. Vercel build nodes do not have IPv6 egress, so the migration step was removed from vercel.json. Schema was applied via Supabase SQL Editor by copy-pasting `drizzle/0000_flowery_owl.sql`. Future migrations will follow the same manual path or use Supabase CLI locally.
- **JWT + DrizzleAdapter combination:** JWT strategy avoids a database roundtrip on every request. DrizzleAdapter is still required to persist OAuth account links (provider + providerAccountId). The sessions table exists in the schema as required by the adapter even though sessions are not stored there at runtime.
- **JSONB cells column:** `rows.cells` is `jsonb.$type<Record<string, string | number | null>>()` with default `{}`. This matches the JSONB hybrid schema decision made at project init - write amplification accepted for v1 single-user scenario.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vercel buildCommand removed after IPv6 migration failure**
- **Found during:** Task 1 (after schema commit, during migration verification)
- **Issue:** `vercel.json` was updated to run `npm run db:migrate` before `next build`. Supabase's direct connection host is IPv6-only; Vercel build machines lack IPv6, so the migration command failed during Vercel builds.
- **Fix:** Restored `vercel.json` buildCommand to `next build`. Migration applied via Supabase SQL Editor instead.
- **Files modified:** `vercel.json`
- **Verification:** Build passes cleanly; schema confirmed live in Supabase
- **Committed in:** `ecc539a`

---

**Total deviations:** 1 auto-fixed (1 blocking infrastructure constraint)
**Impact on plan:** Migration still succeeded — just via a different path (SQL Editor vs drizzle-kit push). No schema changes required. Scope unchanged.

## Issues Encountered

- Supabase direct host IPv6-only constraint: `drizzle-kit push` works from local dev (developer machine has IPv6) but not from Vercel build nodes. Documented in STATE.md. Future schema changes should be applied via local `npx drizzle-kit push` or Supabase SQL Editor.

## User Setup Required

None - Google OAuth credentials and Supabase connection strings were already configured in Phase 01-01. The AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET environment variables must be set in the Vercel project dashboard before testing Google sign-in in production (already noted as pending todo from 01-01).

## Next Phase Readiness

- Database schema is live in Supabase with all 9 tables and indexes
- Auth.js Google OAuth works end-to-end (sign in, session persist via JWT, sign out)
- protectedProcedure pattern established — all Phase 2+ tRPC routers use it
- Ready for Phase 01-03: base and table CRUD tRPC routers

**Blockers/concerns carried forward:**
- Google OAuth production redirect URI must be added to Google Console before testing auth in production (https://airtable-clone-flame.vercel.app/api/auth/callback/google)
- Future Drizzle migrations must be applied via local `npx drizzle-kit push` or Supabase SQL Editor (not via Vercel build step)

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
