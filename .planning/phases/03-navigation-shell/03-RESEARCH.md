# Phase 3: Navigation Shell - Research

**Researched:** 2026-03-17
**Domain:** Next.js 15 App Router nested layouts, tRPC classic integration (createTRPCReact), navigation shell UI
**Confidence:** HIGH

---

## Summary

Phase 3 builds the Airtable navigation shell: a three-level nested layout (`(app)/base/[baseId]/[tableId]/view/[viewId]`) with a sidebar showing all bases, a tab bar showing tables for the active base, and a views panel. All five tRPC routers from Phase 2 are already complete (base, table, column, view, row). Phase 3 is entirely UI — no new backend work.

The critical routing insight is that Next.js 15 App Router params are **async Promises** and must be awaited in server components or accessed via `React.use()` in client components. Failing to do this is a build-breaking lint error in Next.js 15. The nested layout file hierarchy directly maps to the URL structure, with a route group `(app)` used to avoid affecting URL paths while scoping the shell layout.

The tRPC client in this project uses the **classic** `createTRPCReact` integration (not `@trpc/tanstack-react-query`). The `api` export from `~/trpc/react` uses `api.base.getAll.useQuery()`, `api.base.create.useMutation()`, and `api.useUtils()` for invalidation. All navigation-triggering side effects (after create/delete mutations) use `router.push()` from `useRouter`.

**Primary recommendation:** Build the route hierarchy as three nested layouts (`(app)/layout.tsx` → `base/[baseId]/layout.tsx` → `[tableId]/view/[viewId]/layout.tsx`), mark layout components that use hooks as `"use client"` leaf components, and keep route segment layouts as server components that pass data to client children via props.

---

## Standard Stack

All packages already installed. **No new dependencies for Phase 3.**

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | ^15.0.0 | App Router, nested layouts, `redirect()`, `notFound()` | Project stack |
| `@trpc/react-query` | ^11.0.0 | Classic `createTRPCReact` — `api.useQuery`, `api.useMutation`, `api.useUtils` | Project stack (already wired) |
| `@tanstack/react-query` | ^5.50.0 | Underlying query client, `useQueryClient` | Project stack |
| `tailwindcss` | ^3.4.3 | All layout/component styling | Project stack |
| `next/navigation` | built-in | `usePathname`, `useRouter`, `useParams`, `redirect` | Built into Next.js 15 |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@faker-js/faker` | ^9.9.0 | Runtime seeding when table created | Already called in `table.create` router |
| `react` | ^18.3.1 | `React.use()` for promise unwrapping in client components | Used when params accessed in client components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Classic `createTRPCReact` | New `@trpc/tanstack-react-query` `useTRPC` hook | Project already uses classic; migration out of scope; query keys are compatible so mixing is possible but unnecessary |
| `useUtils().invalidate()` | `queryClient.invalidateQueries({ queryKey })` | Both work; `useUtils()` is idiomatic for the classic integration used here |
| Tailwind utility classes | CSS modules | Project uses Tailwind throughout; consistency requires Tailwind |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/
├── layout.tsx                          # Root layout (existing) — TRPCReactProvider, html/body
├── page.tsx                            # Home/landing (existing)
├── sign-in/                            # Auth pages (existing)
├── sign-up/                            # Auth pages (existing)
└── (app)/                              # Route group — scopes shell layout, NO URL impact
    ├── layout.tsx                      # Auth guard + sidebar shell — server component
    ├── page.tsx                        # Index: redirect to first base or show empty state
    └── base/
        └── [baseId]/
            ├── layout.tsx              # Tab bar shell — receives baseId, loads tables
            ├── page.tsx                # Redirect to first table+view in this base
            └── [tableId]/
                └── view/
                    └── [viewId]/
                        ├── layout.tsx  # Views panel shell — receives tableId+viewId, loads views
                        └── page.tsx    # Grid content area (Phase 4)

src/components/
├── auth/                               # Existing auth components
├── nav/
│   ├── AppSidebar.tsx                  # "use client" — base list, create/rename/delete base
│   ├── TableTabBar.tsx                 # "use client" — table tabs, create/rename/delete table
│   ├── ViewsPanel.tsx                  # "use client" — view list, create/rename/delete view
│   └── NavLink.tsx                     # "use client" — active link with usePathname
└── ui/
    └── InlineEdit.tsx                  # "use client" — click-to-edit text input component
```

### Pattern 1: Route Group for Shell Layout

**What:** Wrap all authenticated app routes in `(app)/` so they share a layout without `(app)` appearing in URLs.

**When to use:** Any time you want a layout that applies to a subset of routes without adding a URL segment.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
// app/(app)/layout.tsx — server component, auth guard
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar userId={session.user.id} />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
```

### Pattern 2: Async Params in Next.js 15 (CRITICAL)

**What:** In Next.js 15, `params` is a Promise and MUST be awaited. Synchronous access is a build error.

**When to use:** Every layout and page that receives `params` — all three levels of the nested route.

```typescript
// Source: https://nextjs.org/docs/messages/sync-dynamic-apis
// app/(app)/base/[baseId]/layout.tsx — server component
export default async function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;  // MUST await in server components
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TableTabBar baseId={baseId} />
      {children}
    </div>
  );
}

// In a client component — use React.use()
"use client";
import { use } from "react";

export default function ClientPage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = use(params);  // React.use() unwraps Promise in client components
  // ...
}
```

### Pattern 3: Server Redirect to First Item

**What:** When landing on a route that is just a container (e.g., `/base/[baseId]`), redirect server-side to the first table+view.

**When to use:** Index pages at `(app)/page.tsx` (first base) and `base/[baseId]/page.tsx` (first table).

```typescript
// Source: https://nextjs.org/docs/app/guides/redirecting
// app/(app)/base/[baseId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { auth } from "~/server/auth";

export default async function BaseIndexPage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const caller = createCaller(await createTRPCContext({ auth: session }));
  const tables = await caller.table.getByBaseId({ baseId });

  if (tables.length === 0) {
    // Render empty state — let user create first table
    return <EmptyTableState baseId={baseId} />;
  }

  const firstTable = tables[0]!;
  const views = await caller.view.getByTableId({ tableId: firstTable.id });
  const firstView = views[0]!;

  redirect(`/base/${baseId}/${firstTable.id}/view/${firstView.id}`);
}
```

### Pattern 4: Classic tRPC Client Pattern (api.X.useQuery / useUtils)

**What:** This project uses the classic `createTRPCReact` integration. Use `api.X.useQuery()`, `api.X.useMutation()`, and `api.useUtils()` for invalidation.

**When to use:** All client components that need tRPC data or mutations.

```typescript
// Source: https://trpc.io/docs/client/react/useUtils
"use client";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

export function AppSidebar() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: bases } = api.base.getAll.useQuery();

  const createBase = api.base.create.useMutation({
    onSuccess: (newBase) => {
      void utils.base.getAll.invalidate();
      router.push(`/base/${newBase.id}`);
    },
  });

  const deleteBase = api.base.delete.useMutation({
    onSuccess: () => {
      void utils.base.getAll.invalidate();
      router.push("/");
    },
  });

  const renameBase = api.base.update.useMutation({
    onSuccess: () => {
      void utils.base.getAll.invalidate();
    },
  });

  // ...
}
```

### Pattern 5: Active Link with usePathname

**What:** Determine active state in nav links using `usePathname`. Must be in a `"use client"` component.

**When to use:** Sidebar base items, table tabs — need visual active state.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/use-pathname
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={isActive
        ? "bg-white/20 text-white"
        : "text-white/70 hover:bg-white/10 hover:text-white"
      }
    >
      {children}
    </Link>
  );
}
```

### Pattern 6: Inline Edit Component

**What:** Click-to-edit text — click shows input, blur/Enter saves, Escape cancels.

**When to use:** Renaming bases (sidebar), renaming tables (tab bar), renaming views (views panel).

```typescript
"use client";
import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
}

export function InlineEdit({ value, onSave, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value); // revert if empty or unchanged
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={className}
      />
    );
  }

  return (
    <span onDoubleClick={() => setEditing(true)} className={className}>
      {value}
    </span>
  );
}
```

### Pattern 7: Airtable Layout Structure (Tailwind)

**What:** The Airtable layout is a flex row with a fixed-width left sidebar and a flex column for the content area (tab bar on top, content below).

**When to use:** Root app layout and the content area layout.

```typescript
// Root shell (app layout)
<div className="flex h-screen w-screen overflow-hidden bg-gray-100">
  {/* Left sidebar — fixed width */}
  <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
    {/* Base list */}
  </aside>
  {/* Main content area */}
  <div className="flex flex-1 flex-col overflow-hidden">
    {/* Table tab bar — fixed height */}
    <header className="flex h-10 flex-shrink-0 items-center border-b border-gray-200 bg-white px-2">
      {/* Table tabs */}
    </header>
    {/* Content + views panel */}
    <div className="flex flex-1 overflow-hidden">
      {/* Views panel — fixed width */}
      <aside className="flex w-48 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 p-2">
        {/* View list */}
      </aside>
      {/* Grid content */}
      <main className="flex flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Accessing params synchronously in Next.js 15:** `params.baseId` without `await` is a build error. Always `await params` in server components, `React.use(params)` in client components.
- **Using `redirect()` inside try/catch:** `redirect()` throws internally; calling it inside a try block swallows it silently. Always call redirect outside try/catch.
- **Putting `usePathname` / `useRouter` in a server component:** These are client-only hooks. Mark the component `"use client"` or extract to a separate client sub-component.
- **Calling `api.useUtils()` outside a component:** useUtils() must be called inside a React component/hook.
- **Navigating between route groups that have different root layouts:** This triggers a full page reload. Our app uses a single `(app)` group with one layout — not a problem here.
- **Using `api.useContext()` (deprecated):** The current API is `api.useUtils()`. `useContext` was the old name.
- **Layout accessing child segment params:** A `layout.tsx` only receives its own segment's params, not deeper nested params. `/base/[baseId]/layout.tsx` has `baseId`; it cannot see `tableId` or `viewId`. Pass those down via URL or via useParams in client components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query cache invalidation after mutations | Custom state synchronization | `api.useUtils().X.invalidate()` | Handles concurrent mutations, dedup, and background refetch automatically |
| Active link highlighting | Manual class toggle state | `usePathname()` from `next/navigation` | Correct across navigations, SSR-safe |
| Auth guard on every page | Per-page session check | Auth check in `(app)/layout.tsx` once | Layout runs for all nested routes; single check |
| Server-side redirect to first item | Client-side redirect after data load | `redirect()` in async server component | Prevents flash of wrong content |
| Fake data on table create | Custom seed script | `@faker-js/faker` already wired in `table.create` router | Already implemented, just call with `seed: true` (default) |

**Key insight:** The layout system in Next.js App Router handles the shell-stays-mounted pattern automatically — no special work needed to prevent sidebar re-renders on navigation.

---

## Common Pitfalls

### Pitfall 1: params Must Be Awaited (Next.js 15 Breaking Change)

**What goes wrong:** TypeScript compiles but Next.js throws at runtime or lint/build fails with `sync-dynamic-apis` error.

**Why it happens:** Next.js 15 changed `params` from a plain object to a Promise to enable better streaming and caching. Pre-v15 code (and much AI-generated code) still accesses `params.baseId` synchronously.

**How to avoid:** Always destructure after await: `const { baseId } = await params;` in server components, `const { baseId } = React.use(params)` in client components.

**Warning signs:** TypeScript error `Property 'baseId' does not exist on type 'Promise<...>'`, or Next.js console warning about sync dynamic API access.

### Pitfall 2: Layout Cannot Access Deeper Params

**What goes wrong:** `(app)/base/[baseId]/layout.tsx` tries to read `tableId` from params to highlight the active table tab — but `tableId` is not in this layout's params.

**Why it happens:** Each layout only receives params up to its own segment depth. Params from deeper segments are not propagated upward.

**How to avoid:** In the TableTabBar client component, use `useParams()` hook which reads all current URL params. Alternatively, pass the needed value from the deeper `page.tsx` if the component is rendered from that level.

**Warning signs:** `params.tableId` is `undefined` in a layout that doesn't own `[tableId]`.

### Pitfall 3: redirect() Inside try/catch Is Silently Swallowed

**What goes wrong:** The redirect never fires; user stays on the current page with no error.

**Why it happens:** `redirect()` works by throwing a special Next.js error. A catch block intercepts it.

**How to avoid:** Always call `redirect()` outside try/catch blocks. If you need error handling for the DB call, catch the error, then call redirect() after the try/catch.

```typescript
// WRONG
try {
  const tables = await caller.table.getByBaseId({ baseId });
  redirect(`/base/${baseId}/${tables[0]!.id}/view/...`);  // swallowed!
} catch (e) { ... }

// CORRECT
let tables;
try {
  tables = await caller.table.getByBaseId({ baseId });
} catch (e) { /* handle */ }
if (tables?.[0]) redirect(`/base/${baseId}/${tables[0].id}/view/...`);
```

### Pitfall 4: Using `api.useContext()` Instead of `api.useUtils()`

**What goes wrong:** `api.useContext()` works (it's an alias) but is deprecated in tRPC v11 and may be removed.

**Why it happens:** Old docs and tutorials still show `api.useContext()`.

**How to avoid:** Always use `api.useUtils()` for the classic createTRPCReact integration.

### Pitfall 5: Stale Data After Navigation (Not Invalidating)

**What goes wrong:** After creating a new base and navigating to it, the sidebar still shows the old list.

**Why it happens:** Mutation didn't invalidate the query, so the TanStack Query cache still holds the old data.

**How to avoid:** Every mutation `onSuccess` callback must call the relevant `utils.X.invalidate()`. For creates, invalidate the list query. For deletes, invalidate the list and navigate away.

### Pitfall 6: Views Panel Empty on New Tables

**What goes wrong:** User navigates to new table, views panel is empty or crashes.

**Why it happens:** `table.create` with `seed: true` creates one view ("Grid View") — but if `seed: false`, or if the view query runs before the mutation commits, the panel is empty.

**How to avoid:** The `table.create` router always seeds with `seed: true` by default. When redirecting to a new table, ensure the redirect target includes a real `viewId` returned from the create mutation response (not a hardcoded guess). Always load views via tRPC query with a loading state guard before rendering the panel.

---

## Code Examples

### Route Hierarchy Setup

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
// File: src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/layout.tsx

export default async function ViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;
  return (
    <div className="flex flex-1 overflow-hidden">
      <ViewsPanel tableId={tableId} activeViewId={viewId} />
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

### Table Tab Bar — Client Component

```typescript
// src/components/nav/TableTabBar.tsx
"use client";
import { api } from "~/trpc/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { InlineEdit } from "~/components/ui/InlineEdit";

export function TableTabBar({ baseId }: { baseId: string }) {
  const router = useRouter();
  const params = useParams<{ tableId?: string }>();
  const utils = api.useUtils();

  const { data: tables } = api.table.getByBaseId.useQuery({ baseId });

  const createTable = api.table.create.useMutation({
    onSuccess: async (newTable) => {
      await utils.table.getByBaseId.invalidate({ baseId });
      // Get the default view created during seeding
      const views = await utils.client.view.getByTableId({ tableId: newTable.id });
      if (views[0]) {
        router.push(`/base/${baseId}/${newTable.id}/view/${views[0].id}`);
      }
    },
  });

  const renameTable = api.table.update.useMutation({
    onSuccess: () => void utils.table.getByBaseId.invalidate({ baseId }),
  });

  const deleteTable = api.table.delete.useMutation({
    onSuccess: () => {
      void utils.table.getByBaseId.invalidate({ baseId });
      router.push(`/base/${baseId}`);
    },
  });

  return (
    <header className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2">
      {tables?.map((table) => (
        <div
          key={table.id}
          className={`flex items-center rounded px-3 py-1 text-sm ${
            params.tableId === table.id
              ? "bg-gray-100 font-medium"
              : "hover:bg-gray-50"
          }`}
        >
          <Link href={`/base/${baseId}/${table.id}/view/...`}>
            <InlineEdit
              value={table.name}
              onSave={(name) => renameTable.mutate({ id: table.id, name })}
            />
          </Link>
        </div>
      ))}
      <button
        onClick={() => createTable.mutate({ baseId, name: "Table 1", seed: true })}
        className="ml-2 rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
      >
        +
      </button>
    </header>
  );
}
```

### createCaller Usage for Server-Side Redirects

The `createCaller` function allows calling tRPC procedures server-side without HTTP. Use it in server component pages for redirect-to-first-item patterns.

```typescript
// Source: existing src/server/api/root.ts exports createCaller
// app/(app)/page.tsx
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function AppIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const ctx = await createTRPCContext({ headers: new Headers() });
  const caller = createCaller(ctx);
  const bases = await caller.base.getAll();

  if (bases.length === 0) {
    return <EmptyBasesState />;
  }

  const firstBase = bases[0]!;
  redirect(`/base/${firstBase.id}`);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `params.id` access | `await params` (Promise) | Next.js 15 | Build error if not migrated — critical |
| `api.useContext()` | `api.useUtils()` | tRPC v10/v11 | useContext still works but deprecated |
| Pages Router layouts (`_app.tsx`) | App Router nested `layout.tsx` | Next.js 13 | Layouts don't remount on navigation, state preserved |
| Middleware for auth guards | Layout-level `auth()` check | Next.js 13+ | Simpler, but middleware still needed for true edge-level protection |
| `useRouter` from `next/router` | `useRouter` from `next/navigation` | Next.js 13 | Different packages — wrong import causes silent breakage |

**Deprecated/outdated:**
- `next/router` imports: All navigation hooks must come from `next/navigation` in App Router
- `api.useContext()`: Use `api.useUtils()` instead

---

## Open Questions

1. **createTRPCContext signature for server-side callers**
   - What we know: `createCaller` is exported from `src/server/api/root.ts`; `createTRPCContext` exists in `src/server/api/trpc.ts`
   - What's unclear: The exact signature of `createTRPCContext` — it may require a full request object (headers), which isn't available in a plain server component
   - Recommendation: Inspect `src/server/api/trpc.ts` during planning and use the `HydrateClient` + server-side prefetch pattern already in use in `src/app/page.tsx` if direct caller context construction is complex. Alternative: use the tRPC server-side caller pattern from `src/trpc/server.ts` if it exists.

2. **ViewId resolution during table→view redirect**
   - What we know: `table.create` with `seed: true` creates one view and returns the table (not the view)
   - What's unclear: The redirect needs a `viewId`, requiring a second query after table creation
   - Recommendation: After `table.create.mutate()` succeeds, query `view.getByTableId` via `utils.client` to get the viewId, then redirect. Or add `viewId` to the `table.create` return value in the router (backend change allowed).

3. **Table tab "active first view" navigation**
   - What we know: Tab clicks should navigate to `/base/[baseId]/[tableId]/view/[viewId]` — but the tab bar only knows `tableId`, not `viewId`
   - What's unclear: Whether to always redirect to the first view or remember the last visited view per table
   - Recommendation: For Phase 3, always redirect to the first view of the target table. Use `utils.client.view.getByTableId` to fetch views on tab click, then navigate.

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/getting-started/layouts-and-pages` — nested layouts, route conventions (fetched 2026-03-16, version 16.1.7)
- `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups` — route groups, caveats (fetched 2026-03-16, version 16.1.7)
- `https://nextjs.org/docs/messages/sync-dynamic-apis` — async params breaking change, fix patterns (fetched)
- `https://nextjs.org/docs/app/guides/redirecting` — redirect() usage, useRouter, server vs client (fetched 2026-03-16, version 16.1.7)
- `https://trpc.io/docs/client/react/useUtils` — useUtils hook, invalidate patterns (fetched)
- Existing codebase: `src/trpc/react.tsx` confirms classic `createTRPCReact` integration, `api` export
- Existing codebase: `src/server/api/root.ts` confirms `createCaller` export
- Existing codebase: all 5 routers (base, table, column, view, row) confirmed complete

### Secondary (MEDIUM confidence)
- WebSearch "Next.js 15 App Router route groups nested layouts dashboard sidebar pitfalls 2026" — confirmed by official docs
- WebSearch "Next.js 15 usePathname active link client component layout pattern 2026" — confirmed by official Next.js usePathname docs

### Tertiary (LOW confidence)
- Airtable layout dimensions (sidebar width ~264px, tab bar ~40px) — not verified against official Airtable source; Phase 03-03 does a pixel pass with Playwright

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json; no new dependencies needed
- Architecture: HIGH — Next.js 15 App Router layout/route-group patterns verified via official docs
- tRPC patterns: HIGH — codebase uses classic createTRPCReact; useUtils invalidation verified via trpc.io docs
- Pitfalls: HIGH — async params breaking change verified in official Next.js docs; other pitfalls verified from multiple sources
- Airtable pixel dimensions: LOW — Phase 03-03 must do a Playwright scrape to get exact values

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (Next.js and tRPC are stable; Airtable UI could change at any time, but pixel pass is in 03-03)
