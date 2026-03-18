# Phase 9: Neon Migration - Research

**Researched:** 2026-03-18
**Domain:** PostgreSQL database migration (Supabase → Neon) + Drizzle ORM + Vercel
**Confidence:** HIGH

## Summary

Phase 9 migrates the app's PostgreSQL database from Supabase to Neon. The primary motivation is resolving the IPv6-only constraint on Supabase's direct host: Vercel build nodes lack IPv6 egress, forcing Drizzle migrations to be run locally or via the Supabase SQL Editor. Neon's direct connection supports IPv4 natively, eliminating this workaround entirely.

The migration involves three distinct operations: (1) exporting existing data from Supabase via `pg_dump`, (2) applying the schema to a new Neon database via `drizzle-kit push`, and (3) restoring data via `pg_restore`. The app's existing `postgres` (postgres.js) driver requires a connection string update but no driver change — Neon supports postgres.js over direct TCP with `sslmode=require`. Neon's PgBouncer pooler uses `pool_mode=transaction` (same as Supabase Supavisor), so `prepare: false` remains required for the pooled connection.

The 1M-row seed is expected to occupy roughly 100–200 MB of storage, which fits within Neon's free tier limit of 0.5 GB per project. Neon free tier scales to zero after 5 minutes of inactivity (non-configurable on free plan), with cold-start reactivation in "a few hundred milliseconds." This is the only operational behavior change from Supabase that requires documentation.

**Primary recommendation:** Use pg_dump (via Supabase Supavisor session mode, port 5432) to export data locally, apply schema to Neon with `drizzle-kit push` using Neon's direct (non-pooled) connection URL, then restore with `pg_restore` using Neon's direct URL. Update Vercel env vars: `DATABASE_URL` → Neon pooled URL (with `-pooler` in hostname + `?sslmode=require`), `DIRECT_URL` → Neon direct URL (same hostname without `-pooler` + `?sslmode=require`).

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `pg_dump` / `pg_restore` | PostgreSQL 15+ client tools | Export from Supabase, import to Neon | Official Neon recommendation for Supabase migrations; binary format (-Fc) is compressed and resumable |
| `drizzle-kit push` | ^0.28.1 (already installed) | Apply schema to Neon without migration files | Already used in project; Neon confirms direct URL required |
| `postgres` (postgres.js) | ^3.4.5 (already installed) | Runtime DB connection | No driver change needed; Neon supports postgres.js over TCP |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Neon Console | Web UI | Create project, copy connection strings | One-time setup |
| Vercel Dashboard | Web UI | Update environment variables | After Neon project created |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres.js (keep) | @neondatabase/serverless | Neon serverless HTTP driver is optimal for edge/serverless, but requires driver swap. The project is already on Vercel Fluid compute where TCP is recommended. Keep postgres.js. |
| pg_dump/restore | Logical replication | Zero-downtime migration, but adds complexity. Overkill for a dev project with 1M seed rows that can be re-seeded if needed. |
| pg_dump with direct Supabase host | Session mode pooler (port 5432) | Direct host is IPv6-only and inaccessible from Windows machines without IPv6. Use Supavisor session mode. |

**No new npm packages required.** The existing `postgres` driver and `drizzle-kit` are sufficient.

## Architecture Patterns

### Recommended Project Structure

No structural changes to src/. Changes are purely infrastructure (env vars, connection strings):

```
.env (local)                         # Updated DATABASE_URL + DIRECT_URL
drizzle.config.ts                    # No change needed (uses DIRECT_URL ?? DATABASE_URL)
src/server/db/index.ts               # One-line change: add SSL to postgres() options
```

### Pattern 1: Dual Connection Strings (Pooled + Direct)

**What:** Neon provides two connection string variants for every project:
- **Pooled** (`-pooler` in hostname, e.g., `ep-xxx-pooler.region.aws.neon.tech`): Routes through PgBouncer in transaction mode. Use for app runtime (DATABASE_URL).
- **Direct** (hostname without `-pooler`, e.g., `ep-xxx.region.aws.neon.tech`): Direct TCP to Postgres. Use for drizzle-kit migrations (DIRECT_URL).

**When to use:** Always set both. The existing `drizzle.config.ts` already prefers `DIRECT_URL` over `DATABASE_URL` — this pattern carries over unchanged from Supabase.

**Example — connection strings from Neon Console:**
```
# Pooled (for DATABASE_URL):
postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require&channel_binding=require

# Direct (for DIRECT_URL / drizzle-kit push):
postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require&channel_binding=require
```

### Pattern 2: Postgres.js SSL Configuration for Neon

**What:** Neon requires SSL for all connections. Postgres.js reads `sslmode=require` from the connection string URL automatically. The `prepare: false` option remains required when using the pooled URL (PgBouncer transaction mode does not support SQL-level prepared statements).

**Example — src/server/db/index.ts (minimal change):**
```typescript
// Source: Neon Docs (https://neon.com/docs/guides/node) + existing project pattern
const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,        // Required: Neon PgBouncer is transaction mode (same as Supabase Supavisor)
    connect_timeout: 10,
    ssl: 'require',        // ADD THIS: Neon requires SSL; also include ?sslmode=require in URL
  });
```

Note: If `?sslmode=require` is appended to DATABASE_URL (as Neon provides by default), postgres.js may handle SSL automatically from the URL. Adding `ssl: 'require'` explicitly is belt-and-suspenders.

### Pattern 3: pg_dump from Supabase via Session Mode

**What:** Supabase's direct host (`*.supabase.com:5432`) is IPv6-only. Windows machines (and any IPv4-only host) cannot connect to it. Supavisor session mode (`*.pooler.supabase.com:5432`) supports IPv4 and is safe for `pg_dump`.

**When to use:** Always use the Supabase session mode pooler when running `pg_dump` from a local machine.

**Example — export from Supabase:**
```bash
# Source: Neon Docs (https://neon.com/docs/import/migrate-from-supabase)
# Use Supavisor SESSION mode (port 5432) NOT transaction mode (port 6543) for pg_dump
# Get session mode URL from Supabase Dashboard > Project Settings > Database > Connection Pooling > Mode: Session
pg_dump -Fc -v \
  -d "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  --schema=public \
  --no-acl \
  -f supabase_dump.bak
```

**Example — restore to Neon:**
```bash
# Source: Neon Docs (https://neon.com/docs/import/migrate-from-postgres)
# Use Neon DIRECT (non-pooled) URL — avoid pooled connections with pg_restore
pg_restore \
  -d "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require" \
  -v \
  --no-owner \
  --no-acl \
  supabase_dump.bak
```

### Pattern 4: drizzle-kit push After Restore

**What:** After `pg_restore`, the schema is already present. `drizzle-kit push` is idempotent — it will confirm the schema matches and make no changes. Running it explicitly validates the Neon schema is healthy.

**When to use:** Run once after pg_restore to verify. Also the fallback if pg_dump/restore is skipped and a fresh schema + re-seed is chosen instead.

```bash
# drizzle.config.ts already uses DIRECT_URL ?? DATABASE_URL
# Set DIRECT_URL to Neon direct connection string before running
npx drizzle-kit push
```

### Anti-Patterns to Avoid

- **Using the pooled URL (`-pooler`) for drizzle-kit push or pg_restore:** Neon official docs explicitly state direct URL is required for schema migrations. PgBouncer transaction mode breaks DDL operations.
- **Using Supabase transaction mode (port 6543) for pg_dump:** Transaction mode disables prepared statements and session-level features; pg_dump requires a persistent session connection.
- **Using Supabase direct host for pg_dump from a Windows/IPv4 machine:** The direct host is IPv6-only. It will time out silently.
- **Skipping `prepare: false` on the pooled connection:** Neon PgBouncer is `pool_mode=transaction`, same as Supabase Supavisor. The behavior is identical; `prepare: false` is still required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema creation on Neon | Manual CREATE TABLE SQL | `drizzle-kit push` | Already in project, idempotent, type-safe |
| Data export from Supabase | Custom SELECT + CSV | `pg_dump -Fc` | Handles sequences, indexes, constraints, JSONB, foreign keys in correct order |
| Data import to Neon | Custom INSERT loop | `pg_restore` | Handles dependencies, bulk loading, error recovery |
| Connection string validation | Custom URL parsing | `t3-oss/env-nextjs` (already in project) | Schema validation already set up in env.js |

**Key insight:** This is a plumbing migration, not a code change. The entire migration is CLI commands + env var updates.

## Common Pitfalls

### Pitfall 1: Supabase IPv6-Only Direct Host Blocks pg_dump

**What goes wrong:** `pg_dump` hangs or times out with `could not translate host name to address` when using the Supabase direct connection string on an IPv4-only machine (e.g., Windows without IPv6 configured).
**Why it happens:** Supabase direct hosts (`db.[ref].supabase.co:5432`) resolve to IPv6 addresses only.
**How to avoid:** Use Supabase Supavisor **session mode** (port 5432 on `*.pooler.supabase.com`) instead. This is IPv4-compatible and pg_dump-safe.
**Warning signs:** Connection hangs > 30 seconds, or `Name or service not known` error.

### Pitfall 2: Using Pooled URL for drizzle-kit push

**What goes wrong:** `drizzle-kit push` fails with cryptic errors when pointed at the Neon pooled URL (with `-pooler`).
**Why it happens:** PgBouncer transaction mode does not support DDL commands that require persistent session state (e.g., `BEGIN` + schema introspection + `ALTER TABLE`).
**How to avoid:** Always use the Neon **direct** (non-pooled) connection string for `drizzle-kit push`. Set `DIRECT_URL` in `.env` to the direct URL.
**Warning signs:** Error mentioning "prepared statement" or connection reset during push.

### Pitfall 3: Missing `?sslmode=require` in Connection String

**What goes wrong:** `drizzle-kit push` or the app fails with `Error: connection is insecure (try using sslmode=require)`.
**Why it happens:** Neon requires SSL for all connections; postgres.js does not add SSL automatically without the `ssl` option or `sslmode=require` in the URL.
**How to avoid:** Always append `?sslmode=require` to Neon connection strings. The Neon Console copies this by default; don't strip it.
**Warning signs:** `Error: connection is insecure` in console.

### Pitfall 4: 1M Rows Re-seed May Be Required

**What goes wrong:** pg_dump/restore of 1M rows fails or is extremely slow over the local network.
**Why it happens:** The dump file for 1M rows with JSONB cells may be 100–200 MB. On slow connections, this takes time. If it fails mid-way, pg_restore leaves a partial state.
**How to avoid:** Test with a small table first. If the full restore fails, wipe the Neon schema and re-run `drizzle-kit push` + re-seed script (the existing bulk seed endpoint) instead.
**Warning signs:** pg_restore exits with error mid-way; table row counts don't match.

### Pitfall 5: Neon Free Tier Storage Limit (0.5 GB/project)

**What goes wrong:** Schema creation succeeds, but seeding 1M rows fails with a storage quota error.
**Why it happens:** Neon free tier is limited to 0.5 GB per project. 1M rows with simple JSONB cells is estimated at 100–200 MB — this should fit, but depends on actual data size.
**How to avoid:** Estimate storage before seeding. If close to limit, reduce seed to 500K rows or upgrade to Launch plan ($0.35/GB-month).
**Warning signs:** `ERROR: could not extend file` or storage warning in Neon Console.

### Pitfall 6: Cold Start Latency on Free Tier

**What goes wrong:** After 5 minutes of inactivity, the first request takes 500–2000ms instead of the normal ~180ms.
**Why it happens:** Neon free tier scales to zero; the compute must restart on the first request. This cannot be disabled on the free plan.
**How to avoid:** Document this expected behavior. This is not a bug. For production use, consider upgrading to disable scale-to-zero, or implement a keep-alive ping if uptime is critical.
**Warning signs:** Intermittent first-request slowness; not reproducible on repeated requests.

## Code Examples

### Updated db/index.ts for Neon

```typescript
// Source: Neon Docs (https://neon.com/docs/guides/node) + project pattern
// Changes from Supabase version: add ssl: 'require'
// prepare: false is still required (Neon PgBouncer = transaction mode, same as Supabase Supavisor)
const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 10,
    ssl: 'require',
  });
```

### Neon drizzle.config.ts (no change required)

```typescript
// Source: existing project file
// DIRECT_URL ?? DATABASE_URL already handles pooled vs direct routing
// Just update the env vars — no code change needed
export default defineConfig({
  out: './drizzle',
  schema: './src/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
```

### Vercel Environment Variables to Set

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require
```

All other env vars (AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET) remain unchanged.

### Full Migration Command Sequence

```bash
# Step 1: Export from Supabase (use SESSION mode pooler for IPv4 compatibility)
pg_dump -Fc -v \
  -d "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  --schema=public \
  --no-acl \
  -f supabase_dump.bak

# Step 2: Create Neon project via Console (web UI)
# Copy direct connection string from Console

# Step 3: Apply schema via drizzle-kit push
# (Set DIRECT_URL in .env to Neon direct connection string)
npx drizzle-kit push

# Step 4: Restore data
pg_restore \
  -d "postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require" \
  -v --no-owner --no-acl \
  supabase_dump.bak

# Step 5: Verify row counts match
# (via Neon Console SQL editor or local psql)

# Step 6: Update Vercel env vars (Dashboard > Project > Settings > Environment Variables)
# DATABASE_URL = Neon pooled URL
# DIRECT_URL = Neon direct URL

# Step 7: Redeploy Vercel
# (Or manually trigger redeploy from Vercel Dashboard)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IPv6-only Supabase direct host forces local-only migrations | Neon IPv4-compatible direct host — drizzle-kit push works from any machine | Phase 9 | Removes the IPv6 workaround documented in decision 01-02 |
| Supabase Supavisor transaction pooler (port 6543) | Neon PgBouncer transaction pooler (`-pooler` hostname) | Phase 9 | Same behavior: `prepare: false` still required |
| DIRECT_URL = Supabase direct (IPv6-only) | DIRECT_URL = Neon direct (IPv4) | Phase 9 | drizzle-kit push now works from Vercel build nodes in principle |
| Neon free tier: 50 CU-hours, $1.75/GB-month | Post-Databricks acquisition (May 2025): 100 CU-hours, $0.35/GB-month | May 2025 | Better free tier economics |

**Deprecated/outdated:**
- Supabase DIRECT_URL: Was IPv6-only and unusable from Vercel build nodes. Replaced by Neon direct URL (IPv4).
- `prepare: false` as a Supabase-specific workaround: Still required with Neon (same PgBouncer transaction mode) — it is not Supabase-specific.

## Open Questions

1. **Whether pg_dump via Supabase session mode works on this specific Windows machine**
   - What we know: Supavisor session mode (port 5432) is documented as IPv4-compatible for pg_dump
   - What's unclear: The specific Windows machine's network config may block outbound port 5432 to `*.pooler.supabase.com`
   - Recommendation: Test with `pg_dump --schema-only` first (fast, no data). If it fails, use the Supabase Dashboard → SQL Editor to run `pg_dump`-equivalent SQL exports, or re-seed from scratch on Neon.

2. **Whether 1M rows can be re-seeded on Neon free tier within storage limits**
   - What we know: 1M JSONB rows estimated at 100–200 MB; Neon free tier is 0.5 GB per project
   - What's unclear: Actual storage consumption depends on the cells data (2 text + 1 number columns per row)
   - Recommendation: Check Neon Console storage usage after seeding 10K rows, then extrapolate. If on track to exceed 0.5 GB, reduce to 500K rows or upgrade.

3. **Whether `ssl: 'require'` is redundant when `?sslmode=require` is in the connection URL**
   - What we know: postgres.js reads sslmode from the URL query string; Neon official examples only show `?sslmode=require` in URL
   - What's unclear: Whether explicit `ssl: 'require'` in postgres() options and `?sslmode=require` in URL conflict
   - Recommendation: Use `?sslmode=require&channel_binding=require` in the URL (as Neon Console provides). Omit `ssl: 'require'` in postgres() options. If SSL errors occur, add `ssl: 'require'` as a fallback.

4. **Whether the 1M-row seed endpoint still works after migration**
   - What we know: Seed uses `bulkCreate` via transaction pooler (DATABASE_URL port 6543 on Supabase)
   - What's unclear: No code change is needed since the pooler behavior is the same on Neon
   - Recommendation: Verify by running a small 1K-row seed after migration completes.

## Sources

### Primary (HIGH confidence)
- `https://neon.com/docs/import/migrate-from-supabase` — Migration steps from Supabase, pg_dump command
- `https://neon.com/docs/import/migrate-from-postgres` — pg_dump/pg_restore pattern, "avoid pooled URL" for restore
- `https://neon.com/docs/connect/connection-pooling` — PgBouncer transaction mode, `-pooler` hostname format, SQL-level PREPARE not supported
- `https://neon.com/docs/introduction/scale-to-zero` — 5-minute idle timeout, "few hundred milliseconds" cold start, free tier non-configurable
- `https://neon.com/docs/introduction/plans` — Free tier: 0.5 GB/project, 100 CU-hours/month
- `https://neon.com/docs/connect/choose-connection` — Direct URL required for drizzle-kit migrations
- `https://neon.com/docs/guides/drizzle-migrations` — Direct (non-pooled) URL required for migrations
- `https://neon.com/docs/guides/node` — postgres.js SSL configuration, `ssl: 'require'`, SNI

### Secondary (MEDIUM confidence)
- `https://neon.com/docs/guides/vercel-connection-methods` — Vercel Fluid compute recommendation: TCP + standard postgres driver (not serverless HTTP)
- `https://supabase.com/docs/guides/database/connecting-to-postgres` — Session mode (port 5432) is IPv4 compatible; confirmed Supabase session mode URL format
- WebSearch result confirming Neon accepts IPv4 connections at no extra charge (neon.com/docs/changelog/2024-02-09 mentioned in context)

### Tertiary (LOW confidence)
- Storage size estimate (100–200 MB for 1M JSONB rows) — based on multiple blog posts, not official benchmarks for this specific schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified with official Neon docs; no new packages needed
- Migration procedure: HIGH — pg_dump/restore pattern confirmed by Neon official migration guide
- Architecture patterns: HIGH — Connection string format, pooled vs direct, prepare:false all verified
- Pitfalls: HIGH (IPv6, pooled URL, SSL) / MEDIUM (storage limits, cold start) — primary pitfalls from official docs; storage estimate from community sources
- Open questions: Flagged honestly, recommendations provided

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (Neon is fast-moving but connection model is stable; re-verify free tier limits)
