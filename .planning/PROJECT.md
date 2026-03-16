# Airtable Clone

## What This Is

A high-performance Airtable clone built with the T3 stack, deployed on Vercel. Users sign in with Google, create private bases, and manage tables with dynamically typed columns — all through a pixel-perfect Airtable UI. The core engineering challenge is rendering and operating on tables with up to 1 million rows without lag.

## Core Value

A table UI that feels exactly like Airtable and never chokes — 1M rows, instant scroll, DB-level filtering.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can sign in via Google OAuth
- [ ] User can create and manage private bases (visible only to them)
- [ ] Each base can contain multiple tables, navigable via top tab bar
- [ ] Tables have a left-sidebar views panel and a top toolbar (filter, sort, search, hide columns)
- [ ] User can dynamically add Text and Number type columns to a table
- [ ] Cell editing works inline; arrow keys and Tab navigate across cells smoothly
- [ ] New tables are pre-populated with default rows/columns using faker.js data
- [ ] User can add 100k rows to any table via a single button click
- [ ] Table renders 100k+ rows without lag using virtualized infinite scroll (tRPC + TanStack Virtualizer)
- [ ] User can search across all cells — search acts as a row filter
- [ ] User can create named views per table that save: column filters, sort rules, search query, and column visibility
- [ ] Column filters support: text (is empty, is not empty, contains, does not contain, equals) and number (greater than, less than)
- [ ] Column sorting supports: text (A→Z, Z→A) and number (ascending, descending)
- [ ] All search, filter, and sort operations execute at the database level
- [ ] Loading states are shown during any async data operation
- [ ] Target: 1M row tables load and scroll without issue

### Out of Scope

- Multi-user collaboration / base sharing — private-only for now; complexity not worth it in v1
- Supabase Auth — using NextAuth.js instead; Supabase is Postgres host only
- Column types beyond Text and Number — covers the core use case; more types are v2
- Real-time sync / live updates — not needed for single-user
- Mobile layout — desktop-first, Airtable itself is desktop-focused
- Row-level comments or attachments — out of core scope
- Formula columns — significant complexity, v2+
- Import/export (CSV etc.) — v2

## Context

- **T3 Stack**: Next.js (App Router), tRPC, NextAuth.js, Drizzle ORM, TypeScript — initialized via `create.t3.gg`
- **Database**: PostgreSQL hosted on Supabase (user has existing Supabase experience; chosen over Neon for familiarity — both are equivalent in performance for this use case)
- **Table UI**: TanStack Table for grid rendering, TanStack Virtualizer for row virtualization
- **Auth**: NextAuth.js with Google Provider — Supabase Auth is explicitly not used
- **Fake data**: faker.js for default row/column population on new tables
- **Deployment**: Vercel
- **UI Reference**: Playwright MCP will be used to inspect live Airtable CSS/layout for pixel-accurate matching
- **Development MCPs in use**:
  - **Context7** — live docs for TanStack Table, TanStack Virtualizer, tRPC, NextAuth, Drizzle
  - **Playwright** — scrape Airtable UI for CSS reference + E2E test keyboard navigation and cell interactions
  - **pg-aiGuide** — optimize PostgreSQL queries and indexes for 1M row performance
  - **Supabase MCP** — manage schema, run queries, and inspect data directly during development
  - **Vercel MCP** — manage deployments, env vars, and logs without leaving the editor

## Constraints

- **Tech Stack**: T3 (Next.js + tRPC + Drizzle + NextAuth) — no deviations; established by user
- **Database**: Supabase PostgreSQL — user is experienced here, no switching
- **Performance**: Must handle 1M rows smoothly — requires DB-level ops and virtualization; no client-side filtering/sorting
- **Table Library**: TanStack Table + TanStack Virtualizer — specified by user
- **Deployment**: Vercel — all architecture decisions must be serverless-compatible
- **UI Fidelity**: Must match Airtable 1:1 — left sidebar (bases nav), top tab bar (tables), views panel, toolbar with filter/sort/search/hide

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase over Neon for PostgreSQL | User has existing Supabase experience; both are equivalent in raw query perf for this use case | — Pending |
| NextAuth.js for Google OAuth | T3-native, no need for Supabase Auth — keeps Supabase as a pure Postgres host | — Pending |
| TanStack Table + Virtualizer | Specified by user; best-in-class for virtualized table UIs in React | — Pending |
| DB-level filter/sort/search | Required for 1M row target; client-side ops would be unusable at that scale | — Pending |
| faker.js for default data | Quick realistic data for new tables without manual entry | — Pending |
| Drizzle ORM | T3 stack default, type-safe, works well with tRPC and Supabase Postgres | — Pending |

---
*Last updated: 2026-03-17 after initialization*
