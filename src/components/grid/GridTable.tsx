"use client";

import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import React, { useRef, useState, useEffect } from "react";

import { GridCell } from "./GridCell";
import { GridHeader } from "./GridHeader";

export type RowData = {
  id: string;
  cells: Record<string, string | number | null>;
};

// Column virtualization activates when column count meets or exceeds this threshold
export const COLUMN_VIRTUALIZATION_THRESHOLD = 20;

// Stable empty array so useReactTable doesn't see a new reference each render
const EMPTY_ROWS: RowData[] = [];

interface GridTableProps {
  getRow: (index: number) => RowData | undefined;
  columnIds: string[];
  columnWidths: Record<string, number>;
  columns: ColumnDef<RowData>[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isBulkCreating: boolean;
  onRenameColumn: (columnId: string, name: string) => void;
  onUpdateColumn: (columnId: string, name: string, type: "text" | "number") => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
  displayCount: number;
  searchQuery?: string;
  currentSearchMatch?: { rowIndex: number; columnId: string } | null;
  cursor: { rowIndex: number; columnId: string } | null;
  editingCell: { rowIndex: number; columnId: string } | null;
  onSelect: (rowIndex: number, columnId: string) => void;
  onStartEditing: (rowIndex: number, columnId: string) => void;
  onCommit: (rowId: string, columnId: string, value: string | number | null) => void;
  onRevert: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  initialDraft?: string;
  rowVirtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, Element> | null>;
  columnVirtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, Element> | null>;
  selectedRowIds: Set<string>;
  onToggleRow: (rowId: string) => void;
  onSelectAll: () => void | Promise<void>;
  onClearSelection: () => void;
  onDeleteSelectedRows: () => void;
  allSelected: boolean;
  onAddRow: () => void;
}

export const GridTable = React.memo(function GridTable({
  getRow,
  columnIds,
  columnWidths,
  columns,
  onScroll,
  isBulkCreating,
  onRenameColumn,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  displayCount,
  searchQuery,
  currentSearchMatch,
  cursor,
  editingCell,
  onSelect,
  onStartEditing,
  onCommit,
  onRevert,
  onKeyDown,
  initialDraft,
  rowVirtualizerRef,
  columnVirtualizerRef,
  selectedRowIds,
  onToggleRow,
  onSelectAll,
  onClearSelection,
  onDeleteSelectedRows,
  allSelected,
  onAddRow,
}: GridTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const vScrollbarRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync mirror scrollbars <-> grid scroll
  useEffect(() => {
    const grid = parentRef.current;
    const bar = scrollbarRef.current;
    const vBar = vScrollbarRef.current;
    if (!grid || !bar || !vBar) return;

    function onGridScroll() {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      bar!.scrollLeft = grid!.scrollLeft;
      vBar!.scrollTop = grid!.scrollTop;
      isSyncingRef.current = false;
    }
    function onBarScroll() {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      grid!.scrollLeft = bar!.scrollLeft;
      isSyncingRef.current = false;
    }
    function onVBarScroll() {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      grid!.scrollTop = vBar!.scrollTop;
      isSyncingRef.current = false;
    }

    grid.addEventListener("scroll", onGridScroll);
    bar.addEventListener("scroll", onBarScroll);
    vBar.addEventListener("scroll", onVBarScroll);
    return () => {
      grid.removeEventListener("scroll", onGridScroll);
      bar.removeEventListener("scroll", onBarScroll);
      vBar.removeEventListener("scroll", onVBarScroll);
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  // Table is used only for column header management — row data bypasses it
  const table = useReactTable({
    data: EMPTY_ROWS,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });

  const rowVirtualizer = useVirtualizer({
    count: displayCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
    measureElement:
      typeof window !== "undefined" && !navigator.userAgent.includes("Firefox")
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });
  rowVirtualizerRef.current = rowVirtualizer;

  // Column virtualization — only activates when column count >= threshold
  const shouldVirtualizeColumns = columnIds.length >= COLUMN_VIRTUALIZATION_THRESHOLD;

  const columnVirtualizer = useVirtualizer({
    count: columnIds.length,
    estimateSize: (index) => columnWidths[columnIds[index] ?? ""] ?? 180,
    getScrollElement: () => parentRef.current,
    horizontal: true,
    overscan: 3,
    enabled: shouldVirtualizeColumns,
  });
  columnVirtualizerRef.current = columnVirtualizer;

  // Derived values for column virtualization rendering
  const virtualColumns = shouldVirtualizeColumns ? columnVirtualizer.getVirtualItems() : null;
  const virtualPaddingLeft = virtualColumns
    ? (() => {
        const firstVcStart = virtualColumns[0]?.start ?? 0;
        const primaryId = columnIds[0];
        const primaryWidth = primaryId ? (columnWidths[primaryId] ?? 180) : 0;
        // If primary column is outside the virtual window (prepended manually),
        // subtract its width from the left spacer to avoid double-counting
        const firstVcId = columnIds[virtualColumns[0]?.index ?? 0];
        const primaryOutside = primaryId && firstVcId !== primaryId;
        return primaryOutside ? Math.max(0, firstVcStart - primaryWidth) : firstVcStart;
      })()
    : 0;
  const virtualPaddingRight = virtualColumns
    ? columnVirtualizer.getTotalSize() - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
    : 0;
  const columnsToRender: string[] = virtualColumns
    ? (() => {
        const ids = virtualColumns.flatMap((vc) => {
          const id = columnIds[vc.index];
          return id !== undefined ? [id] : [];
        });
        // Always include the primary column (index 0) so it stays sticky-visible
        const primaryId = columnIds[0];
        if (primaryId && !ids.includes(primaryId)) {
          ids.unshift(primaryId);
        }
        return ids;
      })()
    : columnIds;

  const primaryColWidth = columnWidths[columnIds[0] ?? ""] ?? 180;
  const primaryBorderLeft = 100 + primaryColWidth;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Primary column full-height border line — covers grid + footer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: primaryBorderLeft,
          width: 1,
          bottom: 0,
          backgroundColor: "#e2e0ea",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={parentRef}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          tabIndex={0}
          className="flex-1 overflow-auto bg-[#f6f8fc] outline-none grid-hide-scrollbar"
          style={{ contain: "strict" }}
        >
        <table style={{ display: "grid", width: "fit-content", minWidth: "100%" }}>
          <GridHeader
            headers={(table.getHeaderGroups()[0]?.headers ?? []).filter((h) => columnIds.includes(h.id))}
            onRenameColumn={onRenameColumn}
            onUpdateColumn={onUpdateColumn}
            onDeleteColumn={onDeleteColumn}
            onAddColumn={onAddColumn}
            allSelected={allSelected}
            onSelectAll={onSelectAll}
            columnsToRender={columnsToRender}
            virtualPaddingLeft={virtualPaddingLeft}
            virtualPaddingRight={virtualPaddingRight}
          />

          <tbody
            style={{
              display: "grid",
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
              width: "fit-content",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowData = getRow(virtualRow.index);

              // Skeleton row — data not yet loaded for this page
              if (!rowData) {
                return (
                  <tr
                    key={`skeleton-${virtualRow.index}`}
                    style={{
                      display: "flex",
                      position: "absolute",
                      transform: `translateY(${virtualRow.start}px)`,
                      height: 32,
                    }}
                    className="border-b border-[#e2e0ea] bg-white"
                  >
                    <td
                      style={{ display: "flex", width: 100, minWidth: 100, position: "sticky", left: 0, zIndex: 1 }}
                      className="h-full items-center bg-white px-2 py-0"
                    >
                      <div className="h-3 w-8 animate-pulse rounded bg-[#ece9f5]" />
                    </td>
                    {virtualPaddingLeft > 0 && (
                      <td style={{ display: "flex", width: virtualPaddingLeft }} />
                    )}
                    {columnsToRender.map((colId, colIdx) => {
                      const w = columnWidths[colId] ?? 180;
                      // Use original column index for skeleton width variation
                      const origIdx = columnIds.indexOf(colId);
                      return (
                      <td
                        key={colId}
                        style={{ display: "flex", width: w, minWidth: w }}
                        className="h-full items-center border-r border-[#e2e0ea] px-2 py-0"
                      >
                        <div
                          className="h-3 animate-pulse rounded bg-[#f0edf8]"
                          style={{
                            width: `${40 + ((virtualRow.index * 17 + (origIdx >= 0 ? origIdx : colIdx) * 11) % 45)}%`,
                          }}
                        />
                      </td>
                      );
                    })}
                    {virtualPaddingRight > 0 && (
                      <td style={{ display: "flex", width: virtualPaddingRight }} />
                    )}
                  </tr>
                );
              }

              // Real row
              return (
                <tr
                  key={rowData.id}
                  data-index={virtualRow.index}
                  style={{
                    display: "flex",
                    position: "absolute",
                    transform: `translateY(${virtualRow.start}px)`,
                    height: 32,
                  }}
                  className="group border-b border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]"
                  onContextMenu={(e) => {
                    if (!selectedRowIds.has(rowData.id)) return;
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY });
                  }}
                >
                  {/* Checkbox + row number — sticky */}
                  <td
                    style={{ display: "flex", width: 100, minWidth: 100, position: "sticky", left: 0, zIndex: 1 }}
                    className="h-full items-center bg-white px-2 py-0 group-hover:bg-[#f5f7fa]"
                  >
                    {/* Checkbox / row number — same position, swap on hover/selected */}
                    <label className="relative flex h-3.5 w-3.5 flex-shrink-0 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(rowData.id)}
                        onChange={() => onToggleRow(rowData.id)}
                        className="absolute inset-0 h-3.5 w-3.5 cursor-pointer accent-[#2563eb] opacity-0 group-hover:opacity-100"
                        style={{ opacity: selectedRowIds.has(rowData.id) ? 1 : undefined }}
                      />
                      <span className={`absolute left-0 select-none whitespace-nowrap text-xs text-[#aaa] group-hover:hidden ${selectedRowIds.has(rowData.id) ? "hidden" : ""}`}>
                        {virtualRow.index + 1}
                      </span>
                    </label>
                    <button
                      className="ml-auto hidden items-center justify-center rounded text-[#888] hover:bg-[#e8e4f5] group-hover:flex"
                      title="Expand row"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2h3M2 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M10 2H7M10 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M2 10h3M2 10V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M10 10H7M10 10V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>

                  {virtualPaddingLeft > 0 && (
                    <td style={{ display: "flex", width: virtualPaddingLeft }} />
                  )}
                  {columnsToRender.map((colId) => {
                    const meta = columns.find((c) => c.id === colId)?.meta as
                      | { type: string; columnId: string; isPrimary?: boolean }
                      | undefined;
                    const columnType = (meta?.type ?? "text") as "text" | "number";
                    const isPrimary = meta?.isPrimary ?? colId === columnIds[0];
                    const cellValue = rowData.cells[colId] ?? null;
                    const w = columnWidths[colId] ?? 180;
                    const isFocused = cursor?.rowIndex === virtualRow.index && cursor?.columnId === colId;
                    const isEditing = editingCell?.rowIndex === virtualRow.index && editingCell?.columnId === colId;
                    const isCurrentMatch = currentSearchMatch?.rowIndex === virtualRow.index && currentSearchMatch?.columnId === colId;

                    return (
                      <td
                        key={colId}
                        style={{
                          display: "flex", width: w, minWidth: w,
                          ...(isPrimary ? { position: "sticky", left: 100, zIndex: 1 } : {}),
                        }}
                        className={`border-r border-[#e2e0ea]${isPrimary ? " bg-white group-hover:bg-[#f5f7fa]" : ""}`}
                      >
                        <GridCell
                          rowId={rowData.id}
                          rowIndex={virtualRow.index}
                          columnId={colId}
                          columnType={columnType}
                          value={cellValue}
                          isFocused={isFocused}
                          isEditing={isEditing}
                          initialDraft={isEditing ? initialDraft : undefined}
                          searchQuery={searchQuery}
                          isCurrentMatch={isCurrentMatch}
                          onCommit={onCommit}
                          onRevert={onRevert}
                          onStartEditing={() => onStartEditing(virtualRow.index, colId)}
                          onSelect={() => onSelect(virtualRow.index, colId)}
                        />
                      </td>
                    );
                  })}
                  {virtualPaddingRight > 0 && (
                    <td style={{ display: "flex", width: virtualPaddingRight }} />
                  )}

                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row button */}
        <div
          className="group flex h-8 items-center border-b border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]"
          style={{ width: "fit-content" }}
        >
          <div style={{ width: 100, minWidth: 100, position: "sticky", left: 0, zIndex: 1 }} className="flex items-center bg-white px-2 group-hover:bg-[#f5f7fa]">
            <button
              onClick={onAddRow}
              className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded text-[#888] hover:bg-[#e2e0ea]"
              title="Add row"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {virtualPaddingLeft > 0 && (
            <div style={{ width: virtualPaddingLeft, minWidth: virtualPaddingLeft }} className="h-full" />
          )}
          {columnsToRender.map((colId) => {
            const w = columnWidths[colId] ?? 180;
            const isPrimary = colId === columnIds[0];
            return (
              <div
                key={colId}
                style={{ width: w, minWidth: w }}
                className={`h-full${isPrimary ? " border-r border-[#e2e0ea]" : ""}`}
              />
            );
          })}
          {virtualPaddingRight > 0 && (
            <div style={{ width: virtualPaddingRight, minWidth: virtualPaddingRight }} className="h-full" />
          )}
        </div>
        </div>{/* end parentRef */}

        {/* Vertical mirror scrollbar */}
        <div
          ref={vScrollbarRef}
          className="grid-scrollbar-v flex-shrink-0 overflow-y-auto overflow-x-hidden"
          style={{ width: 12 }}
        >
          <div style={{ width: 1, height: rowVirtualizer.getTotalSize() }} />
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && selectedRowIds.size > 0 && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          className="w-[260px] overflow-hidden rounded-lg border border-[#e2e0ea] bg-white py-1 shadow-xl"
        >
          <div className="px-3 py-2 text-[12px] font-medium text-[#888]">
            {selectedRowIds.size} {selectedRowIds.size === 1 ? "record" : "records"} selected
          </div>
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <ContextMenuItem icon={<AskOmniIcon />} label={`Ask Omni about ${selectedRowIds.size} records`} onClick={() => setContextMenu(null)} />
          <ContextMenuItem icon={<RunAgentIcon />} label="Run field agent" chevron onClick={() => setContextMenu(null)} />
          <ContextMenuItem icon={<SendIcon />} label="Send all selected records" onClick={() => setContextMenu(null)} />
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <ContextMenuItem icon={<DeleteSelectedIcon />} label={selectedRowIds.size === 1 ? "Delete record" : "Delete all selected records"} danger onClick={() => { setContextMenu(null); onDeleteSelectedRows(); }} />
        </div>
      )}

      {/* Footer: record count */}
      <div className="relative flex h-[23px] flex-shrink-0 items-center border-t border-[#e2e0ea] bg-white px-3">
        {/* Floating pill — sits above the footer bar */}
        <div className="absolute left-3 z-20 flex items-center overflow-hidden rounded-full border border-[#d1d5db] bg-white" style={{ bottom: "80%" }}>
          <button onClick={onAddRow} className="flex h-7 w-7 items-center justify-center text-[#4c5667] hover:bg-[#f3f4f6]" title="Add row">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <div className="h-4 w-px bg-[#d1d5db]" />
          <button className="flex h-7 items-center gap-1.5 px-3 text-[12px] text-[#4c5667] hover:bg-[#f3f4f6]" title="Add...">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h4M5.5 2v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M7.5 8.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            Add...
          </button>
        </div>

        <span className="text-[12px] text-[#888]">
          {isBulkCreating ? "Inserting… " : ""}
          {displayCount.toLocaleString()} {displayCount === 1 ? "record" : "records"}
        </span>
      </div>

      {/* Mirror horizontal scrollbar — pinned to very bottom, no arrows */}
      <div
        ref={scrollbarRef}
        className="grid-scrollbar flex-shrink-0 overflow-x-auto overflow-y-hidden"
        style={{ height: 12 }}
      >
        <div
          style={{
            height: 1,
            width: 100 + columnIds.reduce((sum, id) => sum + (columnWidths[id] ?? 180), 0) + 90,
          }}
        />
      </div>
    </div>
  );
});

function ContextMenuItem({
  icon, label, danger, chevron, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  chevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition-colors ${
        danger ? "text-[#d32f2f] hover:bg-[#fff5f5]" : "text-[#333] hover:bg-[#f5f5f5]"
      }`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${danger ? "text-[#d32f2f]" : "text-[#666]"}`}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {chevron && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#aaa]">
          <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function AskOmniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}

function RunAgentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="3.5" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5.5l5.5 3.5 5.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteSelectedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M6 6.5v4M8 6.5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4l.5 7.5h6L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
