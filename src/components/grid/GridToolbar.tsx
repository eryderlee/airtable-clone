"use client";

import type { FilterCondition, SortCondition } from "~/server/api/routers/row";
import { SearchBar } from "./toolbar/SearchBar";
import { FilterPanel } from "./toolbar/FilterPanel";
import { SortPanel } from "./toolbar/SortPanel";
import { HideFieldsPanel } from "./toolbar/HideFieldsPanel";

interface GridToolbarProps {
  onBulkCreate: () => void;
  isBulkCreating: boolean;
  onBulkAddColumns: () => void;
  rowCount: number;
  // Panel state
  openPanel: "search" | "filter" | "sort" | "hideFields" | null;
  onTogglePanel: (panel: "search" | "filter" | "sort" | "hideFields") => void;
  // Search
  searchInput: string;
  onSearchChange: (value: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  hasActiveSearch: boolean;
  // Filter
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  // Sort
  sorts: SortCondition[];
  onSortsChange: (sorts: SortCondition[]) => void;
  // Column data for pickers
  columnsData: { id: string; name: string; type: string; isPrimary: boolean }[];
  // Hidden columns
  hiddenColumns: string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
}

export function GridToolbar({
  onBulkCreate,
  isBulkCreating,
  onBulkAddColumns,
  filters,
  sorts,
  hiddenColumns,
  onHiddenColumnsChange,
  openPanel,
  onTogglePanel,
  onSearchChange,
  searchInput,
  onFiltersChange,
  onSortsChange,
  columnsData,
  matchCount,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
  hasActiveSearch,
}: GridToolbarProps) {
  return (
    <div
      className="relative flex h-[44px] flex-shrink-0 items-center border-b border-[#e2e0ea] bg-white px-2"
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


      {/* Spacer — pushes all right buttons to the right */}
      <div className="flex-1" />

      {/* Right-side toolbar buttons */}
      <div className="flex items-center">
        <ToolbarButton
          icon={<HideFieldsIcon />}
          label="Hide fields"
          badgeCount={hiddenColumns.length}
          isActive={openPanel === "hideFields"}
          onClick={() => onTogglePanel("hideFields")}
        />
        <ToolbarButton
          icon={<FilterIcon />}
          label="Filter"
          badgeCount={filters.length}
          isActive={openPanel === "filter"}
          onClick={() => onTogglePanel("filter")}
        />
        <ToolbarButton icon={<GroupIcon />} label="Group" />
        <ToolbarButton
          icon={<SortIcon />}
          label="Sort"
          badgeCount={sorts.length}
          isActive={openPanel === "sort"}
          onClick={() => onTogglePanel("sort")}
        />
        <ToolbarButton icon={<ColorIcon />} label="Color" />
        <button className="flex flex-shrink-0 items-center justify-center rounded px-2 py-1.5 text-[#4c5667] hover:bg-[#edf0f4]" title="Row height">
          <RowHeightIcon />
        </button>
        <ToolbarButton icon={<ShareSyncIcon />} label="Share and sync" />
        <button
          className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[#4c5667] hover:bg-[#edf0f4] ${openPanel === "search" || hasActiveSearch ? "text-[#166ee1]" : ""} ${openPanel === "search" ? "bg-[#edf0f4]" : ""}`}
          title="Search"
          onClick={() => onTogglePanel("search")}
        >
          <SearchIcon />
          {hasActiveSearch && openPanel !== "search" && (
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#166ee1]" />
          )}
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
      {/* Dev: bulk add columns for testing column virtualization */}
      <button
        onClick={onBulkAddColumns}
        className="ml-1 flex-shrink-0 rounded bg-[#7c3aed] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#6d28d9]"
        title="Add 20 columns for testing"
      >
        +20cols
      </button>

      {/* Dropdown panels — absolutely positioned below toolbar */}
      {openPanel === "search" && (
        <div className="absolute right-0 top-full z-50 mt-1" data-toolbar-panel>
          <SearchBar
            searchInput={searchInput}
            onSearchChange={onSearchChange}
            onClose={() => onTogglePanel("search")}
            matchCount={matchCount}
            currentMatchIndex={currentMatchIndex}
            onPrevMatch={onPrevMatch}
            onNextMatch={onNextMatch}
          />
        </div>
      )}
      {openPanel === "filter" && (
        <div className="absolute right-0 top-full z-50 mt-1" data-toolbar-panel>
          <FilterPanel
            filters={filters}
            onFiltersChange={onFiltersChange}
            columnsData={columnsData}
            onClose={() => onTogglePanel("filter")}
          />
        </div>
      )}
      {openPanel === "sort" && (
        <div className="absolute right-0 top-full z-50 mt-1" data-toolbar-panel>
          <SortPanel
            sorts={sorts}
            onSortsChange={onSortsChange}
            columnsData={columnsData}
            onClose={() => onTogglePanel("sort")}
          />
        </div>
      )}
      {openPanel === "hideFields" && (
        <div className="absolute right-0 top-full z-50 mt-1" data-toolbar-panel>
          <HideFieldsPanel
            columnsData={columnsData}
            hiddenColumns={hiddenColumns}
            onHiddenColumnsChange={onHiddenColumnsChange}
            onClose={() => onTogglePanel("hideFields")}
          />
        </div>
      )}
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
