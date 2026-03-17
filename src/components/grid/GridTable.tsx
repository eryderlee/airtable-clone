"use client";

import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import React, { useRef } from "react";

import { GridCell } from "./GridCell";
import { GridHeader } from "./GridHeader";

export type RowData = {
  id: string;
  cells: Record<string, string | number | null>;
};

// Stable empty array so useReactTable doesn't see a new reference each render
const EMPTY_ROWS: RowData[] = [];

interface GridTableProps {
  totalCount: number;
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
  cursor: { rowIndex: number; columnId: string } | null;
  editingCell: { rowIndex: number; columnId: string } | null;
  onSelect: (rowIndex: number, columnId: string) => void;
  onStartEditing: (rowIndex: number, columnId: string) => void;
  onCommit: (rowId: string, columnId: string, value: string | number | null) => void;
  onRevert: () => void;
  rowVirtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, Element> | null>;
}

export const GridTable = React.memo(function GridTable({
  totalCount,
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
  cursor,
  editingCell,
  onSelect,
  onStartEditing,
  onCommit,
  onRevert,
  rowVirtualizerRef,
}: GridTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

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
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
    measureElement:
      typeof window !== "undefined" && !navigator.userAgent.includes("Firefox")
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });
  rowVirtualizerRef.current = rowVirtualizer;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={parentRef}
        onScroll={onScroll}
        tabIndex={0}
        className="flex-1 overflow-auto bg-[#f4f5f7] outline-none"
        style={{ contain: "strict" }}
      >
        {/* Primary column full-height border line */}
        {(() => {
          const primaryColWidth = columnWidths[columnIds[0] ?? ""] ?? 180;
          const left = 100 + primaryColWidth;
          return (
            <div
              style={{
                position: "absolute",
                top: 0,
                left,
                width: 1,
                height: "100%",
                backgroundColor: "#e2e0ea",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          );
        })()}
        <table style={{ display: "grid", width: "fit-content", minWidth: "100%" }}>
          <GridHeader
            headers={table.getHeaderGroups()[0]?.headers ?? []}
            onRenameColumn={onRenameColumn}
            onUpdateColumn={onUpdateColumn}
            onDeleteColumn={onDeleteColumn}
            onAddColumn={onAddColumn}
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
                      style={{ display: "flex", width: 100, minWidth: 100 }}
                      className="h-full items-center px-2 py-0"
                    >
                      <div className="h-3 w-8 animate-pulse rounded bg-[#ece9f5]" />
                    </td>
                    {columnIds.map((colId, colIdx) => {
                      const w = columnWidths[colId] ?? 180;
                      return (
                      <td
                        key={colId}
                        style={{ display: "flex", width: w, minWidth: w }}
                        className="h-full items-center border-r border-[#e2e0ea] px-2 py-0"
                      >
                        <div
                          className="h-3 animate-pulse rounded bg-[#f0edf8]"
                          style={{
                            width: `${40 + ((virtualRow.index * 17 + colIdx * 11) % 45)}%`,
                          }}
                        />
                      </td>
                      );
                    })}
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
                >
                  {/* Checkbox + row number */}
                  <td
                    style={{ display: "flex", width: 100, minWidth: 100, position: "relative" }}
                    className="h-full items-center px-2 py-0"
                  >
                    <input
                      type="checkbox"
                      className="absolute left-2 h-3.5 w-3.5 cursor-pointer rounded border-[#ccc] accent-[#2563eb] opacity-0 group-hover:opacity-100"
                    />
                    <span className="flex-1 text-center text-xs text-[#aaa] group-hover:invisible">
                      {virtualRow.index + 1}
                    </span>
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

                  {columnIds.map((colId) => {
                    const meta = columns.find((c) => c.id === colId)?.meta as
                      | { type: string; columnId: string }
                      | undefined;
                    const columnType = (meta?.type ?? "text") as "text" | "number";
                    const cellValue = rowData.cells[colId] ?? null;
                    const w = columnWidths[colId] ?? 180;
                    const isFocused = cursor?.rowIndex === virtualRow.index && cursor?.columnId === colId;
                    const isEditing = editingCell?.rowIndex === virtualRow.index && editingCell?.columnId === colId;

                    return (
                      <td
                        key={colId}
                        style={{ display: "flex", width: w, minWidth: w }}
                        className="border-r border-[#e2e0ea]"
                      >
                        <GridCell
                          rowId={rowData.id}
                          rowIndex={virtualRow.index}
                          columnId={colId}
                          columnType={columnType}
                          value={cellValue}
                          isFocused={isFocused}
                          isEditing={isEditing}
                          onCommit={onCommit}
                          onRevert={onRevert}
                          onStartEditing={() => onStartEditing(virtualRow.index, colId)}
                          onSelect={() => onSelect(virtualRow.index, colId)}
                        />
                      </td>
                    );
                  })}

                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row button */}
        <div
          className="flex h-8 items-center border-b border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]"
          style={{ width: "fit-content" }}
        >
          <div style={{ width: 100, minWidth: 100 }} className="flex items-center px-2">
            {/* invisible checkbox placeholder to match row layout */}
            <div className="h-3.5 w-2 flex-shrink-0" />
            <div className="w-1.5 flex-shrink-0" />
            <button
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[#888] hover:bg-[#e2e0ea]"
              title="Add row"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {columnIds.map((colId) => {
            const w = columnWidths[colId] ?? 180;
            return (
            <div
              key={colId}
              style={{ width: w, minWidth: w }}
              className="h-full border-r border-[#e2e0ea]"
            />
            );
          })}
        </div>
      </div>

      {/* Footer: record count */}
      <div className="flex h-[36px] flex-shrink-0 items-center border-t border-[#e2e0ea] bg-white px-3">
        <span className="text-[12px] text-[#888]">
          {isBulkCreating ? "Inserting… " : ""}
          {displayCount.toLocaleString()} {displayCount === 1 ? "record" : "records"}
        </span>
      </div>
    </div>
  );
});
