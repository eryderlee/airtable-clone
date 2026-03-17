---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [next.js, trpc, drizzle, auth.js, tailwind, supabase, vercel, postgres]

# Dependency graph
requires: []
provides:
  - T3 stack scaffolded (Next.js 15 App Router, tRPC v11, Drizzle ORM, Auth.js v5, Tailwind CSS)
  - Drizzle client with prepare: false for Supabase Supavisor compatibility
  - Auth.js v5 beta with Google provider and DrizzleAdapter
  - drizzle.config.ts using DIRECT_URL for migrations
  - Zod pinned to v3
  - .env.example with Supabase URL format
  - Build verified (SKIP_ENV_VALIDATION=1 npx next build passes)
  - Vercel project linked (eryderlee-7779s-projects/airtable-clone)
  - Production deployed at https://airtable-clone-flame.vercel.app
affects: [02-schema, 03-api, 04-table-ui, 05-editing, 06-search, 07-sharing, 08-polish]

# Tech tracking
tech-stack:
  added:
    - next@15.5.13
    - next-auth@5.0.0-beta.25
    - "@auth/drizzle-adapter@1.7.4"
    - "@trpc/server@11.x, @trpc/client@11.x, @trpc/react-query@11.x, @trpc/next@11.x"
    - drizzle-orm@0.36.4
    - drizzle-kit@0.28.1
    - postgres@3.x
    - zod@3.25.76
    - "@t3-oss/env-nextjs@0.10.1"
    - tailwindcss@3.4.x
    - superjson@2.x
    - "@tanstack/react-query@5.x"
    - "@faker-js/faker@9.x"
    - tsx@4.x
  patterns:
    - "Auth.js v5 two-file edge split (src/server/auth/config.ts + src/server/auth/index.ts + src/proxy.ts) for CVE-2025-29927"
    - "Drizzle prepare: false for Supabase transaction pooler (port 6543)"
    - "tRPC v11 with superjson transformer and RSC hydration helpers"
    - "SKIP_ENV_VALIDATION=1 for build-time env bypass"
    - "Vercel env vars set via CLI (vercel env add) for all 5 production secrets"

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - drizzle.config.ts
    - src/env.js
    - src/proxy.ts
    - src/server/db/index.ts
    - src/server/db/schema.ts
    - src/server/auth/config.ts
    - src/server/auth/index.ts
    - src/server/api/trpc.ts
    - src/server/api/root.ts
    - src/server/api/routers/post.ts
    - src/trpc/server.ts
    - src/trpc/react.tsx
    - src/trpc/query-client.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/api/auth/[...nextauth]/route.ts
    - src/app/api/trpc/[trpc]/route.ts
    - src/styles/globals.css
    - tailwind.config.ts
    - postcss.config.js
    - .eslintrc.cjs
    - .gitignore
    - .env.example
    - .env
  modified: []

key-decisions:
  - "Pin zod@3 (not v4) - Zod v4 + tRPC v11 compatibility unconfirmed"
  - "Auth.js v5 beta.25 (not v4) - CVE-2025-29927 edge split required"
  - "Drizzle prepare: false required for Supabase Supavisor transaction pooler"
  - "drizzle.config.ts uses DIRECT_URL with DATABASE_URL fallback for migrations"
  - "Manual T3 scaffold (create-t3-app TTY error in non-interactive env)"
  - "Vercel production URL: https://airtable-clone-flame.vercel.app"

patterns-established:
  - "Auth.js v5 two-file split: config.ts (Node.js/DB) + index.ts (exports) + proxy.ts (edge)"
  - "~ path alias maps to ./src/* for all imports"
  - "SKIP_ENV_VALIDATION=1 environment variable for CI/Docker builds"
  - "All Vercel env vars added via CLI (not dashboard) for repeatability"

# Metrics
duration: ~60min (including checkpoint wait)
completed: 2026-03-17
---

# Phase 1 Plan 01: Foundation — T3 Stack Scaffold and Vercel Deploy Summary

**Next.js 15 App Router with tRPC v11, Drizzle ORM (prepare:false), Auth.js v5 beta (Google OAuth), Tailwind CSS — build verified and deployed live at https://airtable-clone-flame.vercel.app**

## Performance

- **Duration:** ~60 min (including checkpoint pauses for env var setup)
- **Started:** 2026-03-17T01:06:51Z
- **Completed:** 2026-03-17T07:16:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 27 created, .gitignore modified

## Accomplishments
- Full T3 stack scaffolded manually (create-t3-app TTY error bypassed by manual file creation)
- Drizzle client configured with `prepare: false` for Supabase Supavisor compatibility
- Auth.js v5 beta with Google provider, DrizzleAdapter, and CVE-2025-29927 edge split pattern
- Environment variables configured on Vercel production (DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET)
- App deployed to production at https://airtable-clone-flame.vercel.app — HTTP 200 confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold T3 stack and configure Supabase connection** - `4dceeb4` (feat)
2. **Task 2: Configure environment variables (checkpoint)** - `eb52f9e` (docs)
3. **Task 3: Deploy to Vercel and confirm public URL** - `67ae18e` (chore)

**Plan metadata:** (this commit) (docs: complete scaffold and deploy plan)

## Files Created/Modified
- `package.json` - All T3 dependencies at correct versions
- `src/server/db/index.ts` - Drizzle client with prepare: false
- `drizzle.config.ts` - Uses DIRECT_URL for migrations, fallback to DATABASE_URL
- `src/env.js` - T3 env validation including optional DIRECT_URL
- `src/proxy.ts` - Auth.js v5 edge-compatible middleware (CVE-2025-29927 pattern)
- `src/server/auth/config.ts` - Auth config with Google provider + DrizzleAdapter
- `src/server/auth/index.ts` - Auth exports (handlers, auth, signIn, signOut)
- `src/server/api/trpc.ts` - tRPC v11 context, procedures, middleware
- `src/trpc/server.ts` - RSC hydration helpers
- `src/trpc/react.tsx` - Client-side tRPC provider
- `.env.example` - Template with Supabase URL format (no secrets)
- `.env` - Real credentials (gitignored)
- `.gitignore` - Updated with .vercel entry (by vercel link)

## Decisions Made
- **Manual scaffold**: create-t3-app fails with `ERR_TTY_INIT_FAILED` in non-interactive terminal. Scaffolded manually — equivalent output.
- **Auth.js v5 beta.25**: Per project decision, using v5 not v4. Two-file edge split implemented from day one.
- **Zod v3**: Pinned per project decision (v4 + tRPC v11 compatibility unconfirmed).
- **prepare: false**: Required for Supabase transaction pooler (port 6543) — Supavisor does not support prepared statements.
- **Vercel project name**: `airtable-clone` under `eryderlee-7779s-projects` scope.
- **Production URL**: https://airtable-clone-flame.vercel.app (canonical production alias assigned by Vercel).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing autoprefixer package**
- **Found during:** Task 1 (build verification)
- **Issue:** `npm run build` failed with "Cannot find module 'autoprefixer'"
- **Fix:** Ran `npm install --save-dev autoprefixer`
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passes after install
- **Committed in:** 4dceeb4 (Task 1 commit)

**2. [Rule 3 - Blocking] ESLint rule option typo in .eslintrc.cjs**
- **Found during:** Task 1 (build verification)
- **Issue:** `@typescript-eslint/consistent-type-imports` used `"type-import"` (invalid) instead of `"type-imports"`
- **Fix:** Updated rule value to `"type-imports"`
- **Files modified:** .eslintrc.cjs
- **Verification:** ESLint no longer errors on this rule
- **Committed in:** 4dceeb4 (Task 1 commit)

**3. [Rule 3 - Blocking] create-t3-app TTY initialization failure**
- **Found during:** Task 1 (scaffold step)
- **Issue:** `npm create t3-app@latest` fails with `ERR_TTY_INIT_FAILED: uv_tty_init returned EBADF` in non-interactive terminal
- **Fix:** Manually created all scaffold files (equivalent output to create-t3-app)
- **Files modified:** All project files (27 created)
- **Verification:** Build passes, all dependencies correct
- **Committed in:** 4dceeb4 (Task 1 commit)

**4. [Rule 3 - Blocking] vercel link required explicit --project flag**
- **Found during:** Task 3 (Vercel link step)
- **Issue:** `vercel link --yes` failed with "Project names can be up to 100 characters long and must be lowercase" — working directory path contained uppercase letters that Vercel tried to use as project name
- **Fix:** Used `vercel link --project airtable-clone --yes` to specify an explicit valid name
- **Files modified:** .gitignore (vercel added .vercel entry), .vercel/ (gitignored)
- **Verification:** Project linked successfully as `eryderlee-7779s-projects/airtable-clone`
- **Committed in:** 67ae18e (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** All auto-fixes necessary to unblock execution. No scope creep.

## Authentication Gates

During execution, one authentication requirement was handled:

1. **Task 3: Vercel CLI required authentication**
   - Previous agent attempted `vercel --prod --yes`, received auth error
   - Paused for `npx vercel login` (user authenticated via browser)
   - Resumed — verified with `npx vercel whoami` returning `eryderlee-7779`
   - Deployed successfully

## Next Phase Readiness
- T3 scaffold complete, build verified
- App live at https://airtable-clone-flame.vercel.app (HTTP 200)
- All 5 production env vars set on Vercel
- Ready for Phase 1 Plan 02: schema definition and Drizzle migrations against Supabase
- Note: Google OAuth redirect URI for production domain (`https://airtable-clone-flame.vercel.app/api/auth/callback/google`) should be added to Google Console OAuth credentials before testing auth in production

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
