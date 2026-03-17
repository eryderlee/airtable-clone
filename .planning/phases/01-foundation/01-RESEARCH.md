# Phase 1: Foundation - Research

**Researched:** 2026-03-17
**Domain:** T3 Stack scaffolding, Auth.js v5, Drizzle ORM + Supabase, Next.js 16, Vercel deployment, 1M-row seeding
**Confidence:** HIGH (primary claims verified via Context7 / official docs / npm registry)

---

## Summary

Phase 1 sets up the entire project skeleton: Next.js 16 (App Router) + tRPC v11 + Drizzle ORM 0.45.1 + Auth.js v5 (beta) + Tailwind CSS, connected to Supabase PostgreSQL and deployed live on Vercel. The stack is scaffolded via `create-t3-app@7.40.0` and then immediately extended with the schema, auth wiring, and a 1M-row seed.

Two critical environmental facts were discovered during research that differ from what the prior STATE.md decisions assumed:

1. **Next.js 16 (currently 16.1.7) is the latest stable release.** It renames `middleware.ts` → `proxy.ts` and the proxy now runs on **Node.js**, not the edge runtime. The Auth.js v5 two-file edge split is therefore no longer required for correctness — however it is still acceptable as a defence-in-depth pattern, and the prior decision to use it should be preserved for forward-compatibility (Auth.js docs still document it as the "safe default").

2. **Zod v3 latest is 3.25.76** — the "pin to 3.23.x" instruction in STATE.md is conservative but valid. Use `zod@3` (latest 3.x) which installs 3.25.76; or pin to `zod@3.23.8` if strict freeze is preferred. Zod v4 is `4.3.6`; do NOT install it.

**Primary recommendation:** Run `create-t3-app@latest` with `--appRouter --trpc --drizzle --nextAuth --tailwind --dbProvider postgres`, then replace the Discord provider with Google, pin Zod to `zod@3`, add the `prepare: false` Drizzle client, run the schema migration, and wire Auth.js proxy.ts redirect — all as documented below.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.1.7 | React framework (App Router) | Latest stable; Turbopack default |
| `react` / `react-dom` | 19.x | UI runtime | Required by Next.js 16 |
| `next-auth` (beta) | 5.0.0-beta.30 | Auth.js v5 — Google OAuth + JWT | Project locked decision |
| `@auth/drizzle-adapter` | 1.11.1 | Drizzle adapter for Auth.js sessions table | Pairs Auth.js with Drizzle |
| `@trpc/server` | 11.13.4 | Type-safe API layer | Project locked decision |
| `@trpc/client` | 11.13.4 | tRPC client | Pairs with server |
| `@trpc/tanstack-react-query` | 11.13.4 | tRPC ↔ TanStack Query bridge | Project locked decision |
| `@tanstack/react-query` | 5.90.21 | Server-state management | Required by tRPC v11 |
| `drizzle-orm` | 0.45.1 | ORM for PostgreSQL | Project locked decision |
| `drizzle-kit` | 0.31.9 | Schema migrations CLI | Drizzle companion |
| `postgres` | 3.4.8 | PostgreSQL client (postgres.js) | Drizzle recommended driver |
| `zod` | 3.25.76 (`zod@3`) | Validation / tRPC schemas | Pin to v3 — v4 incompatible |
| `tailwindcss` | 4.2.1 | Styling | Project locked decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@faker-js/faker` | 10.3.0 | Fake data for seed script | 1M-row seed only (`devDependency`) |
| `tsx` | latest | Run TypeScript seed scripts | Drizzle seed scripts (devDep) |
| `dotenv` | latest | Load .env in scripts | Seed script / drizzle-kit |
| `server-only` | latest | Prevent server code leaking to client | tRPC init.ts guard |
| `client-only` | latest | Prevent client code running server-side | tRPC client.tsx guard |
| `superjson` | 2.x | tRPC serializer (Date, Map, Set) | Optional but recommended |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `postgres` driver | `pg` / `@neondatabase/serverless` | `postgres` is Drizzle-recommended for Node.js; `pg` works but less idiomatic |
| Auth.js v5 beta | Auth.js v4 (next-auth@4.24.13) | v5 required by project — CVE-2025-29927 defense-in-depth pattern |
| Zod v3 | Zod v4 (4.3.6) | v4 + tRPC v11 compatibility unconfirmed; STATE.md pins v3 |

### Installation

```bash
# Scaffold
npm create t3-app@latest my-app -- --CI --appRouter --trpc --drizzle --nextAuth --tailwind --dbProvider postgres

# After scaffold, upgrade/pin specific packages:
npm install next-auth@beta @auth/drizzle-adapter
npm install zod@3            # installs latest 3.x, stays <4
npm install --save-dev @faker-js/faker tsx
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Auth.js route handler
│   │   └── trpc/[trpc]/route.ts          # tRPC HTTP handler
│   ├── layout.tsx                         # Root layout + TRPCReactProvider
│   └── page.tsx                           # Dashboard (server component)
├── server/
│   ├── auth.ts                            # Auth.js full instance (Node.js only)
│   ├── auth.config.ts                     # Auth.js shared config (no adapter)
│   ├── db/
│   │   ├── index.ts                       # Drizzle client (prepare: false)
│   │   └── schema.ts                      # All table definitions + indexes
│   └── api/
│       ├── trpc.ts                        # createTRPCRouter, protectedProcedure
│       ├── root.ts                        # AppRouter merge
│       └── routers/
│           └── bases.ts                   # Example: bases router
├── trpc/
│   ├── react.tsx                          # Client-side TRPCReactProvider
│   ├── server.tsx                         # Server-side caller (RSC)
│   └── query-client.ts                    # QueryClient factory
├── proxy.ts                               # Auth.js session redirect (Node.js)
└── env.js                                 # T3 env validation (t3-env-core)
drizzle.config.ts                          # Drizzle Kit config
scripts/
└── seed.ts                                # 1M-row seed script
```

### Pattern 1: Auth.js v5 Two-File Split (proxy.ts + auth.ts)

**What:** Auth.js configuration split across two files. `auth.config.ts` holds edge-safe config (no DB adapter). `auth.ts` holds the full instance with adapter + JWT strategy. `proxy.ts` imports only `auth.config.ts`.

**When to use:** Always — even though Next.js 16 `proxy.ts` runs on Node.js (making the split technically optional), the split is the documented Auth.js pattern and remains the safe, forward-compatible approach.

```typescript
// Source: https://authjs.dev/guides/edge-compatibility

// src/server/auth.config.ts — edge-safe, no adapter
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // redirect to login
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
} satisfies NextAuthConfig;
```

```typescript
// src/server/auth.ts — full instance with adapter + JWT
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "~/server/db";
import { authConfig } from "./auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});
```

```typescript
// proxy.ts — edge-safe redirect only, imports auth.config NOT auth
import NextAuth from "next-auth";
import { authConfig } from "~/server/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export { proxy as default };  // or: export { auth as default }

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Pattern 2: Drizzle Client with prepare: false

**What:** postgres.js client initialized with `prepare: false` to disable prepared statements incompatible with Supabase Supavisor transaction mode.

```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
// src/server/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client, schema });
```

### Pattern 3: tRPC v11 createTRPCContext + protectedProcedure

**What:** tRPC context receives the auth session and threads it through `protectedProcedure` middleware.

```typescript
// Source: https://trpc.io/docs/server/authorization
// src/server/api/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { auth } from "~/server/auth";
import superjson from "superjson";
import { ZodError } from "zod";

export const createTRPCContext = cache(async (opts: { headers: Headers }) => {
  const session = await auth();
  return { session, db, ...opts };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});
```

### Pattern 4: Composite Cursor (Keyset) Pagination

**What:** Two-column cursor using `(row_order, id)` to paginate consistently across inserts/deletes without OFFSET.

```typescript
// Source: https://orm.drizzle.team/docs/guides/cursor-based-pagination
import { and, asc, eq, gt, or } from "drizzle-orm";

const getRowsPage = async (
  tableId: string,
  cursor?: { rowOrder: number; id: string },
  pageSize = 100
) => {
  return await db
    .select()
    .from(rows)
    .where(
      and(
        eq(rows.tableId, tableId),
        cursor
          ? or(
              gt(rows.rowOrder, cursor.rowOrder),
              and(
                eq(rows.rowOrder, cursor.rowOrder),
                gt(rows.id, cursor.id)
              )
            )
          : undefined
      )
    )
    .limit(pageSize)
    .orderBy(asc(rows.rowOrder), asc(rows.id));
};
```

### Pattern 5: Drizzle Schema — JSONB Hybrid

**What:** Real `columns` table stores column metadata; `cells` JSONB per row stores cell values keyed by `column_id`.

```typescript
// src/server/db/schema.ts (abbreviated)
import {
  pgTable, text, timestamp, integer, jsonb, bigserial, index, uniqueIndex
} from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const bases = pgTable("base", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("base_userId_idx").on(t.userId),
]);

export const tables = pgTable("table", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  baseId: text("baseId").notNull().references(() => bases.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("table_baseId_idx").on(t.baseId),
]);

export const columns = pgTable("column", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tableId: text("tableId").notNull().references(() => tables.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["text", "number"] }).notNull().default("text"),
  order: integer("order").notNull().default(0),
}, (t) => [
  index("column_tableId_idx").on(t.tableId),
]);

export const rows = pgTable("row", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tableId: text("tableId").notNull().references(() => tables.id, { onDelete: "cascade" }),
  rowOrder: integer("rowOrder").notNull().default(0),
  cells: jsonb("cells").$type<Record<string, string | number | null>>().notNull().default({}),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  // Composite index for keyset cursor pagination
  index("row_tableId_rowOrder_id_idx").on(t.tableId, t.rowOrder, t.id),
]);

export const views = pgTable("view", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tableId: text("tableId").notNull().references(() => tables.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  config: jsonb("config").$type<{
    filters: unknown[];
    sorts: unknown[];
    hiddenColumns: string[];
    searchQuery: string;
  }>().notNull().default({ filters: [], sorts: [], hiddenColumns: [], searchQuery: "" }),
}, (t) => [
  index("view_tableId_idx").on(t.tableId),
]);
```

### Pattern 6: 1M-Row Seed Script

**What:** Chunked bulk insert using faker.js. Chunk size 1000 rows prevents statement size limits and memory pressure. Run `ANALYZE` after insert.

```typescript
// scripts/seed.ts
import { db } from "~/server/db";
import { rows, tables, bases, users } from "~/server/db/schema";
import { faker } from "@faker-js/faker";

const TOTAL_ROWS = 1_000_000;
const CHUNK_SIZE = 1_000;

async function seed() {
  // Insert test user, base, table...
  // Then chunk-insert rows:
  for (let i = 0; i < TOTAL_ROWS; i += CHUNK_SIZE) {
    const chunk = Array.from({ length: Math.min(CHUNK_SIZE, TOTAL_ROWS - i) }, (_, j) => ({
      tableId: "test-table-id",
      rowOrder: i + j,
      cells: {
        "col-name": faker.person.fullName(),
        "col-number": faker.number.int({ min: 0, max: 100000 }),
      },
    }));
    await db.insert(rows).values(chunk);
    if (i % 100_000 === 0) console.log(`Inserted ${i} rows...`);
  }
  // After all inserts, run ANALYZE:
  await db.execute(sql`ANALYZE row`);
}
```

### Anti-Patterns to Avoid

- **Relying solely on proxy.ts for auth:** CVE-2025-29927 established that proxy/middleware can be bypassed. Always call `await auth()` inside each server component or tRPC procedure — do not trust that proxy.ts has already verified the user.
- **Using OFFSET pagination:** Permanently banned per STATE.md. OFFSET degrades linearly at 1M rows. Always use cursor (keyset) pagination with composite `(rowOrder, id)`.
- **Importing `auth.ts` (the full instance) in `proxy.ts`:** This would import the Drizzle adapter even though proxy.ts can theoretically handle Node.js in Next.js 16. Keep the split for forward-compatibility and consistency with Auth.js documentation.
- **Forgetting `prepare: false`:** Without it, Supabase Supavisor transaction mode throws `prepared statement already exists` errors in production.
- **Using `zod@4`:** Do not install. `create-t3-app` may install it if not pinned explicitly. Run `npm install zod@3` after scaffolding.
- **Using `next-auth@latest` (4.x):** The bare `next-auth` package installs v4, not v5. Must use `next-auth@beta` to get v5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth flow | Custom OAuth handler | Auth.js v5 `GoogleProvider` | Token exchange, PKCE, CSRF, callback URLs — massively complex |
| Session persistence | Manual JWT signing | Auth.js v5 JWT strategy | Secret rotation, encryption, cookie hygiene |
| Auth.js session tables | Manual SQL migration | `@auth/drizzle-adapter` | Auto-creates `account`, `session`, `verificationToken` tables |
| Env var validation | Manual `process.env` checks | `t3-env-nextjs` (`@t3-oss/env-nextjs`) | Type-safe env, build-time validation, server/client split |
| Cursor pagination logic | Custom SQL string | Drizzle `or/and/gt/eq` operators | Verified correct; avoids SQL injection |
| Fake seed data | Custom random generators | `@faker-js/faker` | Realistic data distribution; seeded PRNG for reproducibility |
| tRPC provider setup | Manual React Query config | `createTRPCContext` + `TRPCReactProvider` | Handles SSR dehydration, server/client separation |

**Key insight:** Auth, env validation, and tRPC context setup all have hidden complexity (CSRF, cookie scoping, hydration mismatches). Never hand-roll what the T3 scaffold generates.

---

## Common Pitfalls

### Pitfall 1: Wrong next-auth version

**What goes wrong:** `npm install next-auth` installs v4.24.13, not v5. Auth.js v5 has a completely different API (`auth()` vs `getServerSession()`).
**Why it happens:** npm resolves to the latest stable; v5 is still in beta.
**How to avoid:** Always use `next-auth@beta` in package.json. Verify with `npm list next-auth`.
**Warning signs:** Import errors on `auth()` function; old `getServerSession` API in docs.

### Pitfall 2: Supabase Transaction Pool + Prepared Statements

**What goes wrong:** Production queries fail with `error: prepared statement "sN" already exists`.
**Why it happens:** Supabase's default connection string (port 6543) uses Supavisor in transaction mode, which routes each statement to potentially different PostgreSQL connections — prepared statements are connection-scoped.
**How to avoid:** Set `prepare: false` in the postgres.js client. Use port 6543 (transaction pooler) for application traffic, port 5432 (direct) for `drizzle-kit` migrations.
**Warning signs:** Works locally (direct connection), fails on Vercel production.

### Pitfall 3: CVE-2025-29927 — Trusting Only proxy.ts for Auth

**What goes wrong:** An attacker sends `x-middleware-subrequest` header, bypassing proxy.ts checks, and reaches protected API routes/tRPC procedures without a valid session.
**Why it happens:** Next.js middleware/proxy processes internal subrequests differently. The header was exploitable on self-hosted apps (Vercel-hosted was not affected directly, but defence-in-depth is required).
**How to avoid:** Every `protectedProcedure` calls `await auth()` independently. Server components accessing user data call `await auth()`. Never rely on proxy.ts alone.
**Warning signs:** tRPC procedures that access `ctx.session` without throwing `UNAUTHORIZED` for unauthenticated requests.

### Pitfall 4: Next.js 16 Breaking Changes

**What goes wrong:** Code written for Next.js 14/15 breaks with async API changes.
**Why it happens:** Next.js 16 fully removes synchronous `cookies()`, `headers()`, `params`, `searchParams` access — they are now async-only.
**How to avoid:** Always `await cookies()`, `await headers()`, `const { slug } = await params`. Run `npx @next/codemod@canary upgrade latest` codemod after scaffold.
**Warning signs:** Runtime errors about synchronous access to dynamic APIs.

### Pitfall 5: Zod v4 Installed Accidentally

**What goes wrong:** tRPC v11 schema validation breaks or behaves unexpectedly because Zod v4 has breaking changes.
**Why it happens:** Running `npm install zod` post-scaffold installs v4.3.6. `create-t3-app` may scaffold with v3 but an `npm install` without pinning upgrades it.
**How to avoid:** Pin `"zod": "^3.25.76"` in package.json (or `"zod@3"`). Add an `overrides` entry if needed.
**Warning signs:** TypeScript errors in tRPC router schemas; `z.string()` type inference changes.

### Pitfall 6: NEXTAUTH_URL Required vs Not Required on Vercel

**What goes wrong:** OAuth callback URL mismatches in production.
**Why it happens:** Auth.js v5 auto-infers the URL from request headers on Vercel. But if NEXTAUTH_URL is set incorrectly (e.g., HTTP instead of HTTPS), it overrides the inference.
**How to avoid:** On Vercel, set `AUTH_SECRET` only. Do NOT set `AUTH_URL` / `NEXTAUTH_URL` unless you have a custom domain. Add your Vercel deployment URL to Google OAuth Console "Authorized redirect URIs".
**Warning signs:** `OAuthSignin` errors, redirect_uri_mismatch from Google.

### Pitfall 7: middleware.ts vs proxy.ts in Next.js 16

**What goes wrong:** Project scaffold creates `middleware.ts`; Next.js 16 shows deprecation warnings, and Auth.js docs use both names interchangeably.
**Why it happens:** `create-t3-app@7.40.0` was released November 2025, before Next.js 16.0 renamed it. It may still scaffold `middleware.ts`.
**How to avoid:** After scaffolding, rename `middleware.ts` → `proxy.ts` and rename the exported function to `proxy`. Or run the codemod: `npx @next/codemod@canary middleware-to-proxy .`
**Warning signs:** Deprecation warnings in Next.js dev server.

### Pitfall 8: 1M Seed Performance

**What goes wrong:** Seed script runs for hours or OOMs.
**Why it happens:** Inserting row-by-row (1M individual inserts), or batching all 1M at once (single 1M-row values list).
**How to avoid:** Use chunks of 1000 rows per insert. Disable Drizzle verbose logging during seed. Use Supabase direct connection (port 5432) for seed, not transaction pool.
**Warning signs:** Seed runs for more than 10 minutes; `max_locks_per_transaction` exceeded errors.

---

## Code Examples

### Auth.js v5 App Router Route Handler

```typescript
// Source: https://authjs.dev/reference/nextjs
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "~/server/auth";
export const { GET, POST } = handlers;
```

### tRPC App Router Route Handler

```typescript
// Source: https://trpc.io/docs/client/nextjs/app-router-setup
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
```

### Drizzle Config (with direct connection URL for migrations)

```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Use direct connection (port 5432) for migrations, not transaction pool
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
```

### Drizzle Composite Index for Cursor Pagination

```typescript
// Source: https://orm.drizzle.team/docs/indexes-constraints
// In pgTable definition third argument:
(t) => [
  index("row_cursor_idx").on(t.tableId, t.rowOrder, t.id),
]
```

### Auth.js v5 Session in tRPC Context

```typescript
// CVE-2025-29927 defense: always verify session in procedure, never trust proxy alone
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // This calls auth() independently — not relying on proxy.ts having run
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});
```

### Vercel Env Vars (minimum set for Phase 1)

```bash
# Required:
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<from Google Cloud Console>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>

# NOT needed on Vercel (auto-inferred by Auth.js v5):
# AUTH_URL / NEXTAUTH_URL
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSession()` (Auth.js v4) | `auth()` (Auth.js v5) | v5 beta (2024) | Single function works in Server Components, Route Handlers, proxy.ts |
| `middleware.ts` (Next.js 15) | `proxy.ts` (Next.js 16) | Next.js 16.0 (Dec 2025) | proxy.ts runs Node.js by default; edge split still recommended |
| `getServerSideProps` | Server Components + tRPC server caller | Next.js App Router | Data fetching moved to RSC layer |
| OFFSET pagination | Keyset (cursor) pagination | Project decision | Required for 1M-row performance |
| Prisma (T3 default) | Drizzle ORM | Project decision | Schema-first, SQL-close, no connection pool issues |
| `next-auth@4` cookie prefix `next-auth.*` | `next-auth@5` cookie prefix `authjs.*` | Auth.js v5 | Cookie name changed; clear old cookies on migration |
| `middleware.ts` running on Edge | `proxy.ts` running on Node.js | Next.js 16.0 | No more edge limitations; prepared statements possible in proxy (but keep split) |

**Deprecated/outdated:**
- `next-auth@4` (`next-auth@latest` on npm): Use `next-auth@beta` for v5.
- Auth.js v4 `[...nextauth]` pages router handler: Use App Router `handlers` export.
- `experimental_ppr` route segment config: Removed in Next.js 16, use `cacheComponents`.
- `next lint` command: Removed in Next.js 16; use ESLint CLI directly.
- Synchronous `cookies()`, `headers()`, `params`: Removed in Next.js 16; all async.
- `serverRuntimeConfig` / `publicRuntimeConfig` in `next.config.js`: Removed in Next.js 16.

---

## Open Questions

1. **Does `create-t3-app@7.40.0` scaffold `middleware.ts` or `proxy.ts`?**
   - What we know: Released November 2025; Next.js 16 was released December 2025. Likely scaffolds `middleware.ts`.
   - What's unclear: Whether a newer version of create-t3-app has been released that targets Next.js 16.
   - Recommendation: After scaffolding, run `npx @next/codemod@canary middleware-to-proxy .` as an explicit step.

2. **Does `create-t3-app@7.40.0` install Zod v3 or v4?**
   - What we know: STATE.md warns v4 compatibility with tRPC v11 is unconfirmed. Zod v4 latest is 4.3.6.
   - What's unclear: Whether the scaffold's generated `package.json` pins `"zod": "^3"` or `"zod": "^4"`.
   - Recommendation: After scaffolding, explicitly run `npm install zod@3` to downgrade/pin. Verify with `npm list zod`.

3. **`@auth/drizzle-adapter` compatibility with `next-auth@5.0.0-beta.30`**
   - What we know: `@auth/drizzle-adapter@1.11.1` exists and is the official Drizzle adapter.
   - What's unclear: Whether beta.30 requires a specific adapter minor version.
   - Recommendation: Install both at the same time and check for peer dependency warnings.

4. **1M-row seed time on Supabase free tier**
   - What we know: Free tier Supabase has rate limits and compute constraints.
   - What's unclear: Whether 1M rows at 1000/chunk will hit free-tier rate limits.
   - Recommendation: Use a paid or Pro Supabase plan for seeding, or run the seed in multiple sessions with progress tracking. Consider using `COPY` via raw SQL for fastest bulk insert if chunked inserts are too slow.

---

## Sources

### Primary (HIGH confidence)
- `npm show` registry queries — exact versions for all packages (March 2026)
- https://nextjs.org/docs/app/guides/upgrading/version-16 — Next.js 16 breaking changes, proxy.ts, async APIs
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — proxy.ts reference, Node.js runtime confirmed
- https://authjs.dev/guides/edge-compatibility — Auth.js two-file edge split pattern, Next.js 16 note
- https://authjs.dev/getting-started/migrating-to-v5 — Auth.js v5 auth() function, breaking changes
- https://authjs.dev/getting-started/deployment — AUTH_SECRET, AUTH_GOOGLE_ID, Vercel auto-inference
- https://authjs.dev/reference/nextjs — auth() universal pattern, JWT strategy
- https://orm.drizzle.team/docs/get-started/supabase-new — `prepare: false` pattern
- https://orm.drizzle.team/docs/guides/cursor-based-pagination — composite cursor implementation
- https://orm.drizzle.team/docs/indexes-constraints — composite index syntax
- https://orm.drizzle.team/docs/column-types/pg — jsonb column type, $type<> pattern
- https://trpc.io/docs/client/nextjs/app-router-setup — tRPC v11 App Router folder structure
- https://trpc.io/docs/server/authorization — protectedProcedure pattern
- https://trpc.io/docs/client/tanstack-react-query/setup — createTRPCContext
- https://vercel.com/blog/postmortem-on-next-js-middleware-bypass — CVE-2025-29927 defence-in-depth
- https://create.t3.gg/en/folder-structure-app — create-t3-app App Router structure
- https://create.t3.gg/en/installation — scaffold CLI options

### Secondary (MEDIUM confidence)
- WebSearch "Auth.js v5 proxy.ts middleware nodejs edge split still needed 2026" + https://authjs.dev/guides/edge-compatibility verification — confirmed edge split still recommended for forward-compat

### Tertiary (LOW confidence)
- Chunk size of 1000 rows for bulk insert: mentioned in community sources; no official Drizzle benchmark; treat as starting point to adjust
- Seed time estimate on Supabase free tier: not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from npm registry and official docs
- Architecture: HIGH — folder structure from official create-t3-app docs + tRPC docs
- Auth.js edge split: HIGH — official Auth.js edge-compatibility guide explicitly addresses Next.js 16
- Pitfalls: HIGH for CVE/prepare/Zod; MEDIUM for seed performance; LOW for free-tier limits
- Code examples: HIGH — sourced from official documentation, not guessed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days) — fast-moving: Auth.js v5 is still beta, check for beta.31+
