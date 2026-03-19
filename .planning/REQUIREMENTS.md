# Requirements: Airtable Clone

**Defined:** 2026-03-17
**Core Value:** A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign in via Google OAuth
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can sign out from any page

### Bases

- [x] **BASE-01**: User can create a new base
- [x] **BASE-02**: User can rename a base
- [x] **BASE-03**: User can delete a base
- [x] **BASE-04**: User can only see their own bases (private, no sharing)

### Tables

- [x] **TBL-01**: User can create a new table within a base
- [x] **TBL-02**: User can rename a table
- [x] **TBL-03**: User can delete a table
- [x] **TBL-04**: New tables are pre-populated with default rows and columns using faker.js data
- [x] **TBL-05**: User can add 100k rows to any table via a single button click

### Columns

- [x] **COL-01**: User can dynamically add a Text-type column to a table
- [x] **COL-02**: User can dynamically add a Number-type column to a table
- [x] **COL-03**: User can rename a column by double-clicking its header
- [x] **COL-04**: User can delete a column (removes column and all its cell data)

### Cell Editing

- [x] **CELL-01**: User can click a cell to enter edit mode and edit its value
- [x] **CELL-02**: Arrow keys move between cells in navigation mode
- [x] **CELL-03**: Tab moves to next cell (right); Shift+Tab moves to previous cell (left)
- [x] **CELL-04**: Enter key enters edit mode on selected cell; Escape exits edit mode back to navigation mode
- [x] **CELL-05**: Cell changes are persisted to the database on commit (blur or Enter)

### Performance

- [x] **PERF-01**: Table uses virtualized infinite scroll — only visible rows are rendered in the DOM
- [x] **PERF-02**: Row virtualization handles 1M rows without lag (TanStack Virtualizer)
- [x] **PERF-03**: Column virtualization handles large numbers of columns without lag
- [x] **PERF-04**: Columns are fetched incrementally as the user scrolls horizontally
- [x] **PERF-05**: Loading states are shown during all async operations (fetch, filter, sort, search)

### Search, Filter & Sort

- [x] **SFS-01**: User can search across all cells — search hides non-matching rows (row-level filter)
- [x] **SFS-02**: Search is executed at the database level
- [x] **SFS-03**: User can filter Text columns by: is empty, is not empty, contains, does not contain, equals
- [x] **SFS-04**: User can filter Number columns by: greater than, less than
- [x] **SFS-05**: All column filters are executed at the database level
- [x] **SFS-06**: User can sort any Text column ascending (A→Z) or descending (Z→A)
- [x] **SFS-07**: User can sort any Number column ascending or descending
- [x] **SFS-08**: All sorting is executed at the database level

### Views

- [x] **VIEW-01**: User can create a named view within a table
- [x] **VIEW-02**: User can switch between views from the left views panel
- [x] **VIEW-03**: Each view saves and restores its filter configuration
- [x] **VIEW-04**: Each view saves and restores its sort configuration
- [x] **VIEW-05**: Each view saves and restores column visibility (hidden/shown columns)
- [x] **VIEW-06**: Each view saves and restores the active search query

### UI Layout

- [x] **UI-01**: Left sidebar displays the user's bases and allows navigation between them
- [x] **UI-02**: Top tab bar displays tables within the current base
- [x] **UI-03**: Left views panel displays saved views for the current table
- [x] **UI-04**: Top toolbar contains search, filter, sort, and hide-columns controls
- [ ] **UI-05**: Overall layout matches Airtable 1:1 in structure and visual style

## v2 Requirements

### Column Types

- **COL-V2-01**: Date/time column type
- **COL-V2-02**: Checkbox column type
- **COL-V2-03**: Select / multi-select column type
- **COL-V2-04**: URL column type

### Collaboration

- **COLLAB-01**: User can share a base with another user
- **COLLAB-02**: Shared base shows real-time edits from collaborators

### Import / Export

- **IO-01**: User can import a CSV into a table
- **IO-02**: User can export a table as CSV

### Row Management

- **ROW-01**: User can reorder rows via drag-and-drop
- **ROW-02**: User can delete individual rows

## Out of Scope

| Feature | Reason |
|---------|--------|
| Supabase Auth | Using NextAuth.js — Supabase is Postgres host only |
| Formula columns | Significant complexity; not core to v1 value |
| Row-level comments or attachments | Out of core spreadsheet scope |
| Mobile layout | Desktop-first; Airtable itself is desktop-focused |
| Real-time collaborative editing | Single-user for v1; architecture allows adding later |
| OAuth providers other than Google | Google covers the use case; others are v2 |
| Column reordering via drag-and-drop | Nice to have, not core UX |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| BASE-01 | Phase 3/10 | Complete |
| BASE-02 | Phase 3/10 | Complete |
| BASE-03 | Phase 3/10 | Complete |
| BASE-04 | Phase 1 | Complete |
| TBL-01 | Phase 3 | Complete |
| TBL-02 | Phase 3 | Complete |
| TBL-03 | Phase 3 | Complete |
| TBL-04 | Phase 3 | Complete |
| TBL-05 | Phase 4 | Complete |
| COL-01 | Phase 4 | Complete |
| COL-02 | Phase 4 | Complete |
| COL-03 | Phase 4 | Complete |
| COL-04 | Phase 4 | Complete |
| CELL-01 | Phase 5 | Complete |
| CELL-02 | Phase 5 | Complete |
| CELL-03 | Phase 5 | Complete |
| CELL-04 | Phase 5 | Complete |
| CELL-05 | Phase 5 | Complete |
| PERF-01 | Phase 4 | Complete |
| PERF-02 | Phase 4 | Complete |
| PERF-03 | Phase 7 | Complete |
| PERF-04 | Phase 7 | Complete |
| PERF-05 | Phase 4 | Complete |
| SFS-01 | Phase 12 | Complete |
| SFS-02 | Phase 12 | Complete |
| SFS-03 | Phase 6 | Complete |
| SFS-04 | Phase 6 | Complete |
| SFS-05 | Phase 6 | Complete |
| SFS-06 | Phase 6 | Complete |
| SFS-07 | Phase 6 | Complete |
| SFS-08 | Phase 6 | Complete |
| VIEW-01 | Phase 8 | Complete |
| VIEW-02 | Phase 8 | Complete |
| VIEW-03 | Phase 8 | Complete |
| VIEW-04 | Phase 8 | Complete |
| VIEW-05 | Phase 8 | Complete |
| VIEW-06 | Phase 8/12 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 6 | Complete |
| UI-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0 (Phase 2 is infrastructure — no direct req IDs, enables all subsequent phases)

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-19 after Phase 13-01 completion (all v1 requirements checked except UI-05)*
