---
phase: 09-neon-migration
plan: 02
subsystem: database
tags: [neon, postgres, data-migration, seed, performance-benchmark]

# Dependency graph
requires:
  - phase: 09-01
    provides: Neon project with schema applied (all 9 tables + indexes), local dev connected
provides:
  - Neon database verified ready for user data (empty schema confirmed clean)
  - App build confirmed passing against Neon
  - "Add 100k rows" button verified wired for 1M-row performance benchmarking
affects: [09-03-vercel-env, 10-ux-performance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Option B (re-seed) chosen when pg_dump not available — Neon schema-only migration is valid fallback"
    - "bulkCreate router: 1000-row chunks with faker, accepts count up to 100k, protected by table ownership check"

key-files:
  created: []
  modified:
    - src/components/nav/ViewsPanel.tsx

key-decisions:
  - "Option B chosen: pg_dump not available (command not found) — no data migrated; Neon starts with empty schema"
  - "User will create fresh data through the browser UI; 1M-row benchmark done manually via +100k button"
  - "build failure (react/no-unescaped-entities in ViewsPanel.tsx) fixed before marking plan complete"

patterns-established:
  - "When pg_dump unavailable, empty-schema Neon + fresh UI-created data is the correct path — do not block migration on tooling"

# Metrics
duration: ~2min
completed: 2026-03-18
---

# Phase 9 Plan 02: Data Migration Summary

**Neon database confirmed empty-and-healthy after Option B path: build passes cleanly, bulkCreate +100k button verified in code, app ready for fresh data via browser UI**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-18T06:14:07Z
- **Completed:** 2026-03-18T06:16:30Z
- **Tasks:** 2 (1 human-action checkpoint, 1 auto verification)
- **Files modified:** 1

## Accomplishments

- Confirmed Option B (re-seed) was the correct path — pg_dump unavailable on user's machine
- Ran `npm run build` — caught and fixed an ESLint build error (unescaped apostrophes in ViewsPanel.tsx)
- Verified `bulkCreate` tRPC mutation is wired end-to-end: router handles up to 100k rows in 1000-row chunks, GridView calls `bulkCreate.mutate({ tableId, count: 100000 })`, GridToolbar renders the `+100k` button
- App starts clean against Neon (confirmed in 09-01); no connection blockers at runtime
- Neon schema is empty and ready for fresh user-created data

## Task Commits

1. **Task 1: Export data from Supabase and restore to Neon** — user action checkpoint (no commit)
2. **Task 2: Verify data integrity and query performance** — `23c324a` (fix: ESLint unescaped apostrophes in ViewsPanel)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/nav/ViewsPanel.tsx` — Fixed `react/no-unescaped-entities` ESLint error (apostrophes in "Add to 'My favorites'" escaped to `&apos;`)

## Decisions Made

- **Option B chosen over Option A:** `pg_dump --version` returned `command not found` on the user's machine. Since pg_dump tooling was absent, a data migration was not possible. The schema was already applied (Plan 09-01), so Neon starts with an empty but structurally correct database.
- **No data was migrated:** Neon starts with zero rows, bases, tables, columns, views. All data from the old Supabase instance remains there (preserved via `supabase-DATABASE_URL` and `supabase-DIRECT_URL` in `.env`).
- **User creates fresh data through the UI:** This is the intended path for Option B. Sign in, create a base and table, then use the `+100k` button to seed rows for performance testing.
- **1M-row benchmark is a manual task:** Click `+100k` 10 times on a table, then watch DevTools Network tab — tRPC `row.getByOffset` calls should complete in under 200ms at any row offset.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed build-breaking ESLint error in ViewsPanel.tsx**

- **Found during:** Task 2 (npm run build verification)
- **Issue:** `react/no-unescaped-entities` — two apostrophes in the string `Add to 'My favorites'` caused Next.js build to fail with exit code 1
- **Fix:** Replaced `'` characters with `&apos;` HTML entities on line 375
- **Files modified:** `src/components/nav/ViewsPanel.tsx`
- **Verification:** Ran `npm run build` again — compiled successfully, all 7 static pages generated, no errors
- **Committed in:** `23c324a`

---

**Total deviations:** 1 auto-fixed (1 bug — build failure)
**Impact on plan:** Essential fix — the build must pass before Vercel deploy in Phase 09-03. No scope creep.

## Authentication Gates

None — no CLI authentication was required during this plan.

## Issues Encountered

- `npm run build` failed initially due to unescaped apostrophes in ViewsPanel.tsx (`react/no-unescaped-entities`). Fixed inline per deviation Rule 1 and build confirmed passing.

## User Setup Required

To complete the Neon migration and run the 1M-row performance benchmark:

1. **Start dev server:** `npm run dev`
2. **Sign in** with Google OAuth at http://localhost:3001 (or whatever port Next.js uses)
3. **Create a base and table** — click "Create base" on the home page, then add a table
4. **Seed rows for benchmark:**
   - Navigate to a table's grid view
   - Click the `+100k` button in the toolbar (blue button, top right)
   - Wait for the insert to complete (~30-60 seconds per 100k)
   - Repeat 10 times to reach 1M rows
5. **Verify performance:**
   - Scroll through the grid — should feel smooth
   - Open DevTools → Network tab → filter by `getByOffset`
   - Page load calls should complete in under 200ms

## Next Phase Readiness

- Neon database has empty schema, clean build, and all app code working
- `+100k` bulkCreate button is confirmed wired and ready for seeding
- Next: Phase 09-03 — update Vercel environment variables to point to Neon (swap `DATABASE_URL` and `DIRECT_URL` in Vercel dashboard)
- No blockers

---
*Phase: 09-neon-migration*
*Completed: 2026-03-18*
