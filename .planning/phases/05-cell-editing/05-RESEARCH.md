# Phase 5: Cell Editing — Research

**Researched:** 2026-03-17
**Domain:** Spreadsheet keyboard navigation model + TanStack Virtual scrollToIndex + tRPC optimistic mutations
**Confidence:** HIGH (core patterns verified via official TanStack source, React Query v5 docs, and tRPC docs)

---

## Summary

Phase 5 layers a two-mode interaction model on top of the Phase 4 grid: a **navigation mode** (arrow keys move between cells) and an **edit mode** (arrow keys move cursor within text). This is the canonical spreadsheet model used by Airtable, AG Grid, Excel, and Google Sheets. No external library is needed to implement this — it is pure React state management + DOM event handling on top of TanStack Table + TanStack Virtual.

The key architecture question is where cursor state lives. The answer is: **cursor state (`{rowIndex, columnId}` + `editMode: boolean`) lives in `GridView.tsx` (the top-level client component), passed down as props, NOT in context.** Context would require each cell to re-render when cursor moves. Passing focused cell coordinates as props lets `GridCell` components use simple equality checks. The cursor state must be in `useState` (not `useRef`) because it drives visual rendering — which cell looks selected. However, the "pending edit value" can live in local `GridCell` state.

The blocker flagged in STATE.md ("scrollToIndex + requestAnimationFrame focus restoration") is **real and verified.** TanStack Virtual's `scrollToIndex` has a timing issue where the scroll position may be based on stale measurements. The official fix confirmed by TanStack maintainers is to wrap the call in `requestAnimationFrame`. For focus restoration (focusing the input after scroll), a **second** `requestAnimationFrame` is needed because focus must happen after the DOM has rendered the newly-visible cell. This two-rAF pattern is the correct implementation.

For persistence, the `row.update` mutation already exists. Use **local state for the draft value** while editing, persist on blur/Enter via tRPC mutation, and do optimistic cache update via `utils.row.getRows.setInfiniteData` for immediate UI feedback. AbortController cancellation of in-flight mutations is the correct pattern for "user navigates away before save completes." The `signal` option on tRPC `mutate` calls passes the AbortSignal.

**Primary recommendation:** Keep cursor state in `GridView` as `useState`, pass `isFocused`/`isEditing` booleans to each `GridCell`, handle all keyboard events in a `onKeyDown` handler on the `<table>` container (not individual cells), and use `requestAnimationFrame` (twice) for scrollToIndex + focus.

---

## Standard Stack

No new dependencies for Phase 5. All required libraries are already in the Phase 4 stack.

### Already Available (No New Installs)

| Library | Version | Purpose | How Used in Phase 5 |
|---------|---------|---------|---------------------|
| `@tanstack/react-virtual` | `^3.x` | Row virtualization | `scrollToIndex` to bring selected cell into view |
| `@tanstack/react-table` | `^8.x` | Table data model | `column.columnDef.meta.type` for cell type dispatch |
| `@trpc/react-query` | `^11.0.0` | Data mutations | `api.row.update.useMutation` for cell persistence |
| `@tanstack/react-query` | `^5.50.0` | Cache management | `utils.row.getRows.setInfiniteData` for optimistic updates |

### No New Installs Required

```bash
# Phase 5 requires no new npm packages
# @tanstack/react-table and @tanstack/react-virtual are installed in Phase 4
```

---

## Architecture Patterns

### Recommended File Structure

```
src/components/grid/
├── GridView.tsx          # Owns cursor state + keyboard handler + mutation
├── GridTable.tsx         # Passes cursor props down; renders GridRow
├── GridHeader.tsx        # Unchanged from Phase 4
├── GridRow.tsx           # Passes isFocused/isEditing to GridCell
├── GridCell.tsx          # NEW: per-cell component with display/edit rendering
└── AddColumnButton.tsx   # Unchanged from Phase 4
```

The key split: `GridView` owns all logic (cursor position, edit mode, mutation), `GridCell` only renders based on props.

### Pattern 1: Cursor State in GridView

**What:** Two pieces of state in `GridView`:
1. `cursor: { rowIndex: number; columnId: string } | null` — which cell is "selected" (highlighted)
2. `editingCell: { rowIndex: number; columnId: string } | null` — which cell is in edit mode

**When to use:** Always. These are rendering state (they change what cells look like), so `useState` is correct. Do NOT use `useRef` for these.

```typescript
// Source: derived from official React Query patterns + spreadsheet architecture
// In GridView.tsx
const [cursor, setCursor] = useState<{ rowIndex: number; columnId: string } | null>(null);
const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);

// Helper to enter edit mode
const enterEditMode = useCallback((rowIndex: number, columnId: string) => {
  setCursor({ rowIndex, columnId });
  setEditingCell({ rowIndex, columnId });
}, []);

// Helper to exit edit mode
const exitEditMode = useCallback(() => {
  setEditingCell(null);
}, []);
```

**Why GridView, not context:** Each cell re-renders only when its own `isFocused`/`isEditing` props change. If cursor state were in context, every cell would re-render on every keystroke.

### Pattern 2: Keyboard Handler on the Table Container

**What:** A single `onKeyDown` handler on the outermost scroll container div (the `tableContainerRef`). This captures all keystrokes. In edit mode, the handler ignores navigation keys (they go to the browser's native input handling). In navigation mode, it intercepts arrow keys, Enter, Escape, Tab.

**When to use:** Always — this is the standard spreadsheet architecture. Individual cells do NOT handle arrow keys.

```typescript
// Source: derived from AG Grid keyboard model + spreadsheet architecture patterns
// In GridView.tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isEditing = editingCell !== null;

    if (isEditing) {
      // In edit mode: only intercept commit/cancel keys
      if (e.key === "Escape") {
        e.preventDefault();
        exitEditMode(); // revert — GridCell handles reverting its local state
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // commit is handled by GridCell's onBlur; just exit edit mode
        exitEditMode();
        // focus the table container so navigation resumes
        tableContainerRef.current?.focus();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const shift = e.shiftKey;
        // commit + move
        exitEditMode();
        moveCursor(shift ? "left" : "right");
      }
      // All other keys: don't intercept — let the <input> handle them
      return;
    }

    // Navigation mode: intercept all navigation keys
    if (!cursor) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveCursor("up");
        break;
      case "ArrowDown":
        e.preventDefault();
        moveCursor("down");
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveCursor("left");
        break;
      case "ArrowRight":
        e.preventDefault();
        moveCursor("right");
        break;
      case "Enter":
        e.preventDefault();
        enterEditMode(cursor.rowIndex, cursor.columnId);
        break;
      case "Tab":
        e.preventDefault();
        moveCursor(e.shiftKey ? "left" : "right");
        break;
      case "Escape":
        e.preventDefault();
        setCursor(null);
        break;
      default:
        // Printable key: enter edit mode immediately (overwrite)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          enterEditMode(cursor.rowIndex, cursor.columnId);
          // The first keystroke will be the initial value — handled in GridCell
        }
    }
  },
  [cursor, editingCell, enterEditMode, exitEditMode, moveCursor],
);
```

**Critical:** The container `div` must have `tabIndex={0}` to be focusable and receive keyboard events.

### Pattern 3: moveCursor with scrollToIndex + requestAnimationFrame Focus

**What:** When the cursor moves, the new row must be scrolled into view, and then the new cell must receive focus. The `scrollToIndex` call must be wrapped in `requestAnimationFrame` (one rAF for the scroll, which is required due to TanStack Virtual measurement timing). Focusing the DOM element requires a **second** rAF because the element only exists in the DOM after the scroll+render cycle completes.

**When to use:** Every cursor movement that could move to a row not currently in view.

```typescript
// Source: TanStack Virtual issue #537 — rAF is the official fix for scroll timing
// In GridView.tsx
const moveCursor = useCallback(
  (direction: "up" | "down" | "left" | "right") => {
    if (!cursor) return;

    const allRows = flatRows; // from useInfiniteQuery
    const totalRows = allRows.length;
    const columnIds = columnDefs.map((c) => c.id);

    let newRowIndex = cursor.rowIndex;
    let newColumnId = cursor.columnId;
    const colIndex = columnIds.indexOf(cursor.columnId);

    switch (direction) {
      case "up":
        newRowIndex = Math.max(0, cursor.rowIndex - 1);
        break;
      case "down":
        newRowIndex = Math.min(totalRows - 1, cursor.rowIndex + 1);
        break;
      case "left":
        newColumnId = columnIds[Math.max(0, colIndex - 1)] ?? cursor.columnId;
        break;
      case "right":
        newColumnId = columnIds[Math.min(columnIds.length - 1, colIndex + 1)] ?? cursor.columnId;
        break;
    }

    setCursor({ rowIndex: newRowIndex, columnId: newColumnId });

    // Step 1: scroll the new row into view
    // rAF required — TanStack Virtual measurements may be stale without it
    requestAnimationFrame(() => {
      rowVirtualizer.scrollToIndex(newRowIndex, { align: "auto" });

      // Step 2: focus the new cell's DOM element
      // Second rAF required — the cell is only in the DOM after scroll + render
      requestAnimationFrame(() => {
        const cellEl = document.querySelector<HTMLElement>(
          `[data-row-index="${newRowIndex}"][data-column-id="${newColumnId}"]`
        );
        cellEl?.focus();
      });
    });
  },
  [cursor, flatRows, columnDefs, rowVirtualizer],
);
```

**Important:** Each `<td>` cell must have `data-row-index` and `data-column-id` attributes for the selector to work. Alternatively, use a `Map<string, HTMLElement>` ref keyed by `${rowIndex}-${columnId}` — this is more performant for large grids.

### Pattern 4: GridCell Component — Display vs Edit Mode

**What:** `GridCell` receives `isFocused` and `isEditing` boolean props. In display mode, it renders the cell value as text. In edit mode, it renders an `<input>` (for text) or `<input type="number">` (for number columns). The input is auto-focused when `isEditing` becomes true. The draft value lives in local `GridCell` state.

**When to use:** Always — separate display and edit rendering at the cell level.

```typescript
// Source: TanStack Table editable-data example pattern, adapted for this project
interface GridCellProps {
  rowId: string;
  rowIndex: number;
  columnId: string;
  columnType: "text" | "number";
  value: string | number | null;
  isFocused: boolean;
  isEditing: boolean;
  onCommit: (rowId: string, columnId: string, value: string | number | null) => void;
  onRevert: () => void;
  onStartEditing: () => void;
}

function GridCell({
  rowId, rowIndex, columnId, columnType, value,
  isFocused, isEditing, onCommit, onRevert, onStartEditing,
}: GridCellProps) {
  const [draftValue, setDraftValue] = useState<string | number | null>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft value when external value changes (e.g., after successful mutation)
  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    onCommit(rowId, columnId, draftValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape: revert without commit
    if (e.key === "Escape") {
      setDraftValue(value); // reset to original
      onRevert();
      e.stopPropagation(); // prevent GridView handler from also firing
    }
    // Enter/Tab: commit — the GridView handler handles exit
    // Don't stopPropagation here: let GridView handler also fire
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={columnType === "number" ? "number" : "text"}
        value={draftValue ?? ""}
        onChange={(e) => setDraftValue(
          columnType === "number" ? Number(e.target.value) : e.target.value
        )}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm outline-none border border-blue-500"
        data-row-index={rowIndex}
        data-column-id={columnId}
      />
    );
  }

  return (
    <div
      tabIndex={isFocused ? 0 : -1}
      data-row-index={rowIndex}
      data-column-id={columnId}
      onClick={() => onStartEditing()}
      className={`w-full h-full px-2 text-sm flex items-center ${
        isFocused ? "ring-2 ring-blue-500 ring-inset" : ""
      }`}
    >
      {value ?? ""}
    </div>
  );
}
```

### Pattern 5: tRPC Mutation with Optimistic Update

**What:** `api.row.update.useMutation` with `onMutate` (optimistic cache update), `onError` (rollback), and `onSettled` (invalidate). The mutation uses `utils.row.getRows.setInfiniteData` to update the cached row data immediately without waiting for the server.

**When to use:** Every cell commit (blur or Enter).

```typescript
// Source: tRPC useUtils docs + React Query v5 optimistic update pattern
// In GridView.tsx
const utils = api.useUtils();

const updateCell = api.row.update.useMutation({
  onMutate: async ({ id, cells }) => {
    // Cancel outgoing refetches for this query
    await utils.row.getRows.cancel({ tableId, viewId });

    // Snapshot current cache for rollback
    const previousData = utils.row.getRows.getInfiniteData({ tableId, viewId });

    // Optimistically update the cache
    utils.row.getRows.setInfiniteData({ tableId, viewId }, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((row) =>
            row.id === id
              ? { ...row, cells: { ...row.cells, ...cells } }
              : row
          ),
        })),
      };
    });

    return { previousData };
  },
  onError: (_err, _vars, context) => {
    // Rollback to previous cache state
    if (context?.previousData) {
      utils.row.getRows.setInfiniteData({ tableId, viewId }, context.previousData);
    }
  },
  onSettled: () => {
    // Always invalidate to ensure server state is reflected
    void utils.row.getRows.invalidate({ tableId });
  },
});

// Usage: call this from GridCell's onCommit
const handleCellCommit = useCallback(
  (rowId: string, columnId: string, value: string | number | null) => {
    updateCell.mutate({ id: rowId, cells: { [columnId]: value } });
  },
  [updateCell],
);
```

**Note on AbortController for mutation cancellation:** tRPC's `mutate` does support an `AbortSignal` option — `mutate(input, { signal: abortController.signal })`. For the "user navigates away while mutation is in-flight" case, this is the correct pattern. However, for "user types in cell A then immediately moves to cell B", the simpler approach is to NOT cancel the first mutation — let it complete, since the optimistic update already shows the right value. Cancellation is most useful if you need to debounce saves.

### Pattern 6: Click-to-Select vs Click-to-Edit

**What:** A single click selects a cell (enters navigation mode focused on that cell). A second click OR pressing Enter enters edit mode. This matches Airtable's exact behavior.

**When to use:** In the `onClick` handler of `GridCell`'s display div.

```typescript
// In GridCell display mode onClick:
onClick={() => {
  if (isFocused) {
    // Already focused — second click enters edit mode
    onStartEditing();
  } else {
    // First click — just select
    onSelect(); // calls setCursor in GridView
  }
}}
```

**Alternative:** Detect double-click with `onDoubleClick` for explicit edit entry. However, Airtable's behavior is actually single-click to select + second single-click (or Enter) to edit, which aligns with the pattern above.

### Anti-Patterns to Avoid

- **Cursor state in React context:** Every cell subscribes to the context and re-renders when cursor moves. With 1000+ visible cells, this causes visible lag.
- **Keyboard events on individual `<td>` elements:** Events bubble unpredictably; some browsers don't fire keydown on non-focusable elements. Handle on the container.
- **`useRef` for cursor position:** Cursor position drives rendering (which cell shows as selected). `useRef` won't trigger re-renders. Use `useState`.
- **Calling `scrollToIndex` synchronously in the same render:** TanStack Virtual measurements may be stale. Always use `requestAnimationFrame`.
- **Invalidating `row.getRows` immediately after mutation (no optimistic update):** This causes the entire grid to flicker as it refetches. Always apply optimistic cache update first, then invalidate in `onSettled`.
- **`window.addEventListener('keydown')` instead of React's synthetic events:** Harder to clean up and misses React's event delegation. Use `onKeyDown` on a focusable container.
- **`document.querySelector` for focus in large grids:** Acceptable for Phase 5 scope, but a `Map<string, HTMLElement>` ref is more performant if performance becomes an issue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cell scroll-into-view | Custom scroll math | `rowVirtualizer.scrollToIndex(index, { align: 'auto' })` | Already computes offset from measureElement data |
| Keyboard event routing | Custom event bus | `onKeyDown` on container with mode guard | Browser event system handles this correctly |
| Draft value state | External state manager | Local `useState` in `GridCell` | Draft value is pure UI concern, no need to share |
| Optimistic cache patching | Manual cache clone | `utils.row.getRows.setInfiniteData` | tRPC wraps React Query's `setInfiniteQueryData` |
| Column type dispatch | `if/else` chains | `cell.column.columnDef.meta.type` (already in Phase 4 column defs) | Phase 4 already stores type in meta |

**Key insight:** TanStack Table and TanStack Virtual provide the scroll and layout primitives. The spreadsheet state machine (two modes, cursor movement) is a thin React layer on top.

---

## Common Pitfalls

### Pitfall 1: Single rAF is Not Enough for Focus After Scroll

**What goes wrong:** You call `requestAnimationFrame(() => { rowVirtualizer.scrollToIndex(i); inputRef.current?.focus(); })` — the focus doesn't work because the cell's DOM element doesn't exist until after the scroll renders.
**Why it happens:** `scrollToIndex` triggers a scroll, which causes TanStack Virtual to add new virtual items to the DOM. That DOM update happens in the next render cycle AFTER the rAF completes.
**How to avoid:** Two nested `requestAnimationFrame` calls — the outer one handles the scroll, the inner one fires after the subsequent render.
**Warning signs:** `focus()` call is reached but the element is null, or focus goes to the wrong element.

### Pitfall 2: Keyboard Events Not Firing on Container

**What goes wrong:** `onKeyDown` on the container div fires only sometimes, or not at all.
**Why it happens:** Container div without `tabIndex` cannot receive keyboard focus, and therefore cannot receive keyboard events.
**How to avoid:** Add `tabIndex={0}` to the outermost scroll container div. Also add `outline: none` to suppress the browser focus ring on the container (cells show their own focus rings).
**Warning signs:** Events fire when input is focused but not when navigating between cells.

### Pitfall 3: Escape Revert Logic Requires Local State Snapshot

**What goes wrong:** Pressing Escape reverts the cell to the wrong value (empty string, or the pre-Phase-5 value).
**Why it happens:** If `draftValue` in `GridCell` starts as `undefined` or is not initialized from the `value` prop, there's nothing to revert to.
**How to avoid:** Initialize `draftValue` from `value` prop in `useState(value)`. On Escape, call `setDraftValue(value)` before calling `onRevert()`. The `value` prop is the "committed" server value.
**Warning signs:** Escape always produces an empty cell.

### Pitfall 4: Optimistic Update Key Mismatch

**What goes wrong:** `setInfiniteData` updates the cache but the grid doesn't re-render, or the wrong pages are updated.
**Why it happens:** The query key used in `setInfiniteData` doesn't match the one used in `useInfiniteQuery`. The key includes `{ tableId, viewId, limit: 100 }`.
**How to avoid:** Use only `{ tableId, viewId }` as the key in `setInfiniteData` — tRPC matches on the fields you provide, finding all matching queries regardless of other fields. But `cancelQueries` and `getInfiniteData` must use the same partial key. Test by checking that the optimistic update appears immediately.
**Warning signs:** Cell value doesn't change until after `onSettled` invalidation completes.

### Pitfall 5: Number Column Edit Value Type

**What goes wrong:** A Number column saves the value as a string `"42"` instead of the number `42`, breaking filter/sort that uses JSONB numeric casting.
**Why it happens:** `<input type="number">` still returns `e.target.value` as a string. If you store it without conversion, it's a string in the JSONB cells object.
**How to avoid:** Always convert number column values: `Number(e.target.value)`. Handle the empty string case: if the input is empty, store `null` not `Number("")` (which is `0`).
**Warning signs:** `CAST(cells->>'columnId' AS numeric)` throws in filter queries.

### Pitfall 6: edit mode `stopPropagation` on Escape

**What goes wrong:** When the user presses Escape in an edit-mode input, both the `GridCell` local handler AND the `GridView` container handler fire. If `GridView` handles Escape by clearing the cursor entirely, the cell becomes deselected instead of just exiting edit mode.
**Why it happens:** React's synthetic events bubble up the React tree, triggering both handlers.
**How to avoid:** In `GridCell`'s input `onKeyDown`, call `e.stopPropagation()` for Escape. The `GridCell` handles revert, and calls `onRevert()` which calls `exitEditMode()` in `GridView`. The cursor (selection) stays on the same cell.
**Warning signs:** Pressing Escape deselects the cell entirely instead of staying selected.

### Pitfall 7: Tab Navigation After Commit

**What goes wrong:** Tab commits the edit but doesn't move to the next cell because the `onBlur` fires AND the Tab key handler in `GridView` fires, causing a double-move.
**Why it happens:** Pressing Tab on an `<input>` triggers `onBlur` (which calls `onCommit`) AND bubbles to the container's `onKeyDown` handler.
**How to avoid:** In `GridView`'s Tab handler in edit mode, do NOT call `moveCursor` directly — just call `exitEditMode()`. The `onBlur` from the input will handle the commit. Then, after exiting edit mode, the Tab handler calls `moveCursor`. Track this carefully: the sequence is Tab → `onKeyDown` fires → exitEditMode → Tab → `onBlur` fires → commit. Since both happen synchronously in the same event, order matters.
**Warning signs:** Tab moves the cursor two cells, or commits twice.

---

## Code Examples

### scrollToIndex + Focus with Double requestAnimationFrame

```typescript
// Source: TanStack Virtual issue #537 — rAF is the official fix for scroll timing
// The double-rAF pattern for focus-after-scroll is derived from DOM rendering timing

function scrollAndFocusCell(rowIndex: number, columnId: string) {
  requestAnimationFrame(() => {
    rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });

    requestAnimationFrame(() => {
      const cellEl = document.querySelector<HTMLElement>(
        `[data-row-index="${rowIndex}"][data-column-id="${columnId}"]`
      );
      cellEl?.focus();
    });
  });
}
```

### Optimistic setInfiniteData Pattern

```typescript
// Source: tRPC useUtils docs (setInfiniteData wraps setInfiniteQueryData)
// + React Query v5 optimistic update guide

utils.row.getRows.setInfiniteData({ tableId, viewId }, (old) => {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [columnId]: newValue } }
          : row
      ),
    })),
  };
});
```

### Column Type Dispatch in GridCell

```typescript
// Source: Phase 4 pattern — meta.type is already in column defs
// cell.column.columnDef.meta is typed via TableMeta augmentation

const columnType = (cell.column.columnDef.meta as { type: "text" | "number" })?.type ?? "text";

// In GridCell render:
<input
  type={columnType === "number" ? "number" : "text"}
  inputMode={columnType === "number" ? "numeric" : "text"}
  // ...
/>
```

### Container Keyboard Handler Setup

```typescript
// In GridView.tsx render:
<div
  ref={tableContainerRef}
  tabIndex={0}                          // REQUIRED for keyboard focus
  onKeyDown={handleKeyDown}
  style={{ outline: "none" }}           // suppress default focus ring
  className="flex-1 overflow-auto relative"
>
  <GridTable ... />
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One click enters edit mode | Two clicks (or Enter) to enter edit mode | Airtable-style UX | Prevents accidental edits during navigation |
| Individual cell keyboard handlers | Container-level keyboard handler | Modern grid architecture | Single source of truth for event routing |
| Synchronous `scrollToIndex` + focus | `requestAnimationFrame` wrapping | TanStack Virtual v3 timing issue | Required for correct scroll + focus sequencing |
| `keepPreviousData: true` (boolean) | `placeholderData: keepPreviousData` (function) | React Query v5 | Already handled in Phase 4 |
| `useContext()` for tRPC utils | `api.useUtils()` | Project decision 03-02 | Always use `api.useUtils()` |

**Deprecated/outdated for this project:**
- `cell-level keyboard event listeners`: Use container-level `onKeyDown` instead
- `react-datasheet` or similar cell editing libraries: Build directly on TanStack Table — simpler, no extra dependency

---

## Open Questions

1. **Double-rAF pattern — should it be `useEffect` instead?**
   - What we know: `requestAnimationFrame` is confirmed as the TanStack Virtual fix for scroll timing. The second rAF is derived from DOM rendering sequencing.
   - What's unclear: Whether wrapping in `useEffect` (which fires after paint) would be equivalent to the double-rAF.
   - Recommendation: Use the double-rAF pattern. It's verified and explicit. If it proves unreliable during implementation, try `setTimeout(fn, 0)` as a fallback — it's less precise but guarantees post-render execution.

2. **`data-row-index` selector vs ref Map for cell focus**
   - What we know: `document.querySelector('[data-row-index="N"][data-column-id="X"]')` works but does a full DOM scan.
   - What's unclear: Whether this is fast enough in practice. At 20-50 DOM rows (virtualized), the scan is trivially fast.
   - Recommendation: Use `data-*` selector for Phase 5. If profiling shows this as a hotspot (unlikely), switch to a `Map<string, HTMLElement>` ref populated in each cell's `useEffect`.

3. **Number input validation — empty vs 0**
   - What we know: `Number("")` is `0`, not `null`. Storing `0` when the user clears a number field is wrong.
   - What's unclear: Whether to store `null` or `""` for empty number cells.
   - Recommendation: Store `null` for empty number cells. Check `e.target.value === ""` and save `null` instead of `Number("")`.

4. **Escape key in `GridCell` — `stopPropagation` vs flag**
   - What we know: Both `GridCell` and `GridView` have Escape handlers that must not double-fire.
   - What's unclear: Whether `e.stopPropagation()` in `GridCell`'s input `onKeyDown` reliably prevents the outer `onKeyDown` from firing in all browsers.
   - Recommendation: Use `stopPropagation()` in `GridCell` for Escape. React's synthetic event system handles this correctly. If issues arise during implementation, use a `isHandledRef` boolean ref as a flag.

---

## Sources

### Primary (HIGH confidence)
- **TanStack Virtual source** `https://raw.githubusercontent.com/TanStack/virtual/main/packages/virtual-core/src/index.ts` — `scrollToIndex` signature: `(index: number, { align: 'auto'|'start'|'end'|'center', behavior: 'auto'|'smooth' })`. No built-in focus management.
- **TanStack Virtual issue #537** `https://github.com/TanStack/virtual/issues/537` — rAF is the official/only documented fix for scrollToIndex timing; maintainer confirmed.
- **tRPC abort docs** `https://trpc.io/docs/client/vanilla/aborting-procedure-calls` — AbortController pattern confirmed for both queries and mutations via `{ signal: ac.signal }`.
- **tRPC useUtils docs** `https://trpc.io/docs/client/react/useUtils` — `setInfiniteData` confirmed as a method wrapping `queryClient.setInfiniteQueryData`.
- **TanStack Table editable-data example** `https://raw.githubusercontent.com/TanStack/table/main/examples/react/editable-data/src/main.tsx` — `onChange`/`onBlur` pattern, local cell state, `updateData` via `table.options.meta`.
- **React Query v5 optimistic update docs** `https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates` — `onMutate`/`onError`/`onSettled` pattern, `cancelQueries`, `getQueryData`, rollback via context.

### Secondary (MEDIUM confidence)
- **AG Grid keyboard navigation docs** `https://www.ag-grid.com/react-data-grid/keyboard-navigation/` — confirmed Enter/F2 to enter edit, Escape to exit, Tab to commit+advance. Used as reference for the standard spreadsheet interaction model.
- **The Candid Startup blog 2025** `https://www.thecandidstartup.org/2025/02/03/react-spreadsheet-edit-ready.html` — `focusCell` state, `editMode` boolean, `useEffect` + direct DOM focus. Multiple credible approach.
- **The Candid Startup optimistic update 2025** `https://www.thecandidstartup.org/2025/06/23/react-spreadsheet-optimistic-update.html` — pending state tracking pattern, sequential mutation blocking.

### Tertiary (LOW confidence)
- WebSearch results on cursor state (useState vs useRef): consistent with official React docs but not independently verified against official source. Treat as confirmed by general React knowledge.
- Double-rAF pattern for focus-after-scroll: derived from single-rAF fix + DOM rendering knowledge. Not documented in an official TanStack source. **Validate during implementation.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; Phase 4 libraries confirmed
- Cursor state architecture (GridView useState): HIGH — React rendering model guarantees
- scrollToIndex + rAF: HIGH — official TanStack maintainer confirmed rAF fix; second rAF is MEDIUM (derived)
- Optimistic update pattern: HIGH — React Query v5 docs + tRPC useUtils docs
- Keyboard event routing (container onKeyDown): HIGH — AG Grid and spreadsheet reference implementations
- Pitfall: Escape stopPropagation: MEDIUM — React synthetic event behavior

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (TanStack Table v8, TanStack Virtual v3, React Query v5, tRPC v11 are all stable APIs)

**Critical finding for planner:**
Phase 5 requires NO new npm installs — all dependencies come from Phase 4. The blocker ("validate scrollToIndex + rAF pattern") is resolved: use double-rAF. Cursor state belongs in `GridView` as `useState`, NOT in a context provider.
