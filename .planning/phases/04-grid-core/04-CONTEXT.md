# Phase 4: Grid Core - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The virtualized grid renders live rows from the database, handles 100k+ rows without lag, supports column management (add Text/Number columns, rename via double-click, delete), and includes a 100k row bulk insert button with loading state. Cell editing is NOT in scope — Phase 5 handles that. This phase makes the grid ready for editing to be layered on top.

</domain>

<decisions>
## Implementation Decisions

### Grid visual fidelity
- Pixel-accurate Airtable match — indistinguishable at a glance
- User provided a direct screenshot of Airtable as the visual reference (see Specific Ideas)

### Row height & density
- ~31px row height (Airtable compact default — matches the screenshot)
- Dense rows, showing maximum data

### Gridlines
- Full grid: light gray horizontal AND vertical lines on every cell
- Every cell is fully bordered — no horizontal-only shortcut

### Row colors
- All white — no alternating/zebra striping (matches Airtable default)

### Frozen left columns
- Checkbox column + row number column frozen on the left edge
- Both stay visible while scrolling horizontally
- Row numbers: 1, 2, 3... (narrow ~40px column)
- Checkbox: unchecked squares (selection behavior is Phase 5+, but the column renders in Phase 4)

### Column types rendered
- Text and Number only (matches COL-01/COL-02 roadmap scope)
- Column headers: type icon on left + column name; ⓘ info icon on right
- "+" button as the rightmost header cell to add a new column

### Bottom bar
- Shows record count label: "X records" at bottom left
- "+" add row button at bottom left of the grid body

### Claude's Discretion
- Exact column header background color (match Airtable's light gray as closely as possible)
- Hover states on column headers (sort icon appearance)
- Exact border color value (match screenshot)
- Scroll trigger point for fetchNextPage (viewport edge or near-edge threshold)
- Loading skeleton design during initial fetch

</decisions>

<specifics>
## Specific Ideas

- User provided a direct Airtable screenshot showing the complete grid UI. Key observations:
  - Checkbox column is leftmost (~32px), then row number column (~40px), then data columns
  - Column headers have a light gray background distinctly different from white cell rows
  - Each column header shows: left-aligned type icon + column name text
  - Rightmost header is a bare "+" button to add columns
  - Empty cells are blank white — no placeholder text
  - The grid body area below existing rows is a lighter gray (empty space), not white
  - "3 records" label at the very bottom left; "+ Add..." button next to it
  - No alternating row colors — pure white rows throughout

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-grid-core*
*Context gathered: 2026-03-17*
