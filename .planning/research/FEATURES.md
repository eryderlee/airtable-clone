# Feature Landscape: Airtable Clone

**Domain:** Spreadsheet-database hybrid table UI
**Researched:** 2026-03-17
**Scope:** T3-stack Airtable clone, Text/Number columns only, 1M row performance target

---

## Table Stakes

Features users expect the moment they open the product. Missing any of these = product feels broken or unfinished.

### Layout Structure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Left sidebar — bases navigation | Airtable muscle memory: sidebar lists all bases, clicking one opens it | Low | Collapsible. No nesting needed in v1 |
| Top tab bar — tables | Each base has multiple tables. Tabs run horizontally below the base name | Low | Tab per table, "+ Add table" at right end |
| Views panel — left of grid | Per-table view list, always visible. Shows all saved views. Click to switch | Medium | Must survive rapid switching without layout flash |
| Toolbar — above grid | Row of controls: Hide fields, Filter, Sort, Group, Row height, Search | Medium | Each button opens a floating panel. Active state when panel is open |
| Grid itself | The table of rows and columns | High | The core product |

**Exact layout Airtable uses (MEDIUM confidence — cross-referenced from multiple community and guide sources):**

```
+------------------+------------------------------------------+
|  Left sidebar    |  [Base name]  [Data|Automations|...]      |
|  (bases list)    +------------------------------------------+
|                  |  [Table1] [Table2] [Table3] [+ Add table] |
|                  +--------+---------------------------------+
|                  | Views  |  [Toolbar: Hide|Filter|Sort...] |
|                  | panel  +--------------------------------- +
|                  |        |  Grid view                      |
|                  | Grid   |  [row# | expand | col1 | col2]  |
|                  | Gallery|  [row# | expand | val  | val  ] |
|                  | Kanban |  [ + Add record ]               |
|                  | (...)  |                                 |
+------------------+--------+---------------------------------+
```

### Grid Row Anatomy (HIGH confidence — multiple official and community sources agree)

| Element | Position | Behavior |
|---------|----------|----------|
| Row number | Leftmost, fixed column | Shows row index. On hover, shows checkbox for multi-select |
| Expand record icon | Appears on row hover, left of row | Opens full record detail view (modal or side panel) |
| Primary field | First data column, always frozen | Cannot be hidden. Always visible even when scrolling horizontally |
| Data cells | Remaining columns | Inline editable |
| "+" Add record button | Below last row | Adds a new empty row at the bottom |
| "+ Add field" button | Right of last column header | Opens field type picker |

### Cell Editing UX (HIGH confidence — keyboard shortcuts confirmed from official cheat sheets and community)

This is the core interaction loop. Users expect exact Excel/Google Sheets muscle memory.

**Navigation model (not in edit mode):**
- Arrow keys (Up/Down/Left/Right): Move selected cell one position
- Ctrl + Arrow: Jump to table edge
- Ctrl + Shift + Arrow: Jump to edge and extend selection
- Shift + Arrow: Extend selection range
- Page Up / Page Down: Scroll one screen vertically
- Alt + Page Up / Alt + Page Down: Scroll one screen horizontally

**Entering edit mode:**
- `Enter` on a selected cell: Enters edit mode for that cell
- Typing any character on a selected cell: Enters edit mode and replaces content (for single-line fields)
- Double-click: Enters edit mode
- `F2`: Enters edit mode

**While in edit mode (single-line text / number):**
- Arrow keys: Move cursor within the text
- `Escape`: Exit edit mode, discard changes if nothing typed, keep value otherwise — returns to navigation mode
- `Tab`: Commit edit, move selection one cell RIGHT
- `Enter`: For single-line fields — commits and moves DOWN one row. For multi-line text — inserts a line break (important distinction)
- Note: Users report Enter behavior varies by field type. This inconsistency is a known Airtable UX pain point.

**Record expansion:**
- `Space` on a selected row: Opens expanded record view (modal showing all fields)
- `Shift + Space`: Expands just the active cell
- Clicking the expand icon (left margin hover): Same as Space

**Copy/paste:**
- Ctrl+C / Cmd+C: Copy selected cell(s)
- Ctrl+X / Cmd+X: Cut selected cell(s)
- Ctrl+V / Cmd+V: Paste (if range selected, pastes same value into all)
- Ctrl+Z: Undo

### Inline Editing (MEDIUM confidence — community and official sources)

| Behavior | Detail |
|---------|--------|
| Click any cell to select | Single click = select, no edit yet |
| Click again or press Enter to edit | Two-interaction model |
| Typing immediately on selected cell | Replaces content and enters edit mode |
| Cell border highlights on selection | Blue border around selected cell |
| Edit mode indicator | Different visual state (cursor appears, different border style) |
| Multi-cell selection | Click + drag or Shift+click, shows blue shading |

### Views System (HIGH confidence — cross-referenced from official Airtable guides)

Every view is an independent saved configuration of the same underlying data. Editing data in one view changes the record everywhere (all views share the same rows).

**What each view independently saves:**
- Filter conditions (which rows are visible)
- Sort rules (order of rows)
- Hidden fields (which columns are visible)
- Field order (column order)
- Column widths
- Row height setting
- Search query (debatable — may not persist, LOW confidence)

**View types that exist in Airtable:**
Grid (default), Gallery, Kanban, Calendar, Form, Timeline (premium), Gantt (premium), List

**For v1, only Grid view is in scope.**

**View sections in sidebar:**
- "My personal views" — views only you can see/edit
- "My favorites" — starred views
- "More collaborative views" — default shared views section

**View permission types:**
- Collaborative: all base collaborators can edit the view config
- Personal: only creator can modify (Pro+ plan in Airtable)
- Locked: nobody can change config (protects production views)

### Toolbar Controls (HIGH confidence — multiple sources agree on these buttons)

Toolbar appears above the grid. Each button opens a floating panel. Order from left to right:

1. **Hide fields** — Toggles which columns are visible. Panel shows all fields with toggle switches. "Show all" / "Hide all" shortcuts. Cannot hide primary field. Includes "Find a field" search within the panel.
2. **Filter** — Opens filter panel. Adds condition rows. Each row = field + operator + value. Multiple conditions combined with AND/OR. Conditions differ by field type (see Filter section below).
3. **Sort** — Opens sort panel. Adds sort rules. Each rule = field + direction (A→Z or Z→A / 1→9 or 9→1). Multiple rules = cascading sort (first rule primary, second rule breaks ties).
4. **Group** — Groups rows by a field value into collapsible sections. Not in v1 scope.
5. **Row height** — Toggles between Short / Medium / Tall / Extra Tall. Affects how many rows are visible.
6. **Search** — Opens inline search bar. Ctrl+F / Cmd+F shortcut. Highlights matching cells. Shows "X of Y matches" counter.

**Toolbar active state:** When a panel is open or has active rules (e.g., 2 filters applied), the button shows a badge count or different color.

### Filter System (MEDIUM confidence — official Airtable docs confirmed by multiple community sources)

**Filter panel UX:**
- "+ Add filter" button adds a new condition row
- Each row: [field dropdown] [operator dropdown] [value input]
- Top-level AND/OR toggle applies to all conditions
- Conditions can be grouped (advanced, probably not needed v1)
- Filters apply live — grid updates as conditions are configured

**Text field filter operators:**
- contains
- does not contain
- is (exact match)
- is not
- is empty
- is not empty

**Number field filter operators:**
- = (equals)
- != (not equals)
- < (less than)
- <= (less than or equal)
- > (greater than)
- >= (greater than or equal)
- is empty
- is not empty

This divergence between text and number filter operators is a core reason column type matters. The filter UI must render different operator options per column type. (MEDIUM confidence — confirmed from community discussions and official docs overview)

### Sort System (HIGH confidence — official documentation + community bug reports)

**Sort behavior by field type:**
- Text fields: Alphabetical A→Z or Z→A. Uses natural sort (treats embedded numbers sensibly, "z2" before "z11").
- Number fields: Numeric ascending 1→9 or descending 9→1.

**Critical distinction:** A text field containing "10", "2", "20" sorts as: 10, 2, 20 (alphabetical) not 2, 10, 20 (numeric). This is a known Airtable gotcha. Number fields sort correctly numerically. This is why column type matters even in a v1 with just two types.

**Multi-sort (cascading):** Multiple sort rules stack. First rule is primary sort, subsequent rules break ties. UI shows rules in order with drag handles to reorder.

### Column Management (MEDIUM confidence — official Airtable support + community)

| Feature | Behavior |
|---------|----------|
| Column resize | Drag column header edge. Two-arrow cursor appears on hover |
| Column reorder | Drag column header left/right to reposition |
| Column hide/show | Managed through "Hide fields" toolbar panel |
| Primary field | Always first, always frozen, cannot be hidden, cannot be reordered away from position 1 |
| Frozen columns | Primary field frozen by default. Up to 3 additional columns can be frozen. Blue drag bar appears at freeze boundary |

### Search (MEDIUM confidence — community and official sources)

- Toolbar search button OR Ctrl+F / Cmd+F opens inline search bar above grid
- As you type, matching cells are highlighted
- Shows count: "X matching cells in Y records"
- Non-matching rows are NOT hidden (search highlights, does not filter)
- Different behavior from filters which hide non-matching rows
- This distinction is important for implementation: search is UI highlighting, filter is data query

### Row Operations (HIGH confidence — official Airtable documentation)

| Operation | How |
|-----------|-----|
| Add row | Click "+ Add record" below last row, or Shift+Enter on last row |
| Delete row | Right-click → Delete row, or select row and press Delete/Backspace in some contexts |
| Expand row | Click expand icon on row hover, or press Space |
| Duplicate row | Right-click → Duplicate record |
| Row height | Per-view setting affecting all rows (not per-row) |

---

## Differentiators

Features not universally expected but create "this feels like a real product" moments.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-50ms filter response on 1M rows | No competitor feels this fast at scale. The core promise | High | Requires server-side filtering with indexes, not client-side |
| Zero jank scroll on 1M rows | Instantly scroll anywhere — no blank placeholder rows, no "loading..." mid-viewport | High | Row virtualization with overscan + prefetch. Canvas-based rendering (NocoDB Grid 2.0 approach) |
| Optimistic cell updates | Cell value updates immediately on keypress, sync happens in background | Medium | Standard now but still differentiating vs lazy competitors |
| Persistent view state across sessions | Filters, sorts, visibility all survive page reload | Medium | Per-user, per-view persistence in DB |
| URL reflects view state | Sharing a URL shares the exact view (filter+sort+search active) | Medium | Encodes view ID (or view state) in URL |
| Column header sort click | Click column header = sort by that column ascending. Second click = descending. Third click = clear sort | Low | Power user feature, expected by spreadsheet users |
| Keyboard-first power user flow | Tab → right, Enter → down, Escape → cancel, arrow keys → navigate, all without touching mouse | Medium | Focus management is the hard part |
| Search highlights without hiding rows | Users can see context — matching rows highlighted, rest dimmed, not hidden | Low | Distinctly different from filter |
| View badge count | Toolbar button shows "3" if 3 filters active — users know state without opening panel | Low | Simple count in button badge |
| "Add a record" shortcut from keyboard | Shift+Enter on any row appends new row immediately | Low | Expected by power users |

---

## Anti-Features

Things to explicitly NOT build in v1. These waste time and distract from the core promise.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multiple view types (Kanban, Gallery, Calendar) | 3x implementation cost for features not core to the 1M row promise | Build Grid view to perfection. Add view types post-v1 |
| Rich text / long text field type | Adds multi-line editing complexity, cell height variability, markdown rendering | Keep text fields single-line in v1 |
| Formula fields | Dramatically increases complexity: parser, evaluator, dependency graph, circular detection | Defer entirely. Not needed to prove the core value |
| Attachment fields | File upload infrastructure, thumbnail generation, storage costs | Not needed for v1 |
| Linked record fields (relations) | Relational UI is a different product surface entirely | This is an Airtable differentiator, not a table stakes feature |
| Real-time collaborative editing | Operational transforms or CRDT for concurrent cell edits | Single-user or last-write-wins is fine for v1 |
| Comments on records | Separate product surface (threaded discussion) | Defer to post-v1 |
| Record coloring | Requires color rule engine tied to field values | Nice-to-have, not table stakes |
| Grouping records | Collapsible sections by field value — adds significant grid rendering complexity | Defer to post-v1 |
| Form view | Separate UI surface for data entry forms | Defer to post-v1 |
| Automations / workflows | Completely separate product surface | Not in scope |
| API access | REST/GraphQL API for bases | Important eventually, not for v1 MVP |
| Import CSV | Useful, but not needed to prove core value | Defer to post-v1 |
| Mobile experience | Mobile grid editing is a solved-differently problem | Build desktop-first, optimize mobile later |
| "Locked" or "Personal" view types | View permissions complexity | All views collaborative in v1 |
| Row height variants (other than Short) | Adds rendering complexity for virtually no v1 value | Default Short row height only |

---

## Feature Dependencies

Dependencies define build order. Nothing in a later step can be built before its dependency.

```
Google OAuth
    └── User session
        └── Bases (create, list, open)
            └── Tables (create, list, switch)
                └── Fields/Columns (Text, Number types)
                    └── Records/Rows (create, read, update, delete)
                        └── Grid view (render rows + columns)
                            ├── Cell selection (click to select)
                            │   └── Cell editing (inline edit, keyboard nav)
                            │       └── Optimistic updates
                            ├── Column resize (drag header edge)
                            ├── Column reorder (drag header)
                            └── Views (save/load view config)
                                ├── Hide fields (per view)
                                ├── Sort rules (per view)
                                │   └── Sort behavior differs by column type
                                ├── Filter conditions (per view)
                                │   └── Filter operators differ by column type
                                └── Row virtualization (needed at ~10K+ rows)
                                    └── Search (highlights matching rows)
```

**Critical path:** OAuth → Bases → Tables → Columns → Rows → Grid rendering → Cell editing → Views

Views (filter/sort/hide) can be added after basic grid works, but should be treated as a unit — implementing filters without sorts creates an incomplete feeling.

---

## MVP Recommendation

Given the stated goal (1M rows, instant scroll, Airtable-like UX), this is the correct v1 scope:

**Must have (without these it's not an Airtable clone):**
1. Auth: Google OAuth, private bases
2. Base/table navigation: left sidebar, table tab bar
3. Grid view: rows + columns, virtualized rendering
4. Column types: Text and Number (with different filter/sort operators)
5. Cell editing: inline edit, full keyboard navigation (arrow/tab/enter/escape)
6. Row CRUD: add row, delete row, expand record
7. Views panel: create view, switch view, name view
8. Toolbar: Hide fields, Filter (with per-type operators), Sort (cascading), Search (highlight)
9. Per-view state persistence: each view saves its filter/sort/hide config

**Should have (polish that makes it feel real, not just functional):**
- Toolbar badge counts (active filter/sort count shown on button)
- Column resize and reorder
- Primary field always frozen/pinned
- Optimistic cell updates (instant UI feedback)
- URL reflects active view

**Defer to post-v1:**
- Additional column types (date, select, checkbox, formula, attachment, linked record)
- Additional view types (Kanban, Gallery, Calendar, Form)
- Record grouping
- Record coloring
- Row height options
- CSV import
- API access
- Real-time collaboration

---

## Airtable "Magical" Moments vs. Table Stakes

This section captures UX details that distinguish "it works" from "it feels like Airtable."

**Table stakes (parity — if missing, users say "this is broken"):**
- Cell stays selected after typing Enter (don't lose selection)
- Arrow keys work immediately on page load (no need to click into grid first)
- Escape cancels an in-progress edit without saving
- Filter applies without needing to "submit" (live preview)
- Sort order persists when you navigate away and come back
- Column names are editable (double-click header)
- New rows appear at the bottom immediately (not after refresh)

**Magical moments (delight — if present, users say "this feels professional"):**
- Scrolling 1M rows feels instantaneous — no "Loading..." placeholder rows visible in viewport
- Filters execute in under 100ms even on 1M rows (server-side, indexed)
- Tab through cells at the end of a row wraps to first cell of next row (spreadsheet convention)
- Typing into a selected cell immediately starts editing (no need to press Enter first)
- Multi-cell paste (select a range, paste — fills all selected cells)
- The expand record icon appears exactly on row hover, not jittering in/out
- Column resize previews width live while dragging (not just after release)

**Anti-magical moments (these make users leave):**
- Blank/white rows visible while scrolling (virtual scroll loading artifact)
- Cell selection lost after filter change
- Keyboard shortcuts stop working after clicking elsewhere in page (focus trap bug)
- Filter panel closes on every change (forces repeated reopening)
- "Loading..." state that blocks interaction

---

## Sources

**HIGH confidence (verified from multiple official or near-official sources):**
- Keyboard shortcuts: [Airtable Cheat Sheet](https://quickref.me/airtable.html), [UseTheKeyboard.com](https://usethekeyboard.com/airtable/), community confirmations
- Views system behavior: [Softr Airtable Views Guide](https://www.softr.io/blog/airtable-views), [Airtable guides](https://www.airtable.com/guides/build/create-custom-views-of-data)
- Sort behavior text vs number: [Airtable community — sorting numbers in text fields](https://community.airtable.com/t5/other-questions/sorting-numbers-in-text-fields-unexpected-behavior/td-p/37248)
- Column resize/freeze: [Airtable support search results](https://support.airtable.com/docs/airtable-grid-view), [SwitchLabs freeze columns guide](https://www.switchlabs.dev/resources/guide-to-freezing-columns-in-airtable-for-improved-data-management)
- Primary field behavior: [Airtable — The primary field](https://support.airtable.com/docs/the-primary-field)
- Row operations: [Airtable — Adding, Duplicating, and Deleting Records](https://support.airtable.com/docs/adding-duplicating-and-deleting-airtable-records)

**MEDIUM confidence (one or two good sources, not directly from Airtable official docs):**
- Filter operators by type: community discussions + [JakeMGibson Airtable filters guide](https://jakemgibson.com/airtable-dh/filter_sort_group/)
- Toolbar button order: [Airtable guides](https://www.airtable.com/guides/build/create-custom-views-of-data), official documentation pages (CSS-only extracts, could not read prose)
- Layout diagram: synthesized from multiple community posts and screenshots described in guides
- Enter key behavior in edit mode: [Community thread](https://community.airtable.com/other-questions-13/shortcut-key-to-move-out-active-cell-and-go-down-a-row-15783)

**LOW confidence (inferred from patterns, not directly verified):**
- Search query not persisting per view across sessions — inferred from lack of mention, not confirmed
- Exact toolbar button order — Airtable has updated UI multiple times; order may differ from what is described
- Tab wrapping behavior at row end — described in community but not in official docs

**Known gaps:**
- Could not extract prose from Airtable's own support pages (pages returned CSS/JS instead of content)
- Exact 2025 UI layout may differ from pre-2024 descriptions due to the "New Base UI" update mentioned in community posts
- The grid view toolbar order is described as Hide Fields → Filter → Sort → Group, but this should be visually verified against current Airtable before implementation
