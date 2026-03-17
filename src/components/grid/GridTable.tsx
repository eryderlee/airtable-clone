"use client";

import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useRef } from "react";

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
  columns: ColumnDef<RowData>[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isBulkCreating: boolean;
  onRenameColumn: (columnId: string, name: string) => void;
  onUpdateColumn: (columnId: string, name: string, type: "text" | "number") => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
  displayCount: number;
}

export const GridTable = React.memo(function GridTable({
  totalCount,
  getRow,
  columnIds,
  columns,
  onScroll,
  isBulkCreating,
  onRenameColumn,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  displayCount,
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={parentRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto"
        style={{ contain: "strict" }}
      >
        <table style={{ display: "grid" }}>
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
                      width: "100%",
                      height: 32,
                    }}
                    className="border-b border-[#e2e0ea]"
                  >
                    <td
                      style={{ display: "flex", width: 66, minWidth: 66 }}
                      className="items-center border-r border-[#e2e0ea] px-2 py-0"
                    >
                      <div className="h-3 w-8 animate-pulse rounded bg-[#ece9f5]" />
                    </td>
                    {columnIds.map((colId, colIdx) => (
                      <td
                        key={colId}
                        style={{ display: "flex", width: 180, minWidth: 180 }}
                        className="items-center border-r border-[#e2e0ea] px-2 py-0"
                      >
                        <div
                          className="h-3 animate-pulse rounded bg-[#f0edf8]"
                          style={{
                            width: `${40 + ((virtualRow.index * 17 + colIdx * 11) % 45)}%`,
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ display: "flex", flex: 1 }} />
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
                    width: "100%",
                  }}
                  className="group border-b border-[#e2e0ea] hover:bg-[#f5f7fa]"
                >
                  {/* Checkbox + row number */}
                  <td
                    style={{ display: "flex", width: 66, minWidth: 66 }}
                    className="items-center gap-1.5 border-r border-[#e2e0ea] px-2 py-0"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 flex-shrink-0 cursor-pointer rounded border-[#ccc] accent-[#2563eb] opacity-0 group-hover:opacity-100"
                    />
                    <span className="text-xs text-[#aaa]">
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
                    const value = rowData.cells[colId];
                    return (
                      <td
                        key={colId}
                        style={{ display: "flex", width: 180, minWidth: 180 }}
                        className="items-center truncate border-r border-[#e2e0ea] px-2 py-0 text-[13px] text-[#1f2328]"
                      >
                        {value !== null && value !== undefined ? String(value) : ""}
                      </td>
                    );
                  })}

                  {/* Trailing empty cell */}
                  <td style={{ display: "flex", flex: 1 }} className="border-r-0" />
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row button */}
        <div
          className="flex items-center border-b border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]"
          style={{ width: "100%" }}
        >
          <div style={{ width: 66, minWidth: 66 }} className="flex items-center justify-center border-r border-[#e2e0ea] py-2">
            <button
              className="flex h-5 w-5 items-center justify-center rounded text-[#888] hover:bg-[#e2e0ea]"
              title="Add row"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1" />
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
