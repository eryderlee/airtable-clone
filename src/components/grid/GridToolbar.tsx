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
  isBulkAddingColumns: boolean;
  onToggleViewsPanel: () => void;
  viewsPanelOpen: boolean;
  onHamburgerMouseEnter: () => void;
  onHamburgerMouseLeave: () => void;
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
  isBulkAddingColumns,
  onToggleViewsPanel,
  viewsPanelOpen,
  onHamburgerMouseEnter,
  onHamburgerMouseLeave,
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
      className="relative flex h-[48px] flex-shrink-0 items-center border-b border-[#e2e0ea] bg-white pl-3 pr-5"
      data-testid="grid-toolbar"
    >
      {/* Left: hamburger + Grid view toggle */}
      <button
        onClick={onToggleViewsPanel}
        onMouseEnter={onHamburgerMouseEnter}
        onMouseLeave={onHamburgerMouseLeave}
        className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[#4c5667] hover:bg-[#edf0f4]"
        title="Toggle views"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
          <path d="M2.5 4.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1ZM2.5 8.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1ZM2.5 12.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1Z" />
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
      <div className="flex items-center gap-2">
        <div className="relative" data-toolbar-panel>
          <ToolbarButton
            icon={<HideFieldsIcon />}
            label="Hide fields"
            badgeCount={hiddenColumns.length}
            badgeLabel={(n) => `${n} hidden ${n === 1 ? "field" : "fields"}`}
            isActive={openPanel === "hideFields"}
            onClick={() => onTogglePanel("hideFields")}
          />
          {openPanel === "hideFields" && (
            <div className="absolute left-0 top-full z-50 mt-1" data-toolbar-panel>
              <HideFieldsPanel
                columnsData={columnsData}
                hiddenColumns={hiddenColumns}
                onHiddenColumnsChange={onHiddenColumnsChange}
                onClose={() => onTogglePanel("hideFields")}
              />
            </div>
          )}
        </div>
        <div className="relative" data-toolbar-panel>
          <ToolbarButton
            icon={<FilterIcon />}
            label="Filter"
            badgeCount={filters.length}
            badgeLabel={() => {
              const names = filters.map((f) => columnsData.find((c) => c.id === f.columnId)?.name ?? "").filter(Boolean);
              return `Filtered by ${names.join(", ")}`;
            }}
            activeColor="green"
            isActive={openPanel === "filter"}
            onClick={() => onTogglePanel("filter")}
          />
          {openPanel === "filter" && (
            <div className="absolute left-0 top-full z-50 mt-1" data-toolbar-panel>
              <FilterPanel
                filters={filters}
                onFiltersChange={onFiltersChange}
                columnsData={columnsData}
                onClose={() => onTogglePanel("filter")}
              />
            </div>
          )}
        </div>
        <ToolbarButton icon={<GroupIcon />} label="Group" />
        <div className="relative" data-toolbar-panel>
          {sorts.length > 0 ? (
            <button
              onClick={() => onTogglePanel("sort")}
              className={`flex flex-shrink-0 items-center rounded px-2 py-1 text-[13px] font-medium text-black transition ${openPanel === "sort" ? "bg-[#ffd0b0]" : "bg-[#FFE0CC]"} hover:bg-[#ffd0b0]`}
            >
              <SortIcon />
              <span className="ml-1 max-w-[120px] truncate">
                Sorted by {sorts.length} {sorts.length === 1 ? "field" : "fields"}
              </span>
            </button>
          ) : (
            <ToolbarButton
              icon={<SortIcon />}
              label="Sort"
              isActive={openPanel === "sort"}
              onClick={() => onTogglePanel("sort")}
            />
          )}
          {openPanel === "sort" && (
            <div className="absolute left-0 top-full z-50 mt-1" data-toolbar-panel>
              <SortPanel
                sorts={sorts}
                onSortsChange={onSortsChange}
                columnsData={columnsData}
                onClose={() => onTogglePanel("sort")}
              />
            </div>
          )}
        </div>
        <ToolbarButton icon={<ColorIcon />} label="Color" />
        <button className="flex flex-shrink-0 items-center justify-center rounded px-2 py-1.5 text-[#4c5667] hover:bg-[#edf0f4]" title="Row height">
          <RowHeightIcon />
        </button>
        <ToolbarButton icon={<ShareSyncIcon />} label="Share and sync" />
        <div className="relative" data-toolbar-panel>
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
        </div>
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
        disabled={isBulkAddingColumns}
        className="ml-1 flex-shrink-0 rounded bg-[#7c3aed] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-50"
        title="Add 20 columns for testing"
      >
        {isBulkAddingColumns ? "…" : "+20cols"}
      </button>

    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  badgeCount = 0,
  badgeLabel,
  activeColor = "cyan",
  isActive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badgeCount?: number;
  badgeLabel?: (n: number) => string;
  activeColor?: "cyan" | "green";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const hasCount = badgeCount > 0;
  const displayLabel = hasCount && badgeLabel ? badgeLabel(badgeCount) : label;
  const activeCls = hasCount
    ? activeColor === "green"
      ? "bg-[#d1f5d3] text-[#0a1929] hover:bg-[#b8eabc]"
      : "bg-[#d0f0f5] text-[#0a1929] hover:bg-[#b8e8f0]"
    : isActive
    ? "bg-[#edf0f4] text-[#166ee1] hover:bg-[#edf0f4]"
    : "text-[#4c5667] hover:bg-[#edf0f4]";
  return (
    <button
      onClick={onClick}
      className={`flex flex-shrink-0 items-center rounded px-2 py-1 text-[13px] font-light transition-colors ${activeCls}`}
    >
      {icon}
      <span className="ml-1 max-w-[160px] truncate">{displayLabel}</span>
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
