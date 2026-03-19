# Phase 12: Server-Side Search - Research

**Researched:** 2026-03-19
**Domain:** tRPC / Drizzle ORM / React state — wiring existing server-side search into the page-cache fetching pipeline
**Confidence:** HIGH

## Summary

The server-side infrastructure for search is **already fully implemented**. Both `row.getByOffset` and `row.count` accept a `searchQuery` parameter and apply an ILIKE clause at the database level. The `isFastPath` logic in `getByOffset` already gates on `!input.searchQuery.trim()`, so search presence automatically routes to the OFFSET path. The `getRows` (cursor-based) procedure also has full search support.

The gap is exclusively in `GridView.tsx`: the `fetchPage` callback passes `filters` and `sorts` to `getByOffset` but omits `searchQuery`. Likewise, the `row.count` query is called with `{ tableId, filters }` without `searchQuery`. The cache-reset effect has `[filters, sorts]` in its dep array, missing `searchQuery`. Three targeted changes in `GridView.tsx` close the gap.

The current client-side highlight system (`searchMatches`, `highlightText`, prev/next navigation) remains valuable after the server-side fix — it provides within-page match highlighting and navigation across the filtered result set. It should be **retained as a secondary layer**, not removed. With server-side filtering active, all visible rows match the query, so every highlighted cell is a true match. The prev/next arrows gain real utility because they navigate across all pages of the filtered result.

**Primary recommendation:** Wire `searchQuery` into `fetchPage`, `row.count`, and the cache-reset effect in `GridView.tsx`. No new libraries or procedures needed.

---

## Standard Stack

No new dependencies required. The phase uses the existing stack.

### Core (already in place)
| Library | Purpose | Status |
|---------|---------|--------|
| Drizzle ORM | `ILIKE` search clause in `getByOffset` and `count` | Already implemented |
| tRPC v11 | `row.getByOffset` and `row.count` procedures | Both accept `searchQuery` already |
| React `useState` / `useEffect` | Debounced `searchQuery` state | Already in `GridView.tsx` |

**Installation:** No new packages needed.

---

## Architecture Patterns

### How the page-cache system works

`fetchPage(pageIndex)` is called by the scroll handler and on mount. It calls `utils.row.getByOffset.fetch(...)` imperatively (not via `useQuery`). The result populates `pageCacheRef.current[pageIndex]`. `totalCount` comes from `api.row.count.useQuery(...)`, which sizes the TanStack Virtualizer. When filters or sorts change, `resetCache()` clears `pageCacheRef` and increments `cacheGenerationRef` to discard in-flight fetches.

### The three change points

**Change 1 — `fetchPage` callback (line ~286-292)**

```typescript
// Current — searchQuery missing:
const data = await utils.row.getByOffset.fetch({
  tableId,
  offset: pageIndex * PAGE_SIZE,
  limit: PAGE_SIZE,
  filters,
  sorts,
});

// Fixed — add searchQuery:
const data = await utils.row.getByOffset.fetch({
  tableId,
  offset: pageIndex * PAGE_SIZE,
  limit: PAGE_SIZE,
  filters,
  sorts,
  searchQuery,
});
```

The `fetchPage` useCallback dep array must include `searchQuery`:
```typescript
// Current:
[tableId, utils.row.getByOffset, filters, sorts]
// Fixed:
[tableId, utils.row.getByOffset, filters, sorts, searchQuery]
```

**Change 2 — `row.count` query (line ~94-97)**

```typescript
// Current — searchQuery missing:
const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
  { tableId, filters },
  { staleTime: 30_000 },
);

// Fixed:
const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
  { tableId, filters, searchQuery },
  { staleTime: 30_000 },
);
```

**Change 3 — cache-reset effect dep array (line ~321-329)**

```typescript
// Current:
useEffect(() => {
  if (isFirstRender.current) { ... return; }
  resetCache();
  void refetchCount();
}, [filters, sorts]); // eslint-disable-line react-hooks/exhaustive-deps

// Fixed — add searchQuery:
}, [filters, sorts, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps
```

The `// eslint-disable-line` comment stays because `resetCache` and `refetchCount` are stable refs intentionally excluded. Remove the `// searchInput/searchQuery are intentionally excluded` comment from the auto-save effect (line ~343) since that comment refers to auto-save (correct — search stays ephemeral), but it may be misread as also applying to the data fetch.

### isFastPath — no changes needed

`getByOffset` server-side already checks:
```typescript
const isFastPath =
  input.sorts.length === 0 &&
  input.filters.length === 0 &&
  !input.searchQuery.trim();
```
Non-empty `searchQuery` already forces the OFFSET path. No server changes required.

### Client-side highlight — retain as secondary layer

The `searchMatches` memo, `searchMatchIndex` state, `handlePrevMatch`/`handleNextMatch`, and `highlightText` in `GridCell` should all be kept. With server-side search active:
- All returned rows match the query, so every highlighted cell is a real match
- The match count reflects loaded pages of the filtered set
- Prev/next navigation scrolls between highlighted cells across loaded pages

The `matchCount` shown in the search bar will now report matches across loaded pages of the filtered result (not all pages), which is an acceptable limitation — Airtable itself does the same.

### "Add row" behavior during search

When `searchQuery` is non-empty, `handleAddRow` creates a new row. The `createRow.onMutate` reads `utils.row.count.getData({ tableId, filters })` — but after this phase, the active count cache key is `{ tableId, filters, searchQuery }`. The optimistic update must use the same key. This is a secondary fix required for correctness.

```typescript
// createRow.onMutate — update both the cache read and setData to include searchQuery:
const currentCount = utils.row.count.getData({ tableId: mutTableId, filters, searchQuery })?.count ?? totalCount;
// ...
utils.row.count.setData({ tableId: mutTableId, filters, searchQuery }, (old) => ({
  count: (old?.count ?? currentCount) + 1,
}));
// and in onError:
utils.row.count.setData({ tableId: mutTableId, filters, searchQuery }, (old) => ({
  count: Math.max(0, (old?.count ?? 0) - 1),
}));
```

Note: `searchQuery` is in scope in `GridView.tsx` where `createRow` is defined, so it's accessible without prop drilling.

### handleBulkCreate — also needs searchQuery

`handleBulkCreate` calls `utils.row.getByOffset.fetch(...)` directly with `{ tableId, offset, limit, filters, sorts }` at two places. These fetches should also pass `searchQuery` to match the active page-cache fetch signature. However, bulk create is only triggered from the toolbar (not user-facing search flow), so this is lower priority.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side ILIKE search | Custom full-text search | Existing Drizzle `ilike` in `row.ts` | Already implemented and tested |
| Debouncing search input | Custom debounce hook | Existing 300ms `setTimeout` in `GridView.tsx` | Already in place |
| Cache invalidation on search change | Manual page eviction | Add `searchQuery` to cache-reset effect deps | Effect already handles filter/sort; just extend it |

---

## Common Pitfalls

### Pitfall 1: staleTime on count query causes stale count after search change

**What goes wrong:** `row.count` has `staleTime: 30_000`. If the query key changes (new searchQuery), tRPC React Query treats it as a new query and fetches immediately — this is correct. But if the count key did NOT include `searchQuery` before the fix, changing `searchQuery` would not trigger a new fetch (same cache key). After the fix, the query key changes on each new `searchQuery` value, so tRPC refetches automatically.
**Why it happens:** Query key mismatch between what's in cache and what the data fetch uses.
**How to avoid:** Ensure `searchQuery` is in the `row.count.useQuery` input object (Change 2 above).
**Warning signs:** Row count stays at unfiltered value while grid shows filtered rows.

### Pitfall 2: fetchPage closure captures stale searchQuery

**What goes wrong:** `fetchPage` is a `useCallback`. If `searchQuery` is not in its dep array, the function closes over the initial (empty) value and never passes the current search term.
**Why it happens:** React's stale closure problem — memo/callback deps must include all reactive values.
**How to avoid:** Add `searchQuery` to `fetchPage`'s dep array (Change 1 above).
**Warning signs:** Typing a query shows filtered row count but grid still loads unfiltered rows.

### Pitfall 3: Cache not reset on searchQuery change → ghost rows

**What goes wrong:** When `searchQuery` changes, the cache-reset effect clears `pageCacheRef` so old pages are not shown. Without `searchQuery` in the dep array, old cached pages from the unfiltered dataset persist and are shown alongside filtered results.
**Why it happens:** The cache-reset effect dep array `[filters, sorts]` is intentionally minimal — searchQuery was intentionally excluded in Phase 6.
**How to avoid:** Add `searchQuery` to the cache-reset effect dep array (Change 3 above).
**Warning signs:** After typing a search query, old rows flash briefly before disappearing.

### Pitfall 4: Optimistic row-create uses wrong count cache key

**What goes wrong:** `createRow.onMutate` reads and writes to `utils.row.count.getData({ tableId, filters })`. After adding `searchQuery` to the count query, the active count is cached under `{ tableId, filters, searchQuery }`. The old key lookup returns `undefined`, causing `currentCount` to fall back to `totalCount`, which is correct but the `setData` call hits the wrong key and doesn't update the displayed count.
**Why it happens:** The count query key changed but the optimistic update key was not updated.
**How to avoid:** Update both `getData` and `setData` in `createRow` to include `searchQuery`.
**Warning signs:** Row count doesn't increment when adding a row while search is active.

### Pitfall 5: Adding a row while search is active creates a non-matching row

**What goes wrong:** If a user searches for "Alice" and clicks "Add row", the new row has empty cells. After the mutation settles and the server refetches, this row will be absent from the filtered result (correct behavior — it doesn't match). The optimistic row will flash and disappear.
**Why it happens:** Server-side search filters non-matching rows; newly created empty rows never match.
**How to avoid:** This is expected behavior, not a bug. No code change needed. The row exists in the DB; clear search to see it. Optionally, disable "Add row" button when search is active to prevent confusion — this is a UX decision, not a requirement for Phase 12.
**Warning signs:** User confusion when added row disappears. Consider a toast or tooltip.

---

## Code Examples

### Current `getByOffset` server implementation (verified from source)

```typescript
// Source: src/server/api/routers/row.ts lines 549-553
if (input.searchQuery.trim()) {
  conditions.push(
    sql`${rows.cells}::text ilike ${"%" + input.searchQuery + "%"}`,
  );
}
```

The `cells` column is JSONB. Casting to `::text` and running ILIKE searches across the entire serialized JSON blob. This means `cells::text ilike '%alice%'` will match any row where "alice" appears in any cell value. This is intentionally broad and consistent with Airtable's "search all columns" behavior.

### Current `isFastPath` check (verified from source)

```typescript
// Source: src/server/api/routers/row.ts lines 517-520
const isFastPath =
  input.sorts.length === 0 &&
  input.filters.length === 0 &&
  !input.searchQuery.trim();
```

Non-empty search already forces the OFFSET path. No server-side change needed.

### Current `row.count` server implementation (verified from source)

```typescript
// Source: src/server/api/routers/row.ts lines 613-619
count: protectedProcedure
  .input(
    z.object({
      tableId: z.string().uuid(),
      filters: z.array(filterConditionSchema).default([]),
      searchQuery: z.string().default(""),
    }),
  )
```

`searchQuery` is already an accepted parameter. The server applies the ILIKE condition when non-empty. The client just needs to pass it.

---

## State of the Art

| Old Approach (Phase 6 decision) | Current Approach (Phase 12) | Impact |
|--------------------------------|------------------------------|--------|
| Search highlights loaded rows only; non-matching rows visible | Search filters at DB level; only matching rows fetched | Users can find matches across 1M rows, not just ~100 loaded |
| `searchQuery` excluded from `fetchPage`, `count`, cache-reset | `searchQuery` included in all three | Row count reflects filtered set; virtualizer sized correctly |
| `searchMatches` computed client-side from cached pages | `searchMatches` computed from filtered+loaded pages | Highlight still works; now reliable (all loaded rows match) |

**Still ephemeral (no change):** `searchQuery` is NOT persisted to view config. Search remains a session-only state. The auto-save effect comment at line ~343 correctly excludes it. This is a Phase 6 decision that Phase 12 does not change.

---

## Open Questions

1. **"Add row" behavior during active search**
   - What we know: New rows won't match the search query and will disappear after the server round-trip
   - What's unclear: Whether to disable "Add row" during search, show a warning toast, or leave it as-is
   - Recommendation: Leave "Add row" enabled but make no special accommodation in Phase 12. This is a UX polish decision for a future phase. The behavior is consistent with how filters work (adding a row that doesn't match a filter also causes it to disappear).

2. **`handleBulkCreate` searchQuery propagation**
   - What we know: `handleBulkCreate` calls `getByOffset.fetch` directly and will use wrong data if search is active during bulk create
   - What's unclear: Whether users would ever bulk-create while search is active
   - Recommendation: Pass `searchQuery` to `handleBulkCreate`'s `getByOffset.fetch` calls for completeness. Low risk if omitted since bulk create is a dev tool, not user-facing.

3. **Match count accuracy**
   - What we know: `searchMatches.length` only counts matches in loaded pages, not total DB matches
   - What's unclear: Whether this is acceptable or if the search bar should show the server-side count
   - Recommendation: Use `totalCount` (from `row.count` query) as the authoritative match count display, and keep `searchMatches` for navigation only. This gives users an accurate "X rows match" display.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `E:/websites/airtable clone/src/server/api/routers/row.ts` — `getByOffset` and `count` procedures fully verified
- Direct code inspection: `E:/websites/airtable clone/src/components/grid/GridView.tsx` — All three change points verified line-by-line
- Direct code inspection: `E:/websites/airtable clone/src/components/grid/GridCell.tsx` — Highlight logic verified
- Direct code inspection: `E:/websites/airtable clone/src/components/grid/toolbar/SearchBar.tsx` — Search UI verified

### Secondary (MEDIUM confidence)
- None needed — all findings verified directly from source code

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; verified from existing code
- Architecture: HIGH — exact change points identified from direct code inspection
- Pitfalls: HIGH — derived from code analysis of stale closures and cache key mismatches
- Server-side implementation: HIGH — `searchQuery` already accepted and applied in both `getByOffset` and `count`

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable codebase; no external dependencies changing)
