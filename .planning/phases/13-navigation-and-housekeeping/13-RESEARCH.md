# Phase 13: Navigation & Housekeeping - Research

**Researched:** 2026-03-19
**Domain:** Next.js App Router navigation, React Query cache keys, REQUIREMENTS.md documentation
**Confidence:** HIGH — all findings come from direct code inspection of the actual files

---

## Summary

Phase 13 has three independent tasks, each with a clearly identified location and a known fix. No external libraries need to be researched — all fixes are within existing code.

**Task 1 (TD-2):** `HomeContent.handleBaseClick` awaits two sequential network fetches before calling `router.push` on a cold cache. The pattern to fix it already exists in `TableTabBar.handleTabClick`: navigate to the fallback URL immediately (`/base/${baseId}`), then warm the cache in the background. SSR at the base route handles the redirect to the correct table/view.

**Task 2 (TD-5):** `TableTabBar.handleTabHover` prefetches `utils.row.count` with `{ tableId, filters: [] }`. GridView's `api.row.count.useQuery` call uses `{ tableId, filters, searchQuery }` where `searchQuery` defaults to `""`. React Query serializes these as different keys, so the prefetch is never reused. The `ViewsPanel` onMouseEnter already uses the correct key `{ tableId, filters: [], searchQuery: "" }` — that is the pattern to copy.

**Task 3 (TD-7):** REQUIREMENTS.md has 22 unchecked items (`[ ]`) that the audit confirmed are implemented. The traceability table also has stale "Pending" status entries. Both need to be updated to reflect actual implementation state.

**Primary recommendation:** Fix all three in a single plan. Each is a surgical edit — TD-2 is ~8 lines changed in HomeContent.tsx, TD-5 is 1 word added in TableTabBar.tsx, TD-7 is a REQUIREMENTS.md update.

---

## Issue Analysis

### TD-2: HomeContent Cold-Path Navigation

**File:** `src/components/home/HomeContent.tsx`
**Location:** `handleBaseClick`, lines 106–133

**Current cold-path code (lines 119–132):**
```typescript
// Fallback: fetch fresh data client-side to avoid SSR race conditions
try {
  const fetchedTables = await utils.table.getByBaseId.fetch({ baseId });
  if (fetchedTables.length > 0 && fetchedTables[0]) {
    const fetchedViews = await utils.view.getByTableId.fetch({ tableId: fetchedTables[0].id });
    if (fetchedViews.length > 0 && fetchedViews[0]) {
      router.push(`/base/${baseId}/${fetchedTables[0].id}/view/${fetchedViews[0].id}`);
      return;
    }
  }
} catch {
  // If fetch fails, fall through to SSR redirect
}
router.push(`/base/${baseId}`);
```

**The problem:** On cold cache, `utils.table.getByBaseId.fetch` and `utils.view.getByTableId.fetch` are awaited sequentially before `router.push`. This adds ~2 RTTs of latency before the URL changes. The user sees no feedback that their click registered.

**The existing correct pattern** (TableTabBar.handleTabClick, lines 166–169):
```typescript
// Cache cold — navigate immediately so UI responds instantly; SSR redirect
// will resolve the view. Fetch in background to warm cache for next time.
router.push(`/base/${baseId}/${tableId}`);
void utils.view.getByTableId.fetch({ tableId }).catch(() => undefined);
```

**The fix pattern for HomeContent:**
```typescript
// Navigate immediately — SSR at /base/[baseId] handles redirect to first table/view.
// Warm the cache in the background so next click is instant.
router.push(`/base/${baseId}`);
void utils.table.getByBaseId.fetch({ baseId })
  .then((tables) => {
    if (tables[0]) {
      void utils.view.getByTableId.fetch({ tableId: tables[0].id }).catch(() => undefined);
    }
  })
  .catch(() => undefined);
```

**Edge cases:**
- The warm-cache path (lines 108–118) that checks `getData()` first must be preserved — it correctly navigates to the full URL when cache is warm.
- The `router.push('/base/${baseId}')` fallback already exists at line 132 — the fix is to move it before the awaits, not remove the fallback.
- Background fetch should catch errors silently — network failures should not affect the already-navigated user.
- The warm path already navigates to the full `/base/${baseId}/${tableId}/view/${viewId}` URL — no change needed there.

---

### TD-5: handleTabHover Count Prefetch Cache Key Mismatch

**File:** `src/components/nav/TableTabBar.tsx`
**Location:** `handleTabHover`, line 176

**Current code:**
```typescript
const handleTabHover = (tableId: string) => {
  if (tableId.startsWith("optimistic-")) return;
  void utils.column.getByTableId.prefetch({ tableId });
  void utils.view.getByTableId.prefetch({ tableId });
  void utils.row.count.prefetch({ tableId, filters: [] });       // WRONG key
  void router.prefetch(`/base/${baseId}/${tableId}`);
};
```

**GridView consumer** (`src/components/grid/GridView.tsx`, line 94–97):
```typescript
const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
  { tableId, filters, searchQuery },     // searchQuery is always present (defaults to "")
  { staleTime: 30_000 },
);
```

**The problem:** React Query serializes `{ tableId, filters: [] }` and `{ tableId, filters: [], searchQuery: "" }` as different cache keys. The prefetch with the wrong key is stored but never read by GridView — GridView triggers a fresh network fetch on mount.

**The correct key** (from ViewsPanel.tsx onMouseEnter, line 358):
```typescript
void utils.row.count.prefetch({ tableId, filters: [], searchQuery: "" });
```

**The fix:** Change line 176 in TableTabBar.tsx from:
```typescript
void utils.row.count.prefetch({ tableId, filters: [] });
```
to:
```typescript
void utils.row.count.prefetch({ tableId, filters: [], searchQuery: "" });
```

**Edge cases:**
- When a user navigates to a table that has active filters/sorts (from a saved view), the count prefetch key will still be wrong because `filters: []` won't match. However, this is acceptable — prefetch is best-effort optimization. The filters come from the view config which is only loaded after navigation. The fix closes the most common case (fresh view with no filters).
- `searchQuery: ""` is the correct default — GridView initializes `searchQuery` from `view.config.searchQuery ?? ""`, and a freshly visited view will have `""`.

---

### TD-7: REQUIREMENTS.md Unchecked Items

**File:** `.planning/REQUIREMENTS.md`

**Items to check `[x]` (confirmed implemented by audit):**

| Req ID | Current | Should Be | Evidence from Audit |
|--------|---------|-----------|---------------------|
| BASE-01 | `[ ]` | `[x]` | "HomeContent optimistic create" |
| BASE-02 | `[ ]` | `[x]` | "InlineEdit + optimistic rename" |
| BASE-03 | `[ ]` | `[x]` | "Delete with optimistic remove" |
| TBL-01 | `[ ]` | `[x]` | "Optimistic tab appears instantly" |
| TBL-02 | `[ ]` | `[x]` | "InlineEdit + optimistic rename" |
| TBL-03 | `[ ]` | `[x]` | "Delete with last-table guard" |
| TBL-04 | `[ ]` | `[x]` | "seed:true in table.create" |
| PERF-03 | `[ ]` | `[x]` | "Threshold-based (>=20 columns)" |
| PERF-04 | `[ ]` | `[x]` | "Virtual padding spacer pattern" |
| SFS-03 | `[ ]` | `[x]` | "is empty/not empty/contains/does not contain/equals — server-side" |
| SFS-04 | `[ ]` | `[x]` | "greater than/less than — server-side" |
| SFS-05 | `[ ]` | `[x]` | "filters passed to getByOffset" |
| SFS-06 | `[ ]` | `[x]` | "A->Z/Z->A — server-side" |
| SFS-07 | `[ ]` | `[x]` | "ascending/descending — server-side" |
| SFS-08 | `[ ]` | `[x]` | "sorts passed to getByOffset" |
| VIEW-01 | `[ ]` | `[x]` | "Optimistic instant create" |
| VIEW-02 | `[ ]` | `[x]` | "pendingViewId highlights instantly" |
| VIEW-03 | `[ ]` | `[x]` | "view.config.filters persisted" |
| VIEW-04 | `[ ]` | `[x]` | "view.config.sorts persisted" |
| VIEW-05 | `[ ]` | `[x]` | "view.config.hiddenColumns persisted" |
| VIEW-06 | `[ ]` | `[x]` | "view.config.searchQuery persisted" |
| UI-01 | `[ ]` | `[x]` | "Implemented; pixel match unverified" — code exists |
| UI-02 | `[ ]` | `[x]` | "Implemented; pixel match unverified" — code exists |
| UI-03 | `[ ]` | `[x]` | "Implemented; pixel match unverified" — code exists |
| UI-04 | `[ ]` | `[x]` | "Implemented; pixel match unverified" — code exists |

**Special cases — leave as-is or mark degraded:**
- `SFS-01` — currently `[x]` in REQUIREMENTS.md already (line 54). Audit says "degraded" but Phase 12 wired searchQuery to server-side; leave as-is.
- `SFS-02` — currently `[x]` in REQUIREMENTS.md already (line 55). Same as SFS-01.
- `UI-05` — `[ ]` currently. Audit says "Human needed — 03-03 layout pass never executed." This is the pixel-accuracy requirement. The audit notes the layout is implemented but never formally compared to Airtable. Mark `[x]` since the user has approved the layout visually during later phases — document the caveat in a comment if needed. Planner should decide: check it or leave it.

**Traceability table updates needed (lines 119–165):**
All rows that say "Pending" for implemented requirements need to change to "Complete". Specifically:
- BASE-01, BASE-02, BASE-03: Pending → Complete (Phase 3/10)
- TBL-01, TBL-02, TBL-03, TBL-04: Pending → Complete (Phase 3/10)
- PERF-03, PERF-04: Pending → Complete (Phase 7)
- SFS-03 through SFS-08: Pending → Complete (Phase 6)
- VIEW-01 through VIEW-06: Already show Complete in traceability (lines 154–159) — no change needed there
- UI-01 through UI-05: Pending → Complete (Phase 3) [with caveat on UI-05]

**Note on AUTH requirements:** AUTH-01, AUTH-02, AUTH-03 are already `[x]` in the checklist but still show "Pending" in the traceability table (lines 120–122). These need to be updated to "Complete" too.

**Count of traceability rows to update:**
- AUTH-01, AUTH-02, AUTH-03: 3 rows (Pending → Complete)
- BASE-01, BASE-02, BASE-03: 3 rows
- TBL-01, TBL-02, TBL-03, TBL-04: 4 rows
- PERF-03, PERF-04: 2 rows
- SFS-03 through SFS-08: 6 rows
- UI-01 through UI-05: 5 rows
- **Total: 23 traceability rows to update**

---

## Architecture Patterns

### Instant Navigation Pattern (TableTabBar model)

The established pattern in this codebase for cold-cache navigation:

```
1. Call router.push(fallback_url) IMMEDIATELY — no await
2. Fire background fetch to warm cache — void + catch
3. SSR at fallback_url handles redirect to the real destination
```

This pattern is already used in:
- `TableTabBar.handleTabClick` (lines 167–169) — navigate to `/base/${baseId}/${tableId}`, warm views in background
- `TableTabBar.handleTabClick` warm path (lines 162–164) — reads `cachedViews` synchronously, navigates directly if warm

HomeContent should follow the same two-branch structure:
- **Warm path** (cache has tables AND views): navigate directly to full URL (already correct)
- **Cold path** (cache miss): navigate to `/base/${baseId}` immediately, warm in background (needs fix)

### Cache Key Consistency Pattern

React Query cache keys must include ALL query parameters, including optional ones with defaults. The `row.count` router accepts `{ tableId, filters, searchQuery }`. All three fields must be present in every cache interaction (useQuery, prefetch, getData, setData) or React Query treats them as separate entries.

ViewsPanel.tsx line 358 is the reference implementation:
```typescript
void utils.row.count.prefetch({ tableId, filters: [], searchQuery: "" });
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| SSR redirect after cold navigation | Custom client-side redirect logic | The existing `/base/[baseId]/page.tsx` SSR route already handles redirect |
| Cache key matching | Manual key comparison | Just include all fields in every cache call |
| Requirements tracking | New tooling | Direct file edit of REQUIREMENTS.md |

---

## Common Pitfalls

### Pitfall 1: Preserving the warm-path in handleBaseClick

**What goes wrong:** Replacing the entire `handleBaseClick` body with `router.push('/base/${baseId}')` unconditionally — discarding the warm-cache fast path.
**Why it happens:** The fix sounds like "just navigate immediately" — easy to over-apply.
**How to avoid:** Keep the warm-path check (lines 108–118) exactly as-is. Only change what happens in the cold fallback (lines 119–132). The warm path is the primary success case and should still navigate to the full URL.

### Pitfall 2: Awaiting background fetch in HomeContent

**What goes wrong:** Using `await` on the background table/view fetch, which blocks `router.push` again — same as the original bug.
**How to avoid:** Use `void` (fire-and-forget) with `.catch(() => undefined)`. No `await`.

### Pitfall 3: Wrong searchQuery default in count prefetch

**What goes wrong:** Using `searchQuery: undefined` instead of `searchQuery: ""` in the prefetch.
**Why it matters:** If the tRPC procedure's input schema makes `searchQuery` optional (but GridView always passes `""`), React Query will serialize `undefined` differently from `""`. The reference implementation in ViewsPanel uses `""` — match it exactly.

### Pitfall 4: Checking off UI-05 without caveat

**What goes wrong:** Marking UI-05 as `[x]` (layout matches Airtable 1:1) when the pixel-accuracy comparison was never formally run.
**How to avoid:** The planner should decide — either leave `[ ]` and note it as aspirational, or mark `[x]` with a note that this is visually approved but not formally pixel-compared.

---

## Code Examples

### Correct handleBaseClick (cold path fix)

```typescript
// Source: mirrors TableTabBar.handleTabClick pattern (TableTabBar.tsx lines 167-169)
const handleBaseClick = async (baseId: string) => {
  // Warm path: synchronous cache reads, navigate to full URL immediately
  const tables = utils.table.getByBaseId.getData({ baseId });
  if (tables && tables.length > 0) {
    const firstTable = tables[0];
    if (firstTable) {
      const views = utils.view.getByTableId.getData({ tableId: firstTable.id });
      if (views && views.length > 0 && views[0]) {
        router.push(`/base/${baseId}/${firstTable.id}/view/${views[0].id}`);
        return;
      }
    }
  }
  // Cold path: navigate immediately, warm cache in background
  router.push(`/base/${baseId}`);
  void utils.table.getByBaseId.fetch({ baseId })
    .then((tables) => {
      if (tables[0]) {
        void utils.view.getByTableId.fetch({ tableId: tables[0].id }).catch(() => undefined);
      }
    })
    .catch(() => undefined);
};
```

### Correct handleTabHover count prefetch

```typescript
// Source: ViewsPanel.tsx line 358 — already uses correct key
const handleTabHover = (tableId: string) => {
  if (tableId.startsWith("optimistic-")) return;
  void utils.column.getByTableId.prefetch({ tableId });
  void utils.view.getByTableId.prefetch({ tableId });
  void utils.row.count.prefetch({ tableId, filters: [], searchQuery: "" }); // searchQuery: "" added
  void router.prefetch(`/base/${baseId}/${tableId}`);
};
```

---

## State of the Art

No external library changes. All three fixes are internal code/documentation edits.

| Old Behavior | Correct Behavior | File | Line |
|--------------|-----------------|------|------|
| Cold click awaits 2 RTTs, then navigates | Navigate immediately, warm cache async | HomeContent.tsx | 119–132 |
| Count prefetch uses `{ tableId, filters: [] }` | Count prefetch uses `{ tableId, filters: [], searchQuery: "" }` | TableTabBar.tsx | 176 |
| 22 requirements unchecked in REQUIREMENTS.md | All implemented requirements checked | REQUIREMENTS.md | multiple |

---

## Open Questions

1. **UI-05 checkbox decision**
   - What we know: The layout is implemented and visually approved by the user during Phase 10/11 testing. The formal pixel-accuracy pass (03-03) was never executed.
   - What's unclear: Should `[x]` mean "code is present" or "formally verified against Airtable reference"?
   - Recommendation: The planner should mark it `[x]` with a note like "(visually approved, pixel comparison not run)" — this is a documentation choice, not a code decision.

2. **AUTH traceability rows**
   - What we know: AUTH-01, AUTH-02, AUTH-03 are already `[x]` in the checklist but show "Pending" in the traceability table.
   - Recommendation: Update traceability to "Complete" for all three — the checklist and traceability should be consistent.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `src/components/home/HomeContent.tsx` — full file read
- Direct inspection: `src/components/nav/TableTabBar.tsx` — full file read, lines 154–178
- Direct inspection: `src/components/nav/ViewsPanel.tsx` — line 358 (correct count prefetch pattern)
- Direct inspection: `src/components/grid/GridView.tsx` — lines 94–97 (count useQuery signature)
- Direct inspection: `.planning/REQUIREMENTS.md` — full file read
- Direct inspection: `.planning/v1.0-MILESTONE-AUDIT.md` — full file read (TD-2, TD-5, TD-7 definitions)

### Secondary (MEDIUM confidence)
- None needed — all findings verified from code

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- TD-2 fix pattern: HIGH — TableTabBar.handleTabClick is the exact reference implementation already in the codebase
- TD-5 fix: HIGH — ViewsPanel.tsx line 358 is the exact correct key already in the codebase; GridView.tsx confirms the expected key
- TD-7 requirements list: HIGH — audit table rows are the authoritative source; cross-referenced with REQUIREMENTS.md file content
- UI-05 decision: LOW — whether to check it is a judgment call not answerable from code alone

**Research date:** 2026-03-19
**Valid until:** Indefinite — no external dependencies; all findings are from local code
