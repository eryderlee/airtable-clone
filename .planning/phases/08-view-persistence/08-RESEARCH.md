# Phase 8: View Persistence - Research

**Researched:** 2026-03-18
**Domain:** tRPC + Drizzle ORM view config persistence; Next.js App Router URL state; React debounced auto-save
**Confidence:** HIGH (all findings from direct codebase inspection; no external library research required)

---

## Summary

Phase 8 is primarily an integration phase, not a library-discovery phase. The entire stack — tRPC, Drizzle, Zod, Next.js App Router, React — is already in place. The view schema (`airtable_view`) already exists with a `config` JSONB column storing `{ filters, sorts, hiddenColumns, searchQuery }`. The `view.updateConfig` tRPC mutation is already implemented with partial-merge semantics. The URL already contains `viewId` at `/base/[baseId]/[tableId]/view/[viewId]`.

The core work is wiring: `GridView` currently initializes `filters`, `sorts`, `hiddenColumns`, and `searchInput` as empty local `useState`. Phase 8 must seed those states from the view config loaded from the DB, then auto-save changes back via debounced calls to `view.updateConfig`. Additionally, the `ViewsPanel` needs rename and delete actions (the `view.update` and `view.delete` tRPC mutations are already implemented but not exposed in the UI).

The key architectural constraint from Phase 6 is that **search is client-side highlight only**. The `searchQuery` field exists in the DB schema and in `view.updateConfig`, but the Phase 6 decision removed search from row fetching. The planner must decide: persist `searchQuery` to DB (user sees last search on reload) or treat it as ephemeral. This is an open question.

**Primary recommendation:** Seed toolbar state from `view.getByTableId` on mount; auto-save with 800ms debounce via `view.updateConfig`; expose rename (double-click, using existing `InlineEdit` component) and delete (with confirmation) in `ViewsPanel`; guard delete to prevent removing the last view.

---

## Standard Stack

All libraries are already installed. No new packages needed.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 8 |
|---------|---------|---------|-----------------|
| tRPC `@trpc/react-query` | 11.0.0 | API mutations | `view.updateConfig`, `view.update`, `view.delete` already exist |
| Drizzle ORM | 0.36.4 | DB access | `views` table with `config` JSONB already schema'd |
| Zod | 3.23.8 | Input validation | `view.updateConfig` input schema already written |
| Next.js | 15.0.0 | App Router | `viewId` URL param already in `/base/[baseId]/[tableId]/view/[viewId]` |
| React | 18.3.1 | State management | `useEffect` debounce pattern for auto-save |

### Supporting (already in use)
| Component | Location | Role |
|-----------|----------|------|
| `InlineEdit` | `src/components/ui/InlineEdit.tsx` | Ready-to-use double-click rename for view names |
| `ViewsPanel` | `src/components/nav/ViewsPanel.tsx` | Already has create + list; needs rename + delete |
| `GridView` | `src/components/grid/GridView.tsx` | State owner; needs seeding from view config |

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes
```
src/
├── server/
│   └── api/
│       └── routers/
│           └── view.ts          # Add view.getById procedure
├── components/
│   ├── grid/
│   │   └── GridView.tsx         # Seed state from view config; auto-save on change
│   └── nav/
│       └── ViewsPanel.tsx       # Add rename (InlineEdit) + delete (with guard)
└── app/
    └── (app)/
        └── base/[baseId]/[tableId]/view/[viewId]/
            └── page.tsx         # Pass initial view config as prop (optional SSR approach)
```

### Pattern 1: View Config Seeding on Mount

**What:** On `GridView` mount, fetch the active view's config and set `filters`, `sorts`, `hiddenColumns` from it. The view data is already fetched by `ViewsPanel` via `view.getByTableId`; `GridView` can fetch the same or receive config as a prop.

**When to use:** On every mount of `GridView` with a new `viewId`.

**Two approaches:**

**Option A — Client fetch in GridView (simpler):**
```typescript
// Source: direct codebase inspection (view.getByTableId already exists)
const { data: viewsData } = api.view.getByTableId.useQuery({ tableId });
const activeView = viewsData?.find(v => v.id === viewId);

// Seed state once when activeView first loads
const [initialized, setInitialized] = useState(false);
useEffect(() => {
  if (!activeView || initialized) return;
  setFilters(activeView.config.filters as FilterCondition[]);
  setSorts(activeView.config.sorts as SortCondition[]);
  setHiddenColumns(activeView.config.hiddenColumns);
  // searchQuery: decide whether to restore (see Open Questions)
  setInitialized(true);
}, [activeView, initialized]);
```

**Option B — SSR-seeded via page.tsx (no client waterfall):**
```typescript
// page.tsx (server component) fetches view config and passes as prop
const { tableId, viewId } = await params;
const views = await api.view.getByTableId({ tableId });
const activeView = views.find(v => v.id === viewId);
return <GridView tableId={tableId} viewId={viewId} initialConfig={activeView?.config} />;
```
Option B eliminates a client-side fetch waterfall; Option A is simpler but shows empty toolbar until data loads. **Recommend Option B** for correctness (no flash of empty toolbar).

**Critical:** The `initialized` flag (or equivalent) must reset when `viewId` changes (user switches views). Use `viewId` as a key on `GridView` or reset `initialized` in a `useEffect` watching `viewId`.

### Pattern 2: Debounced Auto-Save

**What:** Whenever `filters`, `sorts`, `hiddenColumns` change, debounce a call to `view.updateConfig`. Do not save on every keystroke.

**When to use:** On every state change to the persisted fields.

```typescript
// Source: direct codebase inspection (view.updateConfig partial-merge already implemented)
const updateConfig = api.view.updateConfig.useMutation();

// 800ms debounce: save filters/sorts/hiddenColumns to DB
useEffect(() => {
  if (!initialized) return; // don't save the seeded initial values
  const timer = setTimeout(() => {
    updateConfig.mutate({
      id: viewId,
      config: { filters, sorts, hiddenColumns },
    });
  }, 800);
  return () => clearTimeout(timer);
}, [filters, sorts, hiddenColumns, viewId, initialized]);
```

**Note:** `view.updateConfig` uses partial merge — sending `{ filters }` only updates filters, leaving `sorts` and `hiddenColumns` unchanged. Sending all three together is simpler and avoids race conditions where two separate debounced saves arrive out of order.

### Pattern 3: View Switching via URL

**What:** URL already contains `viewId`. Switching views = navigating to a new URL. `GridView` receives the new `viewId` prop and re-seeds from the new view config.

**The clean approach:** Put `key={viewId}` on `GridView` in the page. Next.js will unmount and remount the component, resetting all `useState` to defaults, then the mount effect seeds from the new view config.

```typescript
// page.tsx — viewId key forces full remount on view switch
return <GridView key={viewId} tableId={tableId} viewId={viewId} initialConfig={activeView?.config} />;
```

This eliminates complex "reset state when viewId changes" logic in GridView.

### Pattern 4: View Rename in ViewsPanel

**What:** Double-click a view name to enter rename mode. Uses the existing `InlineEdit` component.

```typescript
// Source: InlineEdit component already at src/components/ui/InlineEdit.tsx
const renameView = api.view.update.useMutation({
  onSuccess: () => void utils.view.getByTableId.invalidate({ tableId }),
});

// In ViewsPanel view list item:
<InlineEdit
  value={view.name}
  onSave={(name) => renameView.mutate({ id: view.id, name })}
  className="flex-1 truncate text-[13px]"
/>
```

### Pattern 5: View Delete with Guard

**What:** Delete button on each view item. Must prevent deleting the last view (table would be unnavigable).

```typescript
// Source: view.delete mutation already implemented in view.ts
const deleteView = api.view.delete.useMutation({
  onSuccess: async (deleted) => {
    await utils.view.getByTableId.invalidate({ tableId });
    // If deleted was active, redirect to first remaining view
    if (deleted.id === activeViewId) {
      const remaining = views?.filter(v => v.id !== deleted.id);
      if (remaining?.[0]) {
        router.push(`/base/${baseId}/${tableId}/view/${remaining[0].id}`);
      }
    }
  },
});

// Guard: disable delete when only one view remains
const canDelete = (views?.length ?? 0) > 1;
```

### Pattern 6: view.getById Procedure (if needed)

The current `view.getByTableId` returns all views for a table. For SSR seeding, this is fine (find by viewId client-side or server-side). A dedicated `view.getById` is not strictly required but would be cleaner for the page.tsx approach.

```typescript
// Add to view.ts if using Option B SSR seeding:
getById: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const result = await ctx.db
      .select()
      .from(views)
      .innerJoin(tables, eq(views.tableId, tables.id))
      .innerJoin(bases, eq(tables.baseId, bases.id))
      .where(and(eq(views.id, input.id), eq(bases.userId, ctx.session.user.id)))
      .limit(1);
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
    return result[0]!.airtable_view;
  }),
```

### Anti-Patterns to Avoid

- **Saving on every render:** Auto-save must be gated behind the `initialized` flag. Without this, the initial `useState([])` values will overwrite the DB config before the seeded values load.
- **Separate debounces per field:** Race condition — two debounced saves arrive out of order and the earlier one overwrites the later. Use a single debounce that saves all three fields together.
- **No guard on delete-last-view:** If the last view is deleted, `[tableId]/page.tsx` redirects to `views[0]?.id` which will be `undefined`, causing a broken URL.
- **Not resetting cache on view switch:** When `viewId` changes, filters/sorts change, which triggers the existing `resetCache()` effect in GridView. Using `key={viewId}` handles this automatically by unmounting/remounting GridView.
- **Saving searchInput instead of searchQuery:** `searchInput` is the immediate (unDebounced) value. Only the debounced `searchQuery` value (if saved at all) should be persisted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline rename | Custom double-click input | `InlineEdit` component (already exists) | Already handles focus, select-all, Enter/Escape, blur-to-save |
| Partial config update | Replace full config object | `view.updateConfig` partial merge (already implemented) | Avoids race conditions from concurrent field updates |
| View ownership check | Custom join | 3-level join already in `view.updateConfig`, `view.delete` | Already guards view -> table -> base -> userId |

**Key insight:** The DB schema, tRPC router, and ownership guards are already complete. Phase 8 is UI wiring, not backend work (except possibly adding `view.getById`).

---

## Common Pitfalls

### Pitfall 1: Saving Initial Empty State to DB

**What goes wrong:** `GridView` mounts with `filters = []`, `sorts = []`, `hiddenColumns = []`. The auto-save `useEffect` fires immediately and writes empty config to the DB, erasing the stored view config before the fetch returns.

**Why it happens:** The debounced save effect runs on first render if not gated.

**How to avoid:** Gate the debounced save behind `initialized` flag. Only start saving after the seed effect has run and set `initialized = true`.

**Warning signs:** View config is always empty after reload; filter panel shows no rules even though they were saved.

### Pitfall 2: Stale Config When Switching Views

**What goes wrong:** User switches from View A (with filters) to View B (no filters). `GridView` keeps the View A filter state because `viewId` prop changed but `useState` values didn't reset.

**Why it happens:** React doesn't reset `useState` when props change, only on unmount/remount.

**How to avoid:** Use `key={viewId}` on `GridView` in the page component. When `viewId` changes, React unmounts and remounts GridView, resetting all state to defaults, then the seed effect runs.

**Warning signs:** Switching views shows previous view's filters in the toolbar; row count is wrong.

### Pitfall 3: Delete Last View Leaves Broken URL

**What goes wrong:** User deletes the only view. Redirect logic finds `remaining[0]` is undefined and navigates to `/base/[baseId]/[tableId]/view/undefined`.

**Why it happens:** No guard prevents deleting the last view.

**How to avoid:** Disable the delete button when `views.length <= 1`. Add a visual indicator ("Can't delete the only view").

**Warning signs:** App shows blank page or 404 after deleting the last view.

### Pitfall 4: view.getByTableId Race with getByOffset

**What goes wrong:** `GridView` mounts, seeds filters from view config, and immediately fires `getByOffset`. But `getByOffset` uses the pre-seed empty filters (from the initial render before seeding) and loads unfiltered rows. When the seed then applies filters, cache is invalidated and rows reload — causing a double-fetch.

**Why it happens:** React batches renders but the initial `getByOffset` call uses the pre-seed state.

**How to avoid:** With SSR seeding (Option B page.tsx), `initialConfig` props are available on first render, so `useState` can be initialized directly: `useState(initialConfig?.filters ?? [])`. No seed effect needed; no race.

**Warning signs:** On load with an active view config, rows load twice (visible as two network requests to `row.getByOffset`).

### Pitfall 5: searchQuery Persistence Decision Not Made

**What goes wrong:** `searchQuery` field is in the DB schema and `updateConfig` accepts it, but the Phase 6 decision made search client-side only. If search is auto-saved, users get their last search restored on reload — surprising behavior. If not saved, the DB field stays as empty string forever.

**Why it happens:** The Phase 6 decision was "search does not filter rows at DB level" but didn't explicitly decide whether to persist the search string.

**How to avoid:** Decision needed (see Open Questions). The safe default is **do not persist searchQuery** — restore it as `""` always, matching user expectations for search as a transient UI state.

**Warning signs:** Users confused when search query persists across reloads; or confusion if the DB field is always `""` and the plan says it should be persisted.

---

## Code Examples

### Existing view.updateConfig (already implemented)
```typescript
// Source: src/server/api/routers/view.ts lines 115-169
// Partial merge: only overwrites fields that are provided (not undefined)
updateConfig: protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
    config: z.object({
      filters: z.array(z.any()).optional(),
      sorts: z.array(z.any()).optional(),
      hiddenColumns: z.array(z.string().uuid()).optional(),
      searchQuery: z.string().optional(),
    }),
  }))
  .mutation(async ({ ctx, input }) => {
    // ... 3-level ownership check ...
    const mergedConfig = {
      ...currentView.config,
      ...Object.fromEntries(
        Object.entries(input.config).filter(([, v]) => v !== undefined),
      ),
    };
    // ... update ...
  }),
```

### Existing view schema config type
```typescript
// Source: src/server/db/schema.ts lines 213-226
config: jsonb("config")
  .$type<{
    filters: unknown[];
    sorts: unknown[];
    hiddenColumns: string[];
    searchQuery: string;
  }>()
  .default({ filters: [], sorts: [], hiddenColumns: [], searchQuery: "" })
  .notNull(),
```

### Existing FilterCondition / SortCondition types
```typescript
// Source: src/server/api/routers/row.ts lines 41-42
export type FilterCondition = z.infer<typeof filterConditionSchema>;
export type SortCondition = z.infer<typeof sortConditionSchema>;
// These are the exact types stored in view.config.filters and view.config.sorts
```

### Existing InlineEdit component API
```typescript
// Source: src/components/ui/InlineEdit.tsx
// Props: value: string, onSave: (newValue: string) => void, className?: string
// Behavior: shows span, double-click to edit, Enter/blur to save, Escape to cancel
<InlineEdit value={view.name} onSave={(name) => renameView.mutate({ id: view.id, name })} />
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| Empty toolbar state on every load | Seed from DB view config on mount | Phase 8 implements this |
| `filters/sorts/hiddenColumns` as ephemeral React state | Same state, auto-saved to DB on change | Phase 8 implements this |
| `ViewsPanel` has create only | `ViewsPanel` has create + rename + delete | Phase 8 adds rename + delete |
| `view.update` (rename) and `view.delete` exist but unused in UI | Exposed in ViewsPanel | Phase 8 wires this |

**Already done (no work needed):**
- `views` DB table with `config` JSONB: done
- `view.getByTableId`, `view.create`, `view.update`, `view.updateConfig`, `view.delete` tRPC procedures: done
- URL contains `viewId`: done (`/base/[baseId]/[tableId]/view/[viewId]`)
- `TableIndexPage` redirects to first view: done
- Ownership checks (3-level join): done in all view mutations
- `InlineEdit` component: done, ready to use

---

## Open Questions

1. **Should `searchQuery` be persisted to the DB?**
   - What we know: The DB column exists, `updateConfig` accepts it, Phase 6 made search client-side only (not filtering rows at DB level)
   - What's unclear: Is restoring last search on reload desirable UX? Airtable does NOT persist search across reloads.
   - Recommendation: **Do not persist searchQuery.** Keep it ephemeral (always restored as `""`). The DB field can stay in the schema for potential future use but Phase 8 should not write to it.

2. **SSR seeding (Option B) vs client seeding (Option A)?**
   - What we know: Option B requires `view.getById` or using `api` server caller in `page.tsx` (already done for the table index page). Option A is simpler but causes a flash of empty toolbar.
   - What's unclear: Whether the flash is perceptible given tRPC's fast response times.
   - Recommendation: **Use Option B (SSR seeding via page.tsx props)** to eliminate the race condition and the double-fetch pitfall. `page.tsx` is already a server component and uses `api` server caller.

3. **`updatedAt` conflict detection for multi-tab scenarios (from roadmap)?**
   - What we know: The `views` table has NO `updatedAt` column (confirmed by schema inspection). `bases` has one but not `views`.
   - What's unclear: The roadmap mentions "updatedAt conflict detection for multi-tab scenarios" for plan 08-01.
   - Recommendation: **Add `updatedAt` to the views schema** if conflict detection is required, or **skip conflict detection** for Phase 8 as a simplification. Last-write-wins is acceptable for single-user view config. Adding `updatedAt` requires a DB migration (`drizzle-kit generate && migrate`).

4. **Auto-save debounce timing?**
   - What we know: GridView uses 300ms for search debounce. The existing `bases.touch` mutation fires on navigation with no debounce.
   - Recommendation: Use **800ms debounce** for view config auto-save. Long enough to avoid a save mid-interaction (e.g., user dragging between filter operators) but short enough to feel responsive.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/server/db/schema.ts` — views table schema; confirmed `config` JSONB with `filters`, `sorts`, `hiddenColumns`, `searchQuery` fields; confirmed NO `updatedAt` on views
- `src/server/api/routers/view.ts` — all view procedures: `getByTableId`, `create`, `update`, `updateConfig`, `delete`; partial-merge semantics confirmed
- `src/components/grid/GridView.tsx` — current toolbar state: `filters`, `sorts`, `hiddenColumns`, `searchInput/searchQuery` all as local `useState`; confirmed no persistence
- `src/components/nav/ViewsPanel.tsx` — current UI: create + list only; no rename or delete
- `src/components/ui/InlineEdit.tsx` — existing InlineEdit component API
- `src/server/api/routers/row.ts` — `FilterCondition`, `SortCondition` type exports; `getByOffset` input schema (no viewId param — filters/sorts passed directly)
- `src/app/(app)/base/[baseId]/[tableId]/view/[viewId]/page.tsx` — URL structure confirmed; viewId passed to GridView
- `src/app/(app)/base/[baseId]/[tableId]/page.tsx` — redirect to first view confirmed

### No external research needed
This phase uses only libraries and patterns already established in the codebase. No new libraries, no documentation lookups required.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; versions confirmed from package.json
- Architecture: HIGH — patterns derived from existing code in the repo; confirmed by reading source files
- Pitfalls: HIGH — derived from reading actual code paths; not speculative

**Research date:** 2026-03-18
**Valid until:** Stable — architecture is established; no fast-moving dependencies relevant to this phase
