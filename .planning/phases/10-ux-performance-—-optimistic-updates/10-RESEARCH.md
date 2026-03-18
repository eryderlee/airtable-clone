# Phase 10: UX Performance — Optimistic Updates - Research

**Researched:** 2026-03-18
**Domain:** tRPC v11 + React Query v5 optimistic mutation patterns (client-side cache mutations)
**Confidence:** HIGH (patterns verified against tRPC docs, create.t3.gg, TanStack Query docs, and codebase inspection)

---

## Summary

This phase adds optimistic updates to all user-facing mutations so the UI responds in under 50ms regardless of network latency. The codebase already has one working optimistic mutation (cell updates via `pageCacheRef` in `GridView.tsx`) and one partial one (column rename via `utils.column.getByTableId.setData`). The remaining mutations use either `router.refresh()` (HomeContent base operations) or `onSuccess → invalidate()` patterns that wait for the server round-trip before updating the UI.

The standard approach for this codebase is **tRPC's `useUtils()` helpers**: `utils.[router].[procedure].setData(input, updaterFn)` to write directly to the React Query cache in `onMutate`, `utils.[router].[procedure].getData(input)` to snapshot before the write, and restore in `onError`. `onSettled` triggers `invalidate()` to sync the real server state afterward.

The one architectural exception is row data, which lives in `pageCacheRef` (not React Query cache), so row-level optimistic updates must continue targeting that ref directly — exactly as the existing cell update and row delete already do.

**Primary recommendation:** Apply `onMutate → setData → rollback on onError → invalidate on onSettled` to every mutation that touches base/table/view/column data. Row create already does this via `pageCacheRef`. Home page base list needs a client-side `useQuery` so `setData` has a cache entry to write into.

---

## Standard Stack

No new dependencies are needed. All required tools already exist.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trpc/react-query` | ^11.0.0 | `useUtils()`, `setData`, `getData`, `cancel`, `invalidate` | Already installed; provides typed cache access |
| `@tanstack/react-query` | ^5.50.0 | Underlying mutation lifecycle: `onMutate`, `onError`, `onSettled` | Already installed; v5 ships the rollback context pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hot-toast` or equivalent | (not installed) | Error toasts on rollback | Only if a toast library is added; currently no toast system exists |

**No new installations required.** The phase is purely about wiring existing hooks differently.

---

## Architecture Patterns

### Current State (what exists today)

| Mutation | Location | Current Approach | Has Optimistic Update? |
|----------|----------|-----------------|------------------------|
| Cell update | `GridView.tsx` | Direct `pageCacheRef` mutation in `onMutate` | YES |
| Row delete | `GridView.tsx` | Direct `pageCacheRef` rebuild + `forceUpdate` | YES |
| Column rename | `GridView.tsx` | `utils.column.getByTableId.setData` in `onMutate` | YES (partial — no onError rollback) |
| Column delete | `GridView.tsx` | `onSuccess → invalidate + refetchPage` | NO |
| Column create | `GridView.tsx` | `onSuccess → refetchColumns` | NO |
| View create | `ViewsPanel.tsx` | `onSuccess → invalidate + router.push` | NO |
| View rename | `ViewsPanel.tsx` | `onSuccess → invalidate` | NO |
| View delete | `ViewsPanel.tsx` | `onSuccess → invalidate + router.push` | NO |
| Table create | `TableTabBar.tsx` | `onSuccess → invalidate + view.fetch + router.push` | NO |
| Table rename | `TableTabBar.tsx` | `onSuccess → invalidate` | NO |
| Table delete | `TableTabBar.tsx` | `onSuccess → invalidate + router.push + refresh` | NO |
| Base rename | `HomeContent.tsx` | `onSuccess → router.refresh()` | NO |
| Base delete | `HomeContent.tsx` | `onSuccess → router.refresh()` | NO |
| Base create | `AppShell.tsx` | `mutateAsync chain → router.push` | NO |
| Row add (single) | `GridView.tsx` | `mutateAsync → pageCacheRef append` | YES (awaits then appends) |

### Pattern 1: React Query Cache Optimistic Update (for base/table/view/column)

Used for all mutations that modify data held in the React Query cache (queried via `useQuery`).

```typescript
// Source: tRPC docs (trpc.io/docs/client/react/useUtils) + create.t3.gg
const utils = api.useUtils();

const renameView = api.view.update.useMutation({
  onMutate: async ({ id, name }) => {
    // 1. Cancel any in-flight refetches so they don't overwrite the optimistic update
    await utils.view.getByTableId.cancel({ tableId });
    // 2. Snapshot current cache state for rollback
    const previous = utils.view.getByTableId.getData({ tableId });
    // 3. Optimistically update the cache
    utils.view.getByTableId.setData({ tableId }, (old) =>
      old?.map((v) => (v.id === id ? { ...v, name } : v))
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    // 4. Rollback on error
    if (context?.previous) {
      utils.view.getByTableId.setData({ tableId }, context.previous);
    }
  },
  onSettled: () => {
    // 5. Sync with server after settle (success or error)
    void utils.view.getByTableId.invalidate({ tableId });
  },
});
```

### Pattern 2: Optimistic Add to List

```typescript
// Source: create.t3.gg, tRPC docs
const createView = api.view.create.useMutation({
  onMutate: async ({ tableId, name }) => {
    await utils.view.getByTableId.cancel({ tableId });
    const previous = utils.view.getByTableId.getData({ tableId });
    // Append a placeholder with a temp id
    const tempId = `temp-${Date.now()}`;
    utils.view.getByTableId.setData({ tableId }, (old) => [
      ...(old ?? []),
      { id: tempId, tableId, name, config: { filters: [], sorts: [], hiddenColumns: [], searchQuery: "" } },
    ]);
    return { previous, tempId };
  },
  onError: (_err, _vars, context) => {
    utils.view.getByTableId.setData({ tableId }, context?.previous);
  },
  onSuccess: (newView, _vars, context) => {
    // Replace temp item with real server item
    utils.view.getByTableId.setData({ tableId }, (old) =>
      old?.map((v) => (v.id === context?.tempId ? newView : v))
    );
    router.push(`/base/${baseId}/${tableId}/view/${newView.id}`);
  },
  onSettled: () => {
    void utils.view.getByTableId.invalidate({ tableId });
  },
});
```

### Pattern 3: Optimistic Delete from List

```typescript
// Source: create.t3.gg
const deleteView = api.view.delete.useMutation({
  onMutate: async ({ id }) => {
    await utils.view.getByTableId.cancel({ tableId });
    const previous = utils.view.getByTableId.getData({ tableId });
    utils.view.getByTableId.setData({ tableId }, (old) =>
      old?.filter((v) => v.id !== id)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    utils.view.getByTableId.setData({ tableId }, context?.previous);
  },
  onSettled: () => {
    void utils.view.getByTableId.invalidate({ tableId });
  },
});
```

### Pattern 4: Row Data — Direct pageCacheRef (already exists)

Row mutations must NOT use React Query cache (`setData`) because row data is stored in `pageCacheRef` (bypassed React Query infinite query). The existing pattern in `GridView.tsx` is correct and must be preserved:

```typescript
// Already implemented correctly in GridView.tsx — DO NOT change this pattern
const updateCell = api.row.update.useMutation({
  onMutate: ({ id, cells }) => {
    // Directly mutate pageCacheRef entries
    for (const [pageIdxStr, pageRows] of Object.entries(pageCacheRef.current)) {
      const rowIdx = pageRows.findIndex((r) => r.id === id);
      if (rowIdx !== -1) {
        // ... direct ref mutation + forceUpdate()
        return { pageIdx, rowIdx, prevCells };
      }
    }
  },
  onError: (_err, _vars, context) => {
    // Restore from snapshot in context
    if (context) { /* ... */ }
  },
});
```

### Pattern 5: HomeContent Base List — Switch from router.refresh() to useQuery + setData

`HomeContent.tsx` currently receives `bases` as SSR props and has no client-side query. Mutations call `router.refresh()`, which is a full server round-trip. To enable optimistic updates, `HomeContent` needs:

1. Add `api.base.getAll.useQuery(undefined, { initialData: initialBases })` — this seeds the React Query cache from the SSR prop while also keeping the cache live.
2. Mutations switch to `utils.base.getAll.setData(undefined, updater)` in `onMutate`.

```typescript
// HomeContent.tsx pattern after migration
const { data: bases } = api.base.getAll.useQuery(undefined, {
  initialData: initialBases,
  staleTime: 30_000,
});

const renameBase = api.base.update.useMutation({
  onMutate: async ({ id, name }) => {
    await utils.base.getAll.cancel();
    const previous = utils.base.getAll.getData();
    utils.base.getAll.setData(undefined, (old) =>
      old?.map((b) => (b.id === id ? { ...b, name } : b))
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    utils.base.getAll.setData(undefined, context?.previous);
  },
  onSettled: () => {
    void utils.base.getAll.invalidate();
  },
});
```

### Anti-Patterns to Avoid

- **`router.refresh()` after mutations:** Full server round-trip; eliminates perceived performance benefit of tRPC. Replace with `invalidate()`.
- **`onSuccess → invalidate` without `onMutate → setData`:** Data only updates after server confirms. Adds 100-500ms visible delay.
- **Using `setData` for row data:** Row data is not in React Query cache. Use `pageCacheRef` directly.
- **Forgetting to cancel in-flight queries in `onMutate`:** In-flight refetches can overwrite the optimistic state right after you set it. Always `await utils.[path].cancel(...)` first.
- **Missing `onError` rollback:** If the mutation fails and no rollback is present, the UI shows an inconsistent optimistic state permanently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temporary IDs for optimistic creates | Custom UUID generator or incremental counter | `\`temp-${Date.now()}\`` string prefix | Simple and sufficient; gets replaced by real ID in `onSuccess` |
| Loading spinners to indicate pending mutations | Custom state | `mutation.isPending` already provided by `useMutation` | Already exists on every mutation object |
| Error toasts | Custom toast system | A toast library (e.g., `react-hot-toast`) | No toast system currently installed; phase should decide whether to add one or use `console.error` for rollback |

**Key insight:** The tRPC `useUtils` helpers already provide fully typed, procedure-scoped `setData`/`getData`/`cancel`/`invalidate`. There is no need for raw `queryClient.setQueryData` calls or custom cache management.

---

## Common Pitfalls

### Pitfall 1: HomeContent Has No Client Query (Missing Cache Entry)

**What goes wrong:** Calling `utils.base.getAll.setData(undefined, updater)` in `onMutate` before a `useQuery` has been called does nothing — there is no cache entry to update.

**Why it happens:** `HomeContent.tsx` receives `bases` as SSR props and never calls `api.base.getAll.useQuery`. The React Query cache entry for `base.getAll` doesn't exist in the client at runtime.

**How to avoid:** Convert `HomeContent` to call `api.base.getAll.useQuery(undefined, { initialData: initialBases })`. This seeds the cache from SSR data and makes `setData` effective.

**Warning signs:** `utils.base.getAll.getData()` returns `undefined` when called in `onMutate`.

---

### Pitfall 2: `onMutate` is Synchronous, but `cancel` Must be Awaited

**What goes wrong:** Writing the optimistic update before the `cancel` completes means an in-flight refetch can overwrite the optimistic state milliseconds later.

**Why it happens:** `cancel` wraps `queryClient.cancelQueries`, which is async (returns a Promise). If not awaited, the cancel may arrive after the optimistic `setData`.

**How to avoid:** Always `await utils.[path].cancel(input)` before calling `setData`.

---

### Pitfall 3: `setData` Updater Receives `undefined` (Empty Cache)

**What goes wrong:** The updater function receives `undefined` when the cache is empty or has been cleared, causing a runtime error (`Cannot read properties of undefined`).

**Why it happens:** Between SSR render and client hydration, or after a manual invalidate, the cache entry may be `undefined`.

**How to avoid:** Guard with `old ?? []` in all list updaters:
```typescript
utils.view.getByTableId.setData({ tableId }, (old) =>
  [...(old ?? []), newItem]
);
```

---

### Pitfall 4: Temp ID Leak After Optimistic Create

**What goes wrong:** If `onSuccess` or `onSettled` don't replace the temp item, the list contains a fake item with a `temp-` ID that cannot be navigated to or interacted with.

**Why it happens:** `onSuccess` is sometimes omitted when `onSettled → invalidate` is relied on exclusively. But `invalidate` triggers a refetch that may not return immediately, leaving a window where the temp ID is rendered.

**How to avoid:** Either (a) replace the temp item in `onSuccess` before `onSettled` triggers, or (b) rely purely on `onSettled → invalidate` and skip the temp-ID optimistic create. The simpler approach for `create` operations is: don't add a placeholder item; just show the real item after `onSuccess` via `invalidate`. The 50ms goal applies to rename/delete/update, not necessarily to creates (which navigate away).

**Implication for this phase:** Optimistic creates are optional (creates navigate away immediately). Optimistic renames, deletes, and updates are the priority.

---

### Pitfall 5: View Switch Still Shows "Loading…" (key={viewId} Forces Remount)

**What goes wrong:** `GridView` has `key={viewId}` on it in the view page. Switching views fully unmounts and remounts `GridView`, causing the `isInitialLoading` block to show "Loading..." while `columnsData` and `countData` fetch.

**Why it happens:** `key={viewId}` is intentional (clears local state on view switch), but it discards all React Query cache hints that would let the component skip the loading state.

**How to avoid — Option A:** Pre-warm the React Query cache entries for `column.getByTableId` and `row.count` for the *next* view when the user hovers over a view in `ViewsPanel`. Use `utils.column.getByTableId.prefetch({ tableId })` and `utils.row.count.prefetch(...)`.

**How to avoid — Option B:** Remove `isInitialLoading` guard (show columns/count immediately from any cached data) and use `keepPreviousData` (imported as a function from `@tanstack/react-query` per prior STATE.md decision) — but this is harder given the `key` remount.

**Recommendation:** Option A (hover-prefetch) is simpler and doesn't require changing the `key={viewId}` architecture decision.

---

### Pitfall 6: Opening a Base Still Has Server Redirect Latency

**What goes wrong:** `/base/[baseId]/page.tsx` is a server component that fetches tables + views, then calls `redirect(...)`. The redirect adds a server round-trip before any view renders.

**Why it happens:** The base index page design uses SSR redirect. There is no client-side equivalent.

**How to avoid:** Convert the base index page to a client component that reads `table.getByBaseId` from the React Query cache (pre-warmed from `TableTabBar` which already calls `api.table.getByBaseId.useQuery`) and navigates client-side without a server redirect. Alternatively, keep SSR redirect but pre-warm on the home page link hover so the data is in cache when the user clicks.

**Implication:** This is a harder change (Next.js App Router architecture). The success criterion says "navigates immediately to first table without loading skeleton" — this may require client-side navigation via `router.push` instead of SSR redirect.

---

## Code Examples

Verified patterns from official sources:

### Full Optimistic Rename Pattern (tRPC v11 + React Query v5)
```typescript
// Source: trpc.io/docs/client/react/useUtils, create.t3.gg/en/usage/trpc
const utils = api.useUtils();

const renameTable = api.table.update.useMutation({
  onMutate: async ({ id, name }) => {
    await utils.table.getByBaseId.cancel({ baseId });
    const previous = utils.table.getByBaseId.getData({ baseId });
    utils.table.getByBaseId.setData({ baseId }, (old) =>
      old?.map((t) => (t.id === id ? { ...t, name } : t)) ?? []
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous !== undefined) {
      utils.table.getByBaseId.setData({ baseId }, context.previous);
    }
  },
  onSettled: () => {
    void utils.table.getByBaseId.invalidate({ baseId });
  },
});
```

### Full Optimistic Delete Pattern
```typescript
// Source: create.t3.gg/en/usage/trpc
const deleteTable = api.table.delete.useMutation({
  onMutate: async ({ id }) => {
    await utils.table.getByBaseId.cancel({ baseId });
    const previous = utils.table.getByBaseId.getData({ baseId });
    utils.table.getByBaseId.setData({ baseId }, (old) =>
      old?.filter((t) => t.id !== id) ?? []
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous !== undefined) {
      utils.table.getByBaseId.setData({ baseId }, context.previous);
    }
  },
  onSettled: async () => {
    await utils.table.getByBaseId.invalidate({ baseId });
    router.push(`/base/${baseId}`);
  },
});
```

### Column Create — Optimistic Append
```typescript
// Column create already knows tableId in closure scope (GridView.tsx)
const createColumn = api.column.create.useMutation({
  onMutate: async ({ tableId, name, type }) => {
    await utils.column.getByTableId.cancel({ tableId });
    const previous = utils.column.getByTableId.getData({ tableId });
    const tempCol = {
      id: `temp-${Date.now()}`,
      tableId,
      name,
      type,
      order: (previous?.length ?? 0),
      isPrimary: false,
    };
    utils.column.getByTableId.setData({ tableId }, (old) => [...(old ?? []), tempCol]);
    return { previous };
  },
  onError: (_err, _vars, context) => {
    utils.column.getByTableId.setData({ tableId }, context?.previous);
  },
  onSettled: () => {
    void utils.column.getByTableId.invalidate({ tableId });
  },
});
```

### Column Delete — Optimistic Remove
```typescript
// In GridView.tsx — replaces the existing onSuccess-only pattern
const deleteColumn = api.column.delete.useMutation({
  onMutate: async ({ id }) => {
    await utils.column.getByTableId.cancel({ tableId });
    const previous = utils.column.getByTableId.getData({ tableId });
    utils.column.getByTableId.setData({ tableId }, (old) =>
      old?.filter((c) => c.id !== id) ?? []
    );
    // Clear page cache too — cell structure changes
    pageCacheRef.current = {};
    loadingPagesRef.current = new Set();
    return { previous };
  },
  onError: (_err, _vars, context) => {
    utils.column.getByTableId.setData({ tableId }, context?.previous);
    pageCacheRef.current = {};
    loadingPagesRef.current = new Set();
    forceUpdate();
  },
  onSettled: () => {
    void utils.column.getByTableId.invalidate({ tableId });
    void fetchPage(0);
  },
});
```

### HomeContent — Switch to useQuery + Optimistic Base Rename
```typescript
// HomeContent.tsx — replace props-only approach
const { data: bases = initialBases } = api.base.getAll.useQuery(undefined, {
  initialData: initialBases,
  staleTime: 30_000,
});

const renameBase = api.base.update.useMutation({
  onMutate: async ({ id, name }) => {
    await utils.base.getAll.cancel();
    const previous = utils.base.getAll.getData();
    utils.base.getAll.setData(undefined, (old) =>
      old?.map((b) => (b.id === id ? { ...b, name } : b)) ?? []
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    utils.base.getAll.setData(undefined, context?.previous);
  },
  onSettled: () => {
    void utils.base.getAll.invalidate();
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `router.refresh()` after mutations | `utils.invalidate()` + `setData` optimistic | React Query v5 / tRPC v11 era | Eliminates full server-round-trip for UI update |
| Manual `queryClient.setQueryData([key, input], updater)` with raw query keys | `utils.[router].[procedure].setData(input, updater)` — fully typed | tRPC v10+ | Type safety; no key string mismatch bugs |
| `isLoading` from React Query v4 | `isPending` (React Query v5 renamed it) | RQ v5.0 | `isLoading` still exists but is narrower |
| `keepPreviousData: true` option | `import { keepPreviousData } from '@tanstack/react-query'` as a `placeholderData` value | RQ v5.0 | Already documented in project STATE.md |

**Deprecated/outdated:**
- `router.refresh()` after mutations: This triggers a full Next.js server re-render. Replaced by `invalidate()`.
- `onSuccess → invalidate` only: Missing the `onMutate → setData` step means no optimistic update; visible delay remains.

---

## Open Questions

1. **Error toast system**
   - What we know: No toast library is currently installed. Rollback must be communicated to users somehow per success criterion 7.
   - What's unclear: Whether to install `react-hot-toast`, `sonner`, or use a custom inline error state.
   - Recommendation: Install `sonner` (commonly used in T3 stack projects) or `react-hot-toast` (lighter). Show error toast in `onError` callbacks. Planner should decide as a task item.

2. **Opening a base — eliminating the SSR redirect**
   - What we know: `/base/[baseId]/page.tsx` does SSR redirect after fetching tables+views. This adds ~200ms+ latency.
   - What's unclear: Whether converting to client-side navigation breaks any caching or prefetching guarantees in Next.js 15 App Router.
   - Recommendation: Keep SSR redirect for now (success criterion 6 says "without a loading skeleton" — the redirect itself doesn't show a skeleton, it just has latency). Consider pre-warming via `utils.table.getByBaseId.prefetch` on base card hover as a lighter-weight improvement.

3. **View switch — is `key={viewId}` with hover-prefetch sufficient for "no loading flash"?**
   - What we know: `key={viewId}` forces full remount; `isInitialLoading` shows "Loading..." until `columnsData` and `countData` resolve.
   - What's unclear: Whether hover-prefetch fills the cache in time given the `staleTime: 30_000` on the query client default.
   - Recommendation: Implement hover-prefetch in `ViewsPanel` (low risk). If flash persists, investigate removing `isInitialLoading` guard or lowering its threshold.

---

## Sources

### Primary (HIGH confidence)
- tRPC docs (trpc.io/docs/client/react/useUtils) — setData, getData, cancel, invalidate method signatures and optimistic update example
- create.t3.gg/en/usage/trpc — complete `onMutate/onError/onSettled` list CRUD examples
- Codebase inspection: `GridView.tsx`, `ViewsPanel.tsx`, `TableTabBar.tsx`, `HomeContent.tsx`, `AppShell.tsx` — all existing mutation patterns catalogued directly

### Secondary (MEDIUM confidence)
- TanStack Query v5 docs (tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) — `cancelQueries`, `getQueryData`, `setQueryData` lifecycle (verified to match tRPC wrapper patterns)

### Tertiary (LOW confidence)
- WebSearch results re: Next.js 15 App Router SSR + client query optimistic pattern — single-source, not verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all patterns already in use partially in codebase
- Architecture: HIGH — onMutate/setData/onError/onSettled pattern verified against multiple official sources; codebase patterns confirmed by direct inspection
- Pitfalls: HIGH for cache-empty guard, cancel-await order, HomeContent missing useQuery; MEDIUM for view-switch and base-open (navigation architecture)

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (stable patterns; tRPC v11 + RQ v5 is mature)
