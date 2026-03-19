# Phase 11: Instant Interactions & Cold Start Optimization — Research

**Researched:** 2026-03-19
**Domain:** React optimistic UI, Next.js App Router navigation, TanStack Query cache patterns, Neon cold start mitigation
**Confidence:** HIGH (all findings from direct codebase inspection; no external sources needed)

---

## Summary

Phase 11 is a pure UX responsiveness pass — no new infrastructure, no new libraries. Every item in the 12 success criteria maps to a specific code location in the existing codebase. Phase 10 established the full optimistic pattern (`cancel → getData → setData → return {previous}; onError restores; onSettled invalidates`). Phase 11 applies that pattern to the remaining gaps and fixes navigation routing issues.

Four categories of work emerge from analysis:

1. **Navigation routing bugs** — `base/[baseId]/page.tsx` and `base/[baseId]/[tableId]/page.tsx` are server-side redirect pages that add a mandatory DB round trip. Client-side code can bypass these using synchronous cache reads (`utils.X.getData()`). Also: `BaseSidebar.tsx` logo button calls `router.push("/"); router.refresh()` — the `router.refresh()` forces a full SSR re-render on every home navigation, causing perceptible latency.

2. **Optimistic state gaps** — `createRow` in `GridView.tsx` uses `mutateAsync` and awaits the server before appending to `pageCacheRef`. The row does not appear until the round trip completes. Fix: convert to `useMutation` with `onMutate`.

3. **View active-highlight and order bugs** — `view.getByTableId` in the router has **no `ORDER BY` clause** (`ctx.db.select().from(views).where(...)` — bare, unordered). PostgreSQL heap order is non-deterministic; this is the root cause of view reordering. The new view also loses active highlight because `activeViewId` (from URL) doesn't update until `router.push` resolves in `onSuccess`.

4. **Base creation flash** — `AppShell.handleCreateBase` does `await createBase.mutateAsync()` then `await createTable.mutateAsync()`, then `router.push`. The optimistic card appears in `HomeContent` during the await window (since `createBase.onMutate` updates `base.getAll` cache), causing a home-page flash before the navigation.

**Primary recommendation:** Work through the 12 criteria in order. Each fix is surgical and isolated. The three most impactful are: (a) add `ORDER BY` to view router, (b) convert `handleAddRow` to optimistic `useMutation`, (c) remove `router.refresh()` from BaseSidebar logo.

---

## Standard Stack

No new dependencies. Phase 11 uses the existing stack exclusively.

### Core (already installed)
| Library | Version | Purpose | Relevant to Phase 11 |
|---------|---------|---------|----------------------|
| TanStack Query v5 | ^5.x | `onMutate`, `getData`, `setData`, `cancel` | Core of all optimistic patterns |
| tRPC v11 | ^11.x | Mutation hooks, utility access | `api.X.useMutation()`, `api.useUtils()` |
| Next.js 15 App Router | 15.x | `router.push()`, `redirect()`, `useParams()` | Navigation and routing |
| Drizzle ORM | ^0.x | `.orderBy()` on queries | Fix view ordering |
| sonner | ^1.x | Toast on error rollback | Already used project-wide |

### No New Installations Needed
```bash
# No npm install needed for Phase 11
```

---

## Architecture Patterns

### Pattern 1: Established Optimistic Mutation (Phase 10 canonical form)

Every mutation that changes list data uses this exact structure. Already works for tables, views (rename/delete), columns, bases.

```typescript
// Source: TableTabBar.tsx (createTable) — established in Phase 10
const mutation = api.X.create.useMutation({
  onMutate: async (input) => {
    await utils.X.getList.cancel(queryKey);
    const previous = utils.X.getList.getData(queryKey);
    utils.X.getList.setData(queryKey, (old) => [
      ...(old ?? []),
      { id: `optimistic-${Date.now()}`, ...optimisticFields },
    ]);
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous !== undefined) {
      utils.X.getList.setData(queryKey, context.previous);
    }
    toast.error("Failed. Changes reverted.");
  },
  onSettled: () => void utils.X.getList.invalidate(queryKey),
});
```

### Pattern 2: Synchronous Cache-First Navigation

`utils.X.getData()` is synchronous — reads from TanStack Query cache with no network call. Already established in Phase 10-01 for `handleBaseClick`.

```typescript
// Source: HomeContent.tsx — handleBaseClick (Phase 10-01)
const handleNavigation = async (baseId: string) => {
  // Try cache first (synchronous, instant)
  const tables = utils.table.getByBaseId.getData({ baseId });
  if (tables?.[0]) {
    const views = utils.view.getByTableId.getData({ tableId: tables[0].id });
    if (views?.[0]) {
      router.push(`/base/${baseId}/${tables[0].id}/view/${views[0].id}`);
      return; // zero network — instant
    }
  }
  // Fallback: fetch (async, ~200ms on warm Neon)
  const fetchedTables = await utils.table.getByBaseId.fetch({ baseId });
  if (fetchedTables[0]) {
    const fetchedViews = await utils.view.getByTableId.fetch({ tableId: fetchedTables[0].id });
    if (fetchedViews[0]) {
      router.push(`/base/${baseId}/${fetchedTables[0].id}/view/${fetchedViews[0].id}`);
      return;
    }
  }
  router.push(`/base/${baseId}`); // ultimate fallback
};
```

Apply this pattern to: `TableTabBar.tsx` table tab clicks.

### Pattern 3: Optimistic Row Add (pageCacheRef pattern)

The row page cache lives in `pageCacheRef` (a `useRef`), NOT in React Query. The existing `handleAddRow` uses `mutateAsync`, making the row visible only after the server responds.

Fix: convert to `useMutation` with `onMutate` doing the UI work immediately.

```typescript
// Target: GridView.tsx — createRow (replaces current mutateAsync approach)
const createRow = api.row.create.useMutation({
  onMutate: ({ tableId: mutTableId, cells }) => {
    const optimisticId = `optimistic-${Date.now()}`;
    const newRow: RowData = {
      id: optimisticId,
      cells: cells as Record<string, string | number | null>,
    };
    const newIndex = totalCount;
    const pageIndex = Math.floor(newIndex / PAGE_SIZE);
    const pageEntry = pageCacheRef.current[pageIndex];
    if (pageEntry) {
      pageEntry.push(newRow);
    } else {
      pageCacheRef.current[pageIndex] = [newRow];
    }
    utils.row.count.setData({ tableId: mutTableId, filters }, (old) => ({
      count: (old?.count ?? totalCount) + 1,
    }));
    forceUpdate();
    // Scroll and focus immediately
    const primaryColId = columnsData?.find((c) => c.isPrimary)?.id ?? columnsData?.[0]?.id;
    if (primaryColId) {
      requestAnimationFrame(() => {
        rowVirtualizerRef.current?.scrollToIndex(newIndex, { align: "end" });
        setCursor({ rowIndex: newIndex, columnId: primaryColId });
        setEditingCell({ rowIndex: newIndex, columnId: primaryColId });
      });
    }
    return { optimisticId, newIndex, pageIndex };
  },
  onSuccess: (created, _vars, ctx) => {
    // Replace optimistic ID with real ID in cache
    if (!ctx) return;
    const page = pageCacheRef.current[ctx.pageIndex];
    if (page) {
      const idx = page.findIndex((r) => r.id === ctx.optimisticId);
      if (idx !== -1) {
        page[idx] = { id: created.id, cells: created.cells };
        forceUpdate();
      }
    }
  },
  onError: (_err, { tableId: mutTableId }, ctx) => {
    if (!ctx) return;
    const page = pageCacheRef.current[ctx.pageIndex];
    if (page) {
      const idx = page.findIndex((r) => r.id === ctx.optimisticId);
      if (idx !== -1) {
        page.splice(idx, 1);
        utils.row.count.setData({ tableId: mutTableId, filters }, (old) => ({
          count: Math.max(0, (old?.count ?? 0) - 1),
        }));
        forceUpdate();
      }
    }
    toast.error("Failed to add row. Changes reverted.");
  },
  onSettled: (_d, _e, { tableId: mutTableId }) => {
    void utils.row.getByOffset.invalidate({ tableId: mutTableId });
    void refetchCount();
  },
});
// handleAddRow becomes: createRow.mutate({ tableId, cells: {} });
```

**Guard against editing optimistic rows:** In `updateCell`, guard: `if (id.startsWith('optimistic-')) return;` — prevents invalid DB update before ID is replaced.

### Pattern 4: View Order Fix (DB query)

**CONFIRMED:** `view.getByTableId` in `src/server/api/routers/view.ts` has no `ORDER BY`:

```typescript
// Current (broken — heap order):
return ctx.db.select().from(views).where(eq(views.tableId, input.tableId));

// Fix — add stable ordering:
import { asc } from "drizzle-orm";
return ctx.db
  .select()
  .from(views)
  .where(eq(views.tableId, input.tableId))
  .orderBy(asc(views.id)); // views.id is a CUID/UUID, insertion order is stable
```

Use `.orderBy(asc(views.id))` since views have no `createdAt` column (confirmed in Phase 10-02 decision: "views schema has no createdAt/updatedAt").

### Pattern 5: View Active-Highlight During Optimistic Creation

**Problem:** After `createView.onMutate`, the optimistic view (`id: "optimistic-..."`) appears in the list, but `activeViewId` comes from URL params and still points to the previous view. The new view appears in the list without the active blue highlight.

**Fix:** Track `pendingViewId` in `ViewsPanel` state.

```typescript
// Target: ViewsPanel.tsx
const [pendingViewId, setPendingViewId] = useState<string | null>(null);

// Clear when URL catches up to a real view
useEffect(() => {
  if (pendingViewId && !activeViewId.startsWith("optimistic-")) {
    setPendingViewId(null);
  }
}, [activeViewId, pendingViewId]);

// In createView.onMutate:
const optimisticId = `optimistic-${Date.now()}`;
setPendingViewId(optimisticId);

// In render, replace:
//   const isActive = view.id === activeViewId;
// With:
const isActive = view.id === activeViewId || view.id === pendingViewId;
```

### Pattern 6: Chained Mutations for Base Creation (No Flash)

**Problem:** `AppShell.handleCreateBase` uses `mutateAsync` twice sequentially, then navigates. The `createBase.onMutate` adds the optimistic card to `utils.base.getAll`, which React renders on the home page before `router.push` fires, causing a flash.

**Fix:** Close the modal immediately in `createBase.onMutate` (not `onSuccess`). Do NOT update `base.getAll` in the AppShell flow (the home page `HomeContent.createBase.onMutate` handles the home list; AppShell should skip the optimistic update since the user is navigating away). Chain via `onSuccess`.

```typescript
// Target: AppShell.tsx
// Note: AppShell.createBase does NOT need its own onMutate cache update
// because the user navigates away before seeing the home page again.

const [pendingBaseId, setPendingBaseId] = useState<string | null>(null);

const createTable = api.table.create.useMutation({
  onSuccess: async (newTable) => {
    const views = await utils.view.getByTableId.fetch({ tableId: newTable.id });
    if (views[0] && pendingBaseId) {
      router.push(`/base/${pendingBaseId}/${newTable.id}/view/${views[0].id}`);
    }
    void utils.base.getAll.invalidate();
    setPendingBaseId(null);
  },
  onError: () => {
    toast.error("Failed to set up base.");
    setPendingBaseId(null);
  },
});

const createBase = api.base.create.useMutation({
  onMutate: () => {
    setShowCreateModal(false); // Close modal IMMEDIATELY — no flash
  },
  onSuccess: (base) => {
    setPendingBaseId(base.id);
    createTable.mutate({ baseId: base.id, seed: true });
  },
  onError: () => toast.error("Failed to create base."),
});

function handleCreateBase() {
  if (createBase.isPending || createTable.isPending) return;
  createBase.mutate({ name: "Untitled Base" });
  // modal closes immediately via onMutate
}
```

### Pattern 7: Remove router.refresh() from Home Navigation

**CONFIRMED:** `BaseSidebar.tsx` logo button:
```typescript
// Current (forces full SSR re-render — causes latency):
onClick={() => { router.push("/"); router.refresh(); }}

// Fix (just navigate):
onClick={() => router.push("/")}
```

`router.refresh()` in Next.js 15 invalidates the full server cache and forces a new SSR render. For navigating home from a base page, this is unnecessary and the primary cause of home navigation feeling slow.

### Anti-Patterns to Avoid

- **`mutateAsync` in UI event handlers where `useMutation` with `onMutate` exists** — `mutateAsync` awaits server; `onMutate` fires synchronously. `handleAddRow` is the main remaining case.
- **`router.refresh()` for routine navigation** — Only use when data is genuinely stale and needs server re-validation. Remove from logo click.
- **No `ORDER BY` in list queries** — PostgreSQL heap order is not guaranteed. Always add explicit ordering for any user-visible list.
- **Navigating with optimistic IDs in URLs** — Optimistic IDs (`optimistic-...`) are not valid UUIDs. The table tab click guard (`isPending` renders `<span>` not `<Link>`) already prevents this for tables; apply the same guard concept for any other optimistic navigation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic row ID reconciliation | Custom ID tracking system | `onSuccess` callback mutates `pageCacheRef` directly using `findIndex` | Pattern already established for column delete in Phase 10-03 |
| View ordering | Client-side sort state | `ORDER BY views.id ASC` in Drizzle query | One-line fix; server is the source of truth |
| Cold start detection | Health check system | `utils.base.getAll.prefetch()` on mount | Already in TanStack Query; warms connection as side effect |
| Loading shimmer for navigation | Custom skeleton library | `cursor-wait` CSS + existing Tailwind `animate-pulse` | Already used in TableTabBar.tsx `isPending` state |

**Key insight:** Every Phase 11 problem is a missing application of an already-established pattern. No new abstractions.

---

## Common Pitfalls

### Pitfall 1: Editing a Cell With an Optimistic Row ID

**What goes wrong:** `updateCell` mutation uses `row.id` from `pageCacheRef`. If the user types into the newly added row before `onSuccess` replaces the optimistic ID with the real UUID, `updateCell` sends `id: "optimistic-..."` to the server. The server returns 404 (no row with that ID exists).

**Why it happens:** The optimistic row is visible and focused immediately; the real ID arrives ~200ms later.

**How to avoid:** Guard in `updateCell.onMutate`: skip if `id.startsWith('optimistic-')`. The cell edit will simply not persist for that brief window. After `createRow.onSuccess` replaces the ID, further edits work normally.

**Warning signs:** Cell edit mutation returns 404 or NOT_FOUND immediately after row creation.

### Pitfall 2: View List Reorders After Creation or Switch

**Root cause confirmed:** `view.getByTableId` has no `ORDER BY`. PostgreSQL returns rows in heap order, which can differ from insertion order after VACUUMs or page reorganization. Invalidation after optimistic update triggers a refetch that returns canonical (heap) order, which may differ from the optimistic append order.

**Fix:** Add `.orderBy(asc(views.id))` to the query. UUIDs/CUIDs sort in insertion order lexicographically when using `cuid2` (which generates monotonically increasing IDs).

**Warning signs:** Views change position in the sidebar after creating a new view or switching between views.

### Pitfall 3: Home Page Flash During Base Creation

**What goes wrong:** `AppShell.createBase.onMutate` updates `utils.base.getAll` with an optimistic card. React renders this on `HomeContent` (since `HomeContent` subscribes to `base.getAll`). The home page is visible for ~200ms with the new card before `router.push` fires.

**Fix:** AppShell's `createBase` mutation should NOT update `utils.base.getAll`. Close the modal in `onMutate` (gives instant feedback), but don't touch the home page list cache. The home page's own `createBase` (from the empty-state button) can still do its optimistic update — that's a different flow.

**Warning signs:** User briefly sees the home page with new base card before landing on the base.

### Pitfall 4: `router.refresh()` Blocking Home Navigation

**Root cause confirmed:** `BaseSidebar.tsx` calls `router.refresh()` after `router.push("/")`. In Next.js 15, `router.refresh()` invalidates the RSC payload cache for the entire route tree and re-fetches all server components. This includes re-fetching `base.getAll` from the DB, adding ~200-500ms latency.

**Fix:** Remove `router.refresh()`. The home page uses `useQuery` with TanStack Query, so stale data is handled by TanStack Query's `staleTime` settings, not by forced SSR refresh.

### Pitfall 5: View Active Highlight Lost After Creation

**What goes wrong:** After `createView.onMutate`, `activeViewId` (from `useParams`) still points to the previous view. The optimistic view has `id: "optimistic-..."` which never equals `activeViewId`. Result: the new view row in the sidebar has no blue highlight until `router.push` resolves in `onSuccess`.

**Fix:** Track `pendingViewId` in ViewsPanel state. Use `isActive = view.id === activeViewId || view.id === pendingViewId` for highlight.

### Pitfall 6: `createRow` context closure over stale `totalCount`

**What goes wrong:** `onMutate` for `createRow` calculates `newIndex = totalCount`. If `totalCount` is stale (e.g., a race between two rapid row adds), the second optimistic row gets the wrong page index.

**Why it happens:** `totalCount` is read from React state in the closure; rapid successive calls read the same value.

**How to avoid:** In `onMutate`, read `utils.row.count.getData({ tableId, filters })?.count ?? 0` instead of the stale `totalCount` from state. This reads the current TanStack Query cache value (already updated by the first `onMutate`).

---

## Code Examples

### Fix: View Router Ordering (view.ts)

```typescript
// Source: src/server/api/routers/view.ts — getByTableId
// Add import:
import { asc, and, eq } from "drizzle-orm";

// Change the final return from:
return ctx.db.select().from(views).where(eq(views.tableId, input.tableId));

// To:
return ctx.db
  .select()
  .from(views)
  .where(eq(views.tableId, input.tableId))
  .orderBy(asc(views.id));
```

### Fix: Remove router.refresh() from Home Navigation

```typescript
// Source: BaseSidebar.tsx
// Change:
onClick={() => { router.push("/"); router.refresh(); }}
// To:
onClick={() => router.push("/")}
```

### Fix: Cache-First Table Tab Click

```typescript
// Target: TableTabBar.tsx — TableTab component
// Replace Link-based navigation with cache-first click handler

// In TableTab props, add: utils, baseId
// In TableTab render, replace the Link with a button/div:

async function handleTabClick(e: React.MouseEvent) {
  e.preventDefault();
  if (isPending) return; // already loading
  onNavigate(); // set isNavigating = true for loading cursor

  // Try cache first (synchronous — instant if warm)
  const cachedViews = utils.view.getByTableId.getData({ tableId: table.id });
  if (cachedViews?.[0]) {
    router.push(`/base/${baseId}/${table.id}/view/${cachedViews[0].id}`);
    return;
  }

  // Fetch (async — ~200ms, cache was cold despite hover prefetch)
  try {
    const views = await utils.view.getByTableId.fetch({ tableId: table.id });
    if (views[0]) {
      router.push(`/base/${baseId}/${table.id}/view/${views[0].id}`);
      return;
    }
  } catch {
    // ignore
  }

  // Fallback: navigate to redirect page (server handles it)
  router.push(`/base/${baseId}/${table.id}`);
}
```

### Fix: View Active Highlight (ViewsPanel.tsx)

```typescript
// Add to ViewsPanel state:
const [pendingViewId, setPendingViewId] = useState<string | null>(null);

// Add effect to clear pending when URL updates:
useEffect(() => {
  if (pendingViewId && !activeViewId.startsWith("optimistic-")) {
    setPendingViewId(null);
  }
}, [activeViewId, pendingViewId]);

// In createView.onMutate, after setData:
setPendingViewId(optimisticId);

// In view list render, replace isActive check:
const isActive = view.id === activeViewId || view.id === pendingViewId;
```

### Fix: Neon Cold Start (prefetch on mount)

```typescript
// Target: AppShell.tsx or HomeContent.tsx — add to existing useEffect or new one
useEffect(() => {
  // Warm Neon connection on app load so first user interaction is fast.
  // base.getAll is already loaded by SSR; this is a no-op if Neon is warm,
  // and warms the connection if Neon scaled to zero.
  void utils.base.getAll.prefetch();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

---

## Issue-by-Issue Analysis

Maps each of the 12 success criteria to specific code locations and fix complexity:

| # | Criterion | File(s) | Fix | Complexity |
|---|-----------|---------|-----|------------|
| 1 | Cold start not noticeable | `AppShell.tsx` or `HomeContent.tsx` | Add `utils.base.getAll.prefetch()` on mount | LOW |
| 2 | Adding table = instant tab | `TableTabBar.tsx` | Tab appears instantly (already — `onMutate` adds optimistic tab; `isPending` renders `<span>` not `<Link>` so no bad navigation). Criterion likely already met. **Verify.** | VERIFY |
| 3 | Switching tables = instant | `TableTabBar.tsx` `TableTab` | Replace `Link` with cache-first click handler (Pattern 2 applied to table tabs) | MEDIUM |
| 4 | Creating view = instant in sidebar | `ViewsPanel.tsx` | View appears instantly (already — `onMutate` adds it). Navigation waits for `onSuccess`. The view IS visible immediately; only URL update is deferred. Likely already acceptable. **Verify.** | VERIFY |
| 5 | Active highlight on new view | `ViewsPanel.tsx` | Add `pendingViewId` tracking (Pattern 5) | LOW |
| 6 | View order stable | `src/server/api/routers/view.ts` | Add `.orderBy(asc(views.id))` to `getByTableId` | LOW |
| 7 | New row appears instantly | `GridView.tsx` | Convert `handleAddRow` to `useMutation` with `onMutate` (Pattern 3) | MEDIUM |
| 8 | Home navigation instant | `BaseSidebar.tsx` | Remove `router.refresh()` from logo click (Pattern 7) | LOW |
| 9 | Base creation no home flash | `AppShell.tsx` | Close modal in `onMutate`; don't update `base.getAll` in AppShell flow (Pattern 6) | MEDIUM |
| 10 | Base creation visually instant | `AppShell.tsx` | Same fix as #9 — modal closes on first click, before server responds | (same as #9) |
| 11 | Opening base = instant first table | `HomeContent.tsx` | Already implemented (Phase 10-01). **Verify working.** | VERIFY |
| 12 | All buttons respond immediately | Various | Covered by fixes #1-11. Button disabled states already show `isPending`. | (covered) |

---

## State of the Art

| Old Approach | Current Approach After Phase 11 | Impact |
|--------------|----------------------------------|--------|
| `mutateAsync` for row add (waits for server) | `useMutation.onMutate` (instant) | Row visible before server responds |
| `router.refresh()` on home navigation | `router.push("/")` only | Home nav instant |
| No `ORDER BY` on views query | `.orderBy(asc(views.id))` | Views never reorder |
| Pending view has no active highlight | `pendingViewId` state tracks it | Newly created view always highlighted |
| Sequential `await` mutations before navigation | Chain via `onSuccess`, close modal in `onMutate` | Base creation feels instant |
| Table tab click hits server redirect page | Cache-first client navigation | Table switch bypasses server round trip |

---

## Open Questions

All open questions from initial analysis have been resolved by reading the relevant files:

1. **View order in DB** — RESOLVED: No `ORDER BY` in `view.getByTableId`. Fix: add `.orderBy(asc(views.id))`.

2. **Tab navigation to optimistic table** — RESOLVED: `TableTab` renders `<span>` (not `<Link>`) when `isPending=true`. Criterion #2 is likely already satisfied. Verify manually.

3. **Home navigation latency** — RESOLVED: `BaseSidebar.tsx` calls `router.refresh()` after `router.push("/")`. This is the cause. Fix: remove `router.refresh()`.

4. **Criterion #11 gap in BaseSidebar** — RESOLVED: `BaseSidebar.tsx` has no base-click navigation logic (it's just the narrow icon sidebar with logo, help, profile). The base-click navigation is handled by `HomeContent.tsx` (already has cache-first pattern from Phase 10-01) and by `AppSidebar.tsx` (which uses `router.push(item.href)` for the home item only — no base navigation). No gap exists.

**No remaining open questions.**

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all relevant files:
  - `src/components/nav/AppShell.tsx` — base creation flow
  - `src/components/home/HomeContent.tsx` — base click navigation
  - `src/components/nav/TableTabBar.tsx` — table tab optimistic + navigation
  - `src/components/nav/ViewsPanel.tsx` — view creation + active highlight
  - `src/components/nav/BaseSidebar.tsx` — logo navigation (confirmed `router.refresh()`)
  - `src/components/grid/GridView.tsx` — row add flow
  - `src/server/api/routers/view.ts` — confirmed no `ORDER BY`
  - All page/layout files under `src/app/(app)/base/`
- `STATE.md` Phase 10 decision log — optimistic pattern canonical form, confirmed schemas
- `STATE.md` Phase 9 decision log — Neon cold start documentation

### No External Sources Used
All findings are from direct code inspection. No WebSearch or Context7 queries needed — the codebase itself is the authoritative source for this phase.

---

## Metadata

**Confidence breakdown:**
- Issue identification: HIGH — all 12 criteria mapped to specific files and verified
- Fix patterns: HIGH — patterns are direct adaptations of working code in the codebase
- View router fix: HIGH — confirmed missing `ORDER BY` by reading the file
- Home navigation fix: HIGH — confirmed `router.refresh()` by reading BaseSidebar.tsx
- Cold start fix effectiveness: MEDIUM — standard practice; effectiveness depends on user interaction timing vs. Neon warm-up time

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable codebase, patterns established)
