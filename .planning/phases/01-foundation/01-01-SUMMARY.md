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
  - Vercel deployment (pending - awaiting env var configuration at checkpoint)
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
  modified: []

key-decisions:
  - "Pin zod@3 (not v4) - Zod v4 + tRPC v11 compatibility unconfirmed"
  - "Auth.js v5 beta.25 (not v4) - CVE-2025-29927 edge split required"
  - "Drizzle prepare: false required for Supabase Supavisor transaction pooler"
  - "drizzle.config.ts uses DIRECT_URL with DATABASE_URL fallback for migrations"
  - "Manual T3 scaffold (create-t3-app TTY error in non-interactive env)"

patterns-established:
  - "Auth.js v5 two-file split: config.ts (Node.js/DB) + index.ts (exports) + proxy.ts (edge)"
  - "~ path alias maps to ./src/* for all imports"
  - "SKIP_ENV_VALIDATION=1 environment variable for CI/Docker builds"

# Metrics
duration: ~30min
completed: 2026-03-17
---

# Phase 1 Plan 01: Foundation — T3 Stack Scaffold Summary

**Next.js 15 App Router with tRPC v11, Drizzle ORM (prepare: false), Auth.js v5 beta (Google OAuth), and Tailwind CSS — build verified, awaiting Supabase env vars for deployment**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-17T01:06:51Z
- **Completed:** 2026-03-17T01:36:00Z (partial — paused at checkpoint)
- **Tasks:** 1/3 complete (paused at Task 2: env var checkpoint)
- **Files modified:** 27 created

## Accomplishments
- Full T3 stack scaffolded manually (create-t3-app TTY error bypassed by manual file creation)
- Drizzle client configured with `prepare: false` for Supabase Supavisor compatibility
- Auth.js v5 beta with Google provider, DrizzleAdapter, and CVE-2025-29927 edge split pattern
- `SKIP_ENV_VALIDATION=1 npx next build` passes successfully
- Zod pinned to v3.25.76 (not v4)

## Task Commits

1. **Task 1: Scaffold T3 stack and configure Supabase connection** - `4dceeb4` (feat)

_Tasks 2 (checkpoint) and 3 (Vercel deploy) pending._

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
- `.env` - Placeholder values (user must fill in real values)

## Decisions Made
- **Manual scaffold**: create-t3-app fails with `ERR_TTY_INIT_FAILED` in non-interactive terminal. Scaffolded manually — equivalent output.
- **Auth.js v5 beta.25**: Per project decision, using v5 not v4. Two-file edge split implemented from day one.
- **Zod v3**: Pinned per project decision (v4 + tRPC v11 compatibility unconfirmed).
- **prepare: false**: Required for Supabase transaction pooler (port 6543) — Supavisor does not support prepared statements.
- **Placeholder .env format**: Using URL-parseable placeholders so postgres client doesn't crash during build; final values filled at checkpoint.

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

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary to unblock execution. No scope creep.

## User Setup Required

**External services require manual configuration before Task 3 (Vercel deployment) can proceed.**

### Supabase
1. Create a Supabase project at https://supabase.com/dashboard
2. Get **DATABASE_URL** (Transaction pooler, port 6543):
   - Dashboard → Project Settings → Database → Connection string → Transaction (pooler)
3. Get **DIRECT_URL** (Direct connection, port 5432):
   - Dashboard → Project Settings → Database → Connection string → Direct

### Google OAuth
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google` (add after first deploy)
4. Copy **AUTH_GOOGLE_ID** and **AUTH_GOOGLE_SECRET**

### AUTH_SECRET
Generate: `openssl rand -base64 32`

### .env file
Fill in `E:/websites/airtable clone/.env`:
```
DATABASE_URL=postgresql://postgres.YOURREF:YOURPASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.YOURREF:YOURPASSWORD@aws-0-REGION.supabase.com:5432/postgres
AUTH_SECRET=<generated secret>
AUTH_GOOGLE_ID=<from Google Console>
AUTH_GOOGLE_SECRET=<from Google Console>
```

Then run `npm run dev` and confirm the app starts at http://localhost:3000.

## Next Phase Readiness
- T3 scaffold complete, build verified
- Awaiting env var configuration (Supabase + Google OAuth) before dev server can run
- Awaiting Vercel deployment (Task 3) before phase 01-01 is fully complete
- Once deployed, Phase 1 Plan 02 (schema + migrations) can begin

---
*Phase: 01-foundation*
*Completed: 2026-03-17 (partial — paused at checkpoint)*
