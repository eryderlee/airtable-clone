---
phase: 06-toolbar
verified: 2026-03-18T02:15:06Z
status: gaps_found
score: 7/9 must-haves verified
gaps:
  - truth: When filters/sorts/searchQuery change, page cache is cleared and page 0 is re-fetched
    status: failed
    reason: fetchPage does not pass searchQuery to getByOffset; cache-reset effect only watches [filters, sorts]
    artifacts:
      - path: src/components/grid/GridView.tsx
        issue: fetchPage (lines 171-177) omits searchQuery from getByOffset.fetch. Dep array (line 187) omits it. Cache-reset useEffect dep array (line 209) is [filters, sorts] only.
    missing:
      - Pass searchQuery to utils.row.getByOffset.fetch inside fetchPage
      - Add searchQuery to fetchPage useCallback dependency array
      - Add searchQuery to the cache-reset useEffect dependency array
  - truth: Virtualizer height reflects filtered count not total count
    status: partial
    reason: count query passes filters but omits searchQuery
    artifacts:
      - path: src/components/grid/GridView.tsx
        issue: api.row.count.useQuery (line 58-61) receives tableId and filters without searchQuery
    missing:
      - Add searchQuery to api.row.count.useQuery input
human_verification:
  - test: Search filters rows server-side
    expected: Only matching rows appear including uncached pages; virtualizer height reflects filtered count
    why_human: Client-side highlight masks server-side gap; requires runtime observation across page boundaries
  - test: Badge counts on Filter Sort and Hide fields buttons
    expected: Each active-condition button shows correct numeric blue badge
    why_human: Visual rendering requires browser
  - test: Search icon blue dot indicator
    expected: Blue dot on search icon when query active but panel closed
    why_human: Visual rendering
  - test: Primary column cannot be hidden
    expected: Toggle for primary column is disabled and unclickable
    why_human: Interaction test
---

# Phase 6: Toolbar Verification Report

**Phase Goal:** Implement toolbar with search (client-side highlight), filter (server-side), sort (server-side), and hide fields. Badge counts on filter/sort buttons. Keyboard nav skips hidden columns.
**Verified:** 2026-03-18T02:15:06Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | getByOffset accepts optional filters sorts and searchQuery params | VERIFIED | row.ts lines 433-436: all three params with defaults |
| 2 | row.count accepts optional filters and searchQuery params | VERIFIED | row.ts lines 554-557: filters and searchQuery with defaults |
| 3 | When filters/sorts/searchQuery change page cache is cleared | FAILED | fetchPage omits searchQuery; cache-reset effect watches [filters, sorts] only |
| 4 | Virtualizer height reflects filtered count | PARTIAL | count query passes filters but not searchQuery (GridView line 59) |
| 5 | User can toggle column visibility from Hide Fields panel | VERIFIED | HideFieldsPanel fully implemented; onHiddenColumnsChange wired |
| 6 | Hidden columns disappear from the grid immediately | VERIFIED | GridView passes visibleColumnIds as columnIds to GridTable (line 579) |
| 7 | Keyboard navigation skips hidden columns | VERIFIED | columnOrder = visibleColumnIds (line 373); all keyboard handlers use it |
| 8 | Toolbar shows badge counts for active filters and sorts | VERIFIED | badgeCount wired on Filter Sort and HideFields buttons |
| 9 | Primary column cannot be hidden | VERIFIED | HideFieldsPanel: disabled and onClick guard on isPrimary |

**Score:** 7/9 truths verified (2 failed/partial)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| src/server/api/routers/row.ts | VERIFIED | 596 lines; getByOffset and count accept filter/sort/search; fast-path preserved |
| src/components/grid/GridView.tsx | VERIFIED | 610 lines; all toolbar state present; wired to GridToolbar and GridTable |
| src/components/grid/GridToolbar.tsx | VERIFIED | 291 lines; all four panels conditionally rendered |
| src/components/grid/toolbar/SearchBar.tsx | VERIFIED | 77 lines; match count prev/next close button autoFocus |
| src/components/grid/toolbar/FilterPanel.tsx | VERIFIED | 234 lines; add/remove conditions column/operator/value pickers |
| src/components/grid/toolbar/SortPanel.tsx | VERIFIED | 139 lines; add/remove sort rules direction labels vary by column type |
| src/components/grid/toolbar/HideFieldsPanel.tsx | VERIFIED | 109 lines; toggle per column primary disabled hide-all/show-all |
| src/components/grid/GridCell.tsx | VERIFIED | highlightText with bg-yellow-200; isCurrentMatch triggers full cell highlight |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| GridView.tsx | row.ts getByOffset | fetchPage passes filters/sorts | PARTIAL | searchQuery missing from fetch call and dep array |
| GridView.tsx | row.ts count | api.row.count.useQuery | PARTIAL | Passes filters but not searchQuery |
| SearchBar.tsx | GridView.tsx | onSearchChange prop | VERIFIED | onSearchChange set to setSearchInput in GridView |
| FilterPanel.tsx | GridView.tsx | onFiltersChange prop | VERIFIED | onFiltersChange set to setFilters in GridView |
| SortPanel.tsx | GridView.tsx | onSortsChange prop | VERIFIED | onSortsChange set to setSorts in GridView |
| HideFieldsPanel.tsx | GridView.tsx | onHiddenColumnsChange prop | VERIFIED | onHiddenColumnsChange set to setHiddenColumns in GridView |
| GridView.tsx | GridTable.tsx | visibleColumnIds as columnIds | VERIFIED | Line 579: columnIds=visibleColumnIds |
| GridTable.tsx | GridCell.tsx | searchQuery and isCurrentMatch | VERIFIED | Lines 285-286: both props forwarded |

### Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| GridView.tsx | 176-177 | fetchPage omits searchQuery from getByOffset.fetch | Blocker | Search does not filter server-side; only highlights already-cached rows |
| GridView.tsx | 187 | fetchPage dep array missing searchQuery | Blocker | Stale closure: pages fetched while search active use empty searchQuery |
| GridView.tsx | 59 | count query missing searchQuery | Blocker | Virtualizer height wrong during search (reflects unfiltered count) |
| GridView.tsx | 209 | Cache-reset effect dep array omits searchQuery | Blocker | Changing search term does not flush cache or trigger server re-fetch |

### Human Verification Required

#### 1. Search filters rows server-side
**Test:** Open a table with 1000+ rows. Type a search term. Observe whether only matching rows appear including rows beyond the first loaded page.
**Expected:** Only matching rows appear; virtualizer scroll height shrinks to match the filtered count.
**Why human:** Client-side highlight works on cached rows and masks the gap; requires runtime observation across page boundaries.

#### 2. Badge counts on all three panel buttons
**Test:** Add 2 filter conditions 1 sort rule and hide 1 field. Check badge numbers on each toolbar button.
**Expected:** Filter button shows 2. Sort button shows 1. Hide fields button shows 1.
**Why human:** Visual rendering requires browser.

#### 3. Search icon blue dot indicator
**Test:** Open search panel type a word close the panel. Observe the search icon.
**Expected:** A small blue dot appears on the search icon while query is active and panel is closed.
**Why human:** Visual rendering.

#### 4. Primary column cannot be hidden
**Test:** Open Hide fields panel. Attempt to click the toggle for the primary column.
**Expected:** Toggle is visually grayed out and clicking it has no effect.
**Why human:** Interaction test.

### Gaps Summary

Two closely related gaps share a single root cause: searchQuery was correctly declared and debounced in GridView and the backend getByOffset and count procedures were correctly extended to accept it -- but the frontend never passes searchQuery through to either call.

In fetchPage (lines 171-177) the getByOffset.fetch call passes filters and sorts but omits searchQuery. The dependency array (line 187) also omits searchQuery creating a stale closure. The cache-reset useEffect (line 209) only watches [filters, sorts] so typing a search term does not flush cached pages or trigger a server re-fetch.

In the row.count query (line 58-61) the input is { tableId, filters } without searchQuery. When a search is active the virtualizer height and row-count display are computed from the full unfiltered table count.

Fix scope - four targeted changes to GridView.tsx:
1. Add searchQuery to the getByOffset.fetch call inside fetchPage
2. Add searchQuery to the fetchPage useCallback dependency array
3. Add searchQuery to api.row.count.useQuery input object
4. Add searchQuery to the cache-reset useEffect dependency array

All other Phase 6 deliverables are fully implemented and correctly wired: filter panel sort panel hide fields panel badge counts keyboard nav via visibleColumnIds client-side cell highlighting with bg-yellow-200 match count/prev/next navigation click-outside-to-close and the search icon blue dot indicator.

---

_Verified: 2026-03-18T02:15:06Z_
_Verifier: Claude (gsd-verifier)_
