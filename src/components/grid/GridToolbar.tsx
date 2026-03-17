"use client";

import type { FilterCondition, SortCondition } from "~/server/api/routers/row";

interface ColumnMeta {
  id: string;
  name: string;
  type: string;
}

interface GridToolbarProps {
  onBulkCreate: () => void;
  isBulkCreating: boolean;
  rowCount: number;
  // Toolbar state (managed in GridView)
  filters: FilterCondition[];
  sorts: SortCondition[];
  searchInput: string;
  hiddenColumns: string[];
  openPanel: "search" | "filter" | "sort" | "hideFields" | null;
  setOpenPanel: (panel: "search" | "filter" | "sort" | "hideFields" | null) => void;
  setSearchInput: (value: string) => void;
  setFilters: (filters: FilterCondition[]) => void;
  setSorts: (sorts: SortCondition[]) => void;
  setHiddenColumns: (ids: string[]) => void;
  columnsData: ColumnMeta[];
}

export function GridToolbar({
  onBulkCreate,
  isBulkCreating,
  filters,
  sorts,
  hiddenColumns,
  openPanel,
  setOpenPanel,
  setSearchInput,
  searchInput,
}: GridToolbarProps) {
  const togglePanel = (panel: "search" | "filter" | "sort" | "hideFields") => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  return (
    <div
      className="flex h-[44px] flex-shrink-0 items-center border-b border-[#e2e0ea] bg-white px-2"
      data-testid="grid-toolbar"
    >
      {/* Left: hamburger + Grid view toggle */}
      <button className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[#4c5667] hover:bg-[#edf0f4]" title="Toggle views">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      <button
        className="flex flex-shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium text-[#1f2328] hover:bg-[#edf0f4]"
        data-testid="grid-view-button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#166ee1]">
          <rect x="1" y="1" width="5" height="5" rx="0.75" fill="currentColor" />
          <rect x="8" y="1" width="5" height="5" rx="0.75" fill="currentColor" />
          <rect x="1" y="8" width="5" height="5" rx="0.75" fill="currentColor" />
          <rect x="8" y="8" width="5" height="5" rx="0.75" fill="currentColor" />
        </svg>
        Grid view
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#6b7280]">
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Separator */}
      <div className="mx-2 h-5 w-px flex-shrink-0 bg-[#e2e0ea]" />

      {/* Spacer — pushes all right buttons to the right */}
      <div className="flex-1" />

      {/* Search bar — shown inline when panel is open */}
      {openPanel === "search" && (
        <div className="mr-2 flex items-center rounded border border-[#d0cfe8] bg-white px-2">
          <SearchIcon />
          <input
            autoFocus
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search records..."
            className="ml-1.5 w-40 bg-transparent py-1 text-[13px] text-[#1f2328] outline-none placeholder:text-[#aaa]"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="ml-1 text-[#9ca3af] hover:text-[#374151]"
              title="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Right-side toolbar buttons */}
      <div className="flex items-center">
        <ToolbarButton
          icon={<HideFieldsIcon />}
          label="Hide fields"
          badgeCount={hiddenColumns.length}
          isActive={openPanel === "hideFields"}
          onClick={() => togglePanel("hideFields")}
        />
        <ToolbarButton
          icon={<FilterIcon />}
          label="Filter"
          badgeCount={filters.length}
          isActive={openPanel === "filter"}
          onClick={() => togglePanel("filter")}
        />
        <ToolbarButton icon={<GroupIcon />} label="Group" />
        <ToolbarButton
          icon={<SortIcon />}
          label="Sort"
          badgeCount={sorts.length}
          isActive={openPanel === "sort"}
          onClick={() => togglePanel("sort")}
        />
        <ToolbarButton icon={<ColorIcon />} label="Color" />
        <button className="flex flex-shrink-0 items-center justify-center rounded px-2 py-1.5 text-[#4c5667] hover:bg-[#edf0f4]" title="Row height">
          <RowHeightIcon />
        </button>
        <ToolbarButton icon={<ShareSyncIcon />} label="Share and sync" />
        <div className="mx-1 h-5 w-px bg-[#e2e0ea]" />
        <button
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[#4c5667] hover:bg-[#edf0f4] ${openPanel === "search" ? "bg-[#edf0f4] text-[#166ee1]" : ""}`}
          title="Search"
          onClick={() => togglePanel("search")}
        >
          <SearchIcon />
        </button>
      </div>

      {/* Dev: bulk insert — small icon-only button */}
      <button
        onClick={onBulkCreate}
        disabled={isBulkCreating}
        className="ml-2 flex-shrink-0 rounded bg-[#2563eb] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
        title="Bulk insert 100k rows"
      >
        {isBulkCreating ? "…" : "+100k"}
      </button>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  badgeCount = 0,
  isActive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badgeCount?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1 rounded px-2 py-1.5 text-[13px] hover:bg-[#edf0f4] ${isActive ? "bg-[#edf0f4] text-[#166ee1]" : "text-[#4c5667]"}`}
    >
      {icon}
      {label}
      {badgeCount > 0 && (
        <span className="ml-0.5 rounded-full bg-[#166ee1] px-1.5 py-0.5 text-[10px] font-medium text-white">
          {badgeCount}
        </span>
      )}
    </button>
  );
}

function HideFieldsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="2.5" width="11" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="3" y="5.75" width="7" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="5" y="9" width="3" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3h10M3.5 6.5h6M5.5 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="2" width="5" height="3.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1" y="7.5" width="5" height="3.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M8 3.75h3M8 9.25h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3.5h4M1.5 6.5h6.5M1.5 9.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ColorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 1.75v8.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2.5 4l8 4M2.5 8l8-4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function RowHeightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ShareSyncIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 1.5L11.5 4 9 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 9V7a3 3 0 0 1 3-3h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
