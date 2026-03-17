"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useRef } from "react";

import { GridHeader } from "./GridHeader";

export type RowData = {
  id: string;
  cells: Record<string, string | number | null>;
};

interface GridTableProps {
  rows: RowData[];
  columns: ColumnDef<RowData>[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isFetchingNextPage: boolean;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
}

export const GridTable = React.memo(function GridTable({
  rows,
  columns,
  onScroll,
  isFetchingNextPage,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
}: GridTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
    measureElement:
      typeof window !== "undefined" &&
      !navigator.userAgent.includes("Firefox")
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  return (
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
            const row = table.getRowModel().rows[virtualRow.index];
            if (!row) return null;
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                ref={(node) => rowVirtualizer.measureElement(node)}
                style={{
                  display: "flex",
                  position: "absolute",
                  transform: `translateY(${virtualRow.start}px)`,
                  width: "100%",
                }}
                className="border-b border-gray-100"
              >
                {/* Row number */}
                <td
                  style={{ display: "flex", width: 66, minWidth: 66 }}
                  className="items-center border-r border-gray-100 px-2 py-1 text-xs text-gray-400"
                >
                  {virtualRow.index + 1}
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ display: "flex", width: 180, minWidth: 180 }}
                    className="items-center truncate border-r border-gray-100 px-2 py-1 text-sm"
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {isFetchingNextPage && (
        <div className="flex justify-center py-2 text-xs text-gray-400">
          Loading more rows...
        </div>
      )}
    </div>
  );
});
