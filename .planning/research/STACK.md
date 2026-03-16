# Technology Stack

**Project:** T3-based Airtable Clone
**Researched:** 2026-03-17
**Research mode:** Ecosystem / Comparison

---

## Recommended Stack

All versions verified against npm registry on 2026-03-17.

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.1.6 | Full-stack React framework | App Router is now stable and mature; Server Components enable server-side tRPC calls without HTTP round-trips; Vercel deployment is first-class |
| TypeScript | 5.x (bundled) | Type safety everywhere | Non-negotiable for this stack; tRPC's value proposition is end-to-end type safety |
| Tailwind CSS | 4.x (latest) | Utility-first styling | Standard in T3 stack; critical for Airtable-like dense UI with precise pixel control |

### API Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @trpc/server | 11.13.4 | Type-safe API procedures | v11 (released March 21, 2025) adds first-class TanStack Query v5 support, React Suspense, httpBatchStreamLink for streaming, and React Server Component prefetching — all needed for this project |
| @trpc/client | 11.13.4 | tRPC client | Matches server version |
| @trpc/react-query | 11.13.4 | DEPRECATED — see below | This package was replaced |
| @trpc/tanstack-react-query | 11.13.4 | tRPC + TanStack Query React hooks | The correct v11 package name; replaces the old @trpc/react-query |
| @tanstack/react-query | 5.90.21 | Async state management | Required peer dependency for tRPC v11; v5 is the current major; useInfiniteQuery drives cursor pagination |
| superjson | 2.2.6 | Serialization transformer | Handles Date, BigInt, Map, Set across the tRPC wire; standard in T3 |
| zod | 4.3.6 | Schema validation | tRPC input validation; pairs with TypeScript for runtime type safety |
| server-only | 0.0.1 | Prevent server code leaking | Use in tRPC router files to enforce server-only imports |
| client-only | 0.0.1 | Prevent client code leaking | Use in client-side tRPC caller |

**CRITICAL NOTE on package name:** In tRPC v11, the React Query integration package was renamed from `@trpc/react-query` to `@trpc/tanstack-react-query`. Using the old name at v11 will cause import errors. Confirm this at project init.

### ORM and Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| drizzle-orm | 0.45.1 | ORM and query builder | See Drizzle vs Prisma section below. Short answer: SQL-close API, ~7KB bundle (Prisma stable is ~1.6MB even after Prisma 7's Rust removal), edge-native, no binary spawn. Critical for Vercel serverless cold starts. |
| drizzle-kit | 0.31.9 | Schema migration CLI | Companion to drizzle-orm; generates and runs migrations |
| postgres (postgres.js) | 3.4.8 | PostgreSQL driver | Supabase's own recommended driver for Drizzle; supports `{ prepare: false }` for Supavisor transaction mode |

**NOTE on drizzle-orm v1.0 beta:** As of research date, drizzle-orm 0.45.1 is the current stable. A v1.0.0-beta.2 exists but is pre-release. Use 0.45.1 for production. Monitor the repo but do not take on beta risk.

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| next-auth | 4.24.13 | Authentication | This is the NextAuth.js v4 stable package. See Auth.js v5 section below. |
| @auth/drizzle-adapter | 1.11.1 | Drizzle session/user tables | Provides the Drizzle-compatible adapter for Auth.js |

**IMPORTANT — NextAuth version disambiguation:**

The ecosystem uses two naming conventions that conflict:

- `next-auth@4.x` — the stable, widely-deployed NextAuth.js v4 (4.24.13 as of today)
- `next-auth@5.x` — This IS Auth.js v5 (previously called NextAuth.js v5). The npm package name is still `next-auth` but at the v5 major.
- The npm tag `next-auth@beta` points to 5.x betas

Run `npm show next-auth versions --json` to confirm. The 4.24.13 latest-stable is safe. **If you want Auth.js v5 features (universal `auth()`, edge-first design, no `getServerSession` boilerplate), you must install `next-auth@beta` explicitly**, since v5 is still beta on npm as of this research date.

**For this project, use Auth.js v5 (next-auth@beta).** Rationale:
- App Router + middleware requires the split auth.config.ts / auth.ts pattern that v5 formalizes
- The Drizzle adapter (@auth/drizzle-adapter) is the same package for both v4 and v5
- v5's universal `auth()` function replaces the awkward `getServerSession(authOptions)` pattern in every Server Component
- v5 was designed for App Router; v4 was designed for Pages Router

### Table UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @tanstack/react-table | 8.21.3 | Headless table logic | v8 is the current stable; handles column definitions, sorting, filtering state; headless means you control all rendering — essential for Airtable-like custom cells |
| @tanstack/react-virtual | 3.13.23 | Row (and column) virtualization | v3 is stable; this is TanStack Virtualizer rebranded. Virtualizes the DOM to render only visible rows; required for 1M-row performance. Note: the package is `@tanstack/react-virtual` but the internal API exports `useVirtualizer` |

**TanStack Table does not include virtualization.** You must wire `@tanstack/react-virtual` manually. The two libraries compose well but are separate installs.

### Infrastructure / Platform

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | (hosted service) | PostgreSQL host | Used purely as a managed PostgreSQL provider. Do NOT use Supabase Auth, Supabase Realtime, or the Supabase client library — these add coupling you don't need and conflict with your chosen auth/query stack |
| Vercel | (hosted service) | Deployment | First-class Next.js integration; serverless functions per route; edge middleware support for NextAuth |

### Development / Seeding

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @faker-js/faker | 10.3.0 | Realistic seed data | Industry standard for generating fake names, emails, numbers, text; essential for seeding the 1M-row performance test data |

---

## Drizzle ORM vs Prisma: Decision Rationale

**Decision: Drizzle ORM. Confidence: HIGH.**

Sources: npm registry (verified 2026-03-17), makerkit.dev comparison (2026), official Drizzle benchmarks, Prisma v7 announcement.

### Why Drizzle wins for this project

**1. Bundle size on Vercel (critical for cold starts)**
- Drizzle core: ~7.4KB minified + gzipped
- Prisma 7 (post-Rust removal): ~1.6MB
- Real-world Vercel cold start difference: 400ms (Drizzle) vs 1100ms (Prisma) on measured workloads
- Airtable-feel requires snappy row fetches. Cold starts accumulate in user-perceived latency.

**2. SQL-close API matches the query requirements**
- This project requires dynamic `WHERE` clause construction (DB-level filtering with user-defined column filters)
- Drizzle's query builder closely mirrors SQL, making complex dynamic `AND`/`OR` filter trees natural to express
- Prisma's abstraction layer makes dynamic `where` clause composition verbose and sometimes requires raw SQL fallback anyway

**3. Edge runtime compatibility**
- Drizzle is natively edge-compatible (no binary, no Rust engine)
- NextAuth v5 middleware runs on the edge; any auth token validation that touches the DB needs edge-compatible code
- Note: the database queries themselves should NOT run at the edge (latency to Supabase is worse from edge nodes than from regional Node.js functions). But the ORM library being edge-safe removes one class of runtime error.

**4. JSONB support for cell_values storage**
- The Airtable schema pattern stores cell values in a JSONB column (or EAV rows). Drizzle supports `jsonb()` columns natively
- For filtering inside JSONB, use `sql\`\`` tagged template escapes — Drizzle exposes `sql` operator for raw PostgreSQL expressions

**5. No "dynamic schema" support needed from the ORM**
- Drizzle's known limitation (GitHub issue #1807, still open) is inability to switch PostgreSQL schemas at runtime — this is for multi-tenant schema-per-tenant patterns
- This project uses a STATIC database schema. User-defined Airtable columns are stored as data (column metadata rows + JSONB cell values), NOT as actual PostgreSQL column additions
- Therefore the multi-tenant schema limitation does NOT apply here

### Why Prisma loses for this project

- **v7 is very new** (late 2025) — pure TypeScript rewrite, bugs expected
- **Bundle still larger** even with Rust removal (~1.6MB vs 7.4KB)
- **Schema file is separate** from TypeScript — the Prisma DSL is an extra language to maintain; Drizzle schema is TypeScript
- **Dynamic WHERE construction** is more natural in Drizzle's query builder syntax

---

## tRPC v11 Cursor Pagination Pattern

**Version confirmed: 11.13.4 (stable, released March 21, 2025)**

### Package install

```bash
npm install @trpc/server@11 @trpc/client@11 @trpc/tanstack-react-query@11 @tanstack/react-query@5 superjson zod
```

### Key setup notes for v11 with App Router

1. Use `httpBatchStreamLink` (not the older `httpBatchLink`) for the client — streaming support is a v11 default
2. Use the `createTRPCContext` pattern in `src/trpc/init.ts`
3. For Server Components, use `createCallerFactory` to call procedures as plain functions (no HTTP round-trip)
4. The `HydateClient` + `prefetchInfiniteQuery` pattern lets you prefetch on the server and stream to the client

### Cursor pagination procedure pattern

```typescript
// src/server/routers/rows.ts
export const rowsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        limit: z.number().min(1).max(200).default(100),
        cursor: z.string().uuid().nullish(), // row ID used as cursor
        filters: z.array(filterSchema).optional(),
        sort: sortSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { tableId, limit, cursor, filters } = input;

      // Fetch limit+1 to determine if next page exists
      const rows = await ctx.db
        .select()
        .from(rowsTable)
        .where(
          and(
            eq(rowsTable.tableId, tableId),
            cursor ? gt(rowsTable.id, cursor) : undefined,
            ...buildFilterConditions(filters)
          )
        )
        .orderBy(asc(rowsTable.id))
        .limit(limit + 1);

      let nextCursor: string | undefined;
      if (rows.length > limit) {
        const nextRow = rows.pop(); // remove the extra item
        nextCursor = nextRow!.id;
      }

      return { rows, nextCursor };
    }),
});
```

### Client-side infinite query

```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  trpc.rows.list.useInfiniteQuery(
    { tableId, limit: 100, filters, sort },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

// Flatten pages for virtualizer
const allRows = data?.pages.flatMap((p) => p.rows) ?? [];
```

---

## TanStack Table v8 + Virtualizer: Integration Notes

**@tanstack/react-table: 8.21.3 | @tanstack/react-virtual: 3.13.23**

### The render pattern

TanStack Table owns the data model (column defs, sort state, filter state, row model). TanStack Virtual owns the DOM windowing (only renders ~30 rows instead of 1M+).

They are composed, not integrated — you hand virtual's `virtualItems` to table's `getRowModel().rows` by index.

```typescript
// Rough composition sketch
const { rows } = table.getRowModel();

const rowVirtualizer = useVirtualizer({
  count: hasNextPage ? allRows.length + 1 : allRows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 40, // row height in px
  overscan: 10,
});

const virtualRows = rowVirtualizer.getVirtualItems();
```

### Infinite fetch trigger

Wire a `useEffect` that calls `fetchNextPage()` when the last virtual item enters the viewport:

```typescript
useEffect(() => {
  const lastVirtualRow = virtualRows[virtualRows.length - 1];
  if (!lastVirtualRow) return;

  if (
    lastVirtualRow.index >= allRows.length - 1 &&
    hasNextPage &&
    !isFetchingNextPage
  ) {
    fetchNextPage();
  }
}, [virtualRows, allRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
```

### Sticky header caveat

Do NOT use CSS `transform: translateY()` for row positioning if you want native sticky `<thead>`. Use the **spacer div approach** (paddingTop / paddingBottom on tbody wrapper) which preserves normal document flow and makes `position: sticky` work on `<thead>`.

TanStack Virtual supports both approaches — use `paddingStart` / `paddingEnd` from `virtualizer.getTotalSize()` to implement the spacer pattern.

### Column virtualization

For v1 (Text and Number columns only), you likely have fewer than 20 columns. Column virtualization is NOT needed at this scale. Add it in a future phase when column count could exceed ~50.

---

## NextAuth.js v5 (Auth.js v5) Google Provider Setup

**Install:** `npm install next-auth@beta @auth/drizzle-adapter`
**@auth/drizzle-adapter confirmed at: 1.11.1**

### The edge middleware split pattern (required)

Auth.js v5 with a database adapter cannot run the full config in middleware because database adapters are not edge-compatible. The solution is a two-file split:

```typescript
// auth.config.ts — edge-safe config, NO adapter here
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/app");
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
};
```

```typescript
// auth.ts — full config with Drizzle adapter, server-only
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users, accounts, sessions, verificationTokens } from "~/db/schema";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" }, // Required when using edge middleware
});
```

```typescript
// middleware.ts — uses edge-safe config only
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/app/:path*"],
};
```

### Session strategy: JWT required

When using edge middleware + an adapter, you must force `session: { strategy: "jwt" }`. If omitted, Auth.js defaults to "database" sessions when an adapter is present, and the middleware will error.

**Trade-off accepted:** JWT sessions cannot be server-side invalidated before expiry. For this use case (Google OAuth, single user per account), this is acceptable.

### Required environment variables

```bash
NEXTAUTH_SECRET=    # openssl rand -base64 32
NEXTAUTH_URL=       # https://your-domain.com (production) or http://localhost:3000 (dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=       # Supabase connection string
```

---

## Supabase as Raw PostgreSQL Host

**Use-case:** Supabase is used as a managed PostgreSQL host ONLY. No Supabase Auth. No Supabase Realtime. No Supabase JS client library.

### Connection string selection

Supabase provides three connection strings:

| Mode | Port | When to use |
|------|------|-------------|
| Direct | 5432 | Long-running Node.js servers (persistent connections). Not recommended for Vercel serverless. |
| Supavisor Session | 5432 (via proxy) | When you need IPv4 support; persistent-style connections through Supavisor |
| Supavisor Transaction | 6543 | **Use this for Vercel** — serverless functions create many short-lived connections; Supavisor pools them |

### For Vercel deployment (recommended config)

```typescript
// db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false, // REQUIRED for Supavisor transaction mode
});

export const db = drizzle(client, { schema });
```

The `prepare: false` flag disables PostgreSQL prepared statements. Supavisor in transaction mode does not support prepared statements because each statement may route to a different backend connection. Omitting this flag causes runtime errors.

### Do NOT use @supabase/supabase-js

The Supabase JavaScript client adds the Supabase PostgREST layer, auth client, and realtime client. None of these are needed. Using it would add unnecessary bundle size and coupling. Use `postgres` (postgres.js) directly with Drizzle.

---

## Supporting Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @faker-js/faker | 10.3.0 | Seed 1M test rows | Use `faker.string.alphanumeric()` and `faker.number.int()` for Text/Number column seeding. Run as a standalone script, not in app bundle. |
| zod | 4.3.6 | Runtime validation | tRPC input schemas, form validation. Note: Zod v4 has breaking changes from v3 (new import paths, some API changes). Verify tRPC v11 supports Zod v4 before upgrading from v3. |
| superjson | 2.2.6 | tRPC transformer | Enables sending Date objects, Sets, Maps across tRPC without manual serialization |
| server-only | 0.0.1 | Import guard | Place at top of db/index.ts and tRPC router files to prevent accidental client-side imports |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | drizzle-orm | Prisma 7 | Bundle 200x larger; separate DSL; newer architecture still stabilizing |
| ORM | drizzle-orm | Kysely | No schema migration tooling; more verbose for simple cases; less T3 ecosystem momentum |
| Auth | next-auth@beta (v5) | Clerk | Clerk is excellent but adds external service dependency and cost; overkill for Google-only OAuth |
| Auth | next-auth@beta (v5) | Lucia Auth | Lower-level; more boilerplate; less ecosystem momentum in 2025 |
| Table | @tanstack/react-table | AG Grid | AG Grid Community is free but opinionated; headless react-table gives full Airtable-feel control |
| Table | @tanstack/react-table | React Data Grid | react-data-grid (adazzle) is more out-of-the-box but less composable; harder to match Airtable's exact interaction model |
| Virtualization | @tanstack/react-virtual | react-window | react-window is largely unmaintained (2022); TanStack Virtual is the active successor with dynamic heights |
| Virtualization | @tanstack/react-virtual | react-virtuoso | react-virtuoso is good but adds abstraction that conflicts with table's row index model |
| DB Host | Supabase (Postgres only) | Neon | Both are viable Vercel-integrated Postgres hosts; Supabase wins on plan generosity and community familiarity for this project |
| DB Host | Supabase (Postgres only) | PlanetScale | PlanetScale dropped free tier; MySQL, not PostgreSQL |

---

## Full Installation Command

```bash
# Core runtime
npm install next@latest react@latest react-dom@latest typescript

# tRPC v11 stack
npm install @trpc/server@11 @trpc/client@11 @trpc/tanstack-react-query@11
npm install @tanstack/react-query@5
npm install superjson zod
npm install server-only client-only

# ORM
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth
npm install next-auth@beta @auth/drizzle-adapter

# Table + Virtualization
npm install @tanstack/react-table @tanstack/react-virtual

# Dev / seeding
npm install -D @faker-js/faker

# Styling (assumed)
npm install -D tailwindcss postcss autoprefixer
```

---

## Compatibility Matrix

| Pair | Status | Notes |
|------|--------|-------|
| tRPC v11 + TanStack Query v5 | Confirmed compatible | v11 was specifically built for TQ v5; this is the recommended combination |
| Next.js 16 + Auth.js v5 | Confirmed compatible | Auth.js v5 targets Next.js 14+; Next.js 16 is fully supported |
| Drizzle 0.45.1 + postgres.js 3.x | Confirmed compatible | Official Supabase/Drizzle docs show this exact pairing |
| @auth/drizzle-adapter + next-auth beta | Confirmed compatible | Same @auth/* package family |
| @tanstack/react-table v8 + @tanstack/react-virtual v3 | Confirmed compatible | Separate packages, compose by passing row count and index |
| Zod v4 + tRPC v11 | VERIFY BEFORE USE | Zod v4 has breaking changes; confirm tRPC v11 zod inference works with v4 or pin to zod@3 |

---

## Version Compatibility Warning: Zod v4

Zod 4.3.6 is the latest as of this research. Zod v4 introduced breaking changes from v3 (import paths changed, some inference behaviors changed). tRPC v11 was released March 2025 and may reference Zod v3 patterns in its documentation examples.

**Recommendation:** Start with `zod@3` (pin at 3.23.x) until you confirm tRPC v11 examples work without modification with Zod v4. Upgrade to Zod v4 as a deliberate task in an early phase.

---

## Sources

- tRPC v11 release announcement: https://trpc.io/blog/announcing-trpc-v11
- tRPC latest releases (GitHub): https://github.com/trpc/trpc/releases
- tRPC useInfiniteQuery docs: https://trpc.io/docs/client/react/useInfiniteQuery
- Drizzle ORM Supabase connection guide: https://orm.drizzle.team/docs/connect-supabase
- Drizzle ORM + Supabase tutorial: https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
- Supabase database connections guide: https://supabase.com/docs/guides/database/connecting-to-postgres
- Auth.js v5 migration guide: https://authjs.dev/getting-started/migrating-to-v5
- Auth.js Drizzle adapter: https://authjs.dev/getting-started/adapters/drizzle
- TanStack Table virtualization guide: https://tanstack.com/table/v8/docs/guide/virtualization
- TanStack Table virtualized infinite scroll example: https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-infinite-scrolling
- Drizzle vs Prisma comparison (2026): https://makerkit.dev/blog/tutorials/drizzle-vs-prisma
- Drizzle dynamic schema issue (open): https://github.com/drizzle-team/drizzle-orm/issues/1807
- Drizzle ORM JSONB native support issue: https://github.com/drizzle-team/drizzle-orm/issues/1690
- npm: drizzle-orm 0.45.1 (verified 2026-03-17)
- npm: @tanstack/react-table 8.21.3 (verified 2026-03-17)
- npm: @tanstack/react-virtual 3.13.23 (verified 2026-03-17)
- npm: @trpc/server 11.13.4 (verified 2026-03-17)
- npm: next-auth 4.24.13 stable / 5.x at @beta tag (verified 2026-03-17)
- npm: @auth/drizzle-adapter 1.11.1 (verified 2026-03-17)
- npm: zod 4.3.6 (verified 2026-03-17)
- npm: @faker-js/faker 10.3.0 (verified 2026-03-17)
