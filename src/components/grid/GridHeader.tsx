"use client";

import { flexRender, type Header } from "@tanstack/react-table";
import { useState } from "react";

import { InlineEdit } from "~/components/ui/InlineEdit";
import type { RowData } from "./GridTable";

interface GridHeaderProps {
  headers: Header<RowData, unknown>[];
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
}

function AddColumnMenu({ onAdd }: { onAdd: (type: "text" | "number") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => { onAdd("text"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50"
          >
            Text
          </button>
          <button
            onClick={() => { onAdd("number"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50"
          >
            Number
          </button>
        </div>
      )}
    </div>
  );
}

export function GridHeader({
  headers,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
}: GridHeaderProps) {
  return (
    <thead
      style={{ display: "grid", position: "sticky", top: 0, zIndex: 1 }}
      className="bg-gray-50"
    >
      <tr style={{ display: "flex", width: "100%" }}>
        <th
          style={{ display: "flex", width: 66, minWidth: 66 }}
          className="border-b border-r border-gray-200 px-2 py-1 text-left text-xs font-medium text-gray-500"
        >
          #
        </th>
        {headers.map((header) => {
          const meta = header.column.columnDef.meta as
            | { type: string; columnId: string }
            | undefined;
          const columnId = meta?.columnId ?? header.id;
          const headerName =
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : flexRender(header.column.columnDef.header, header.getContext())?.toString() ?? header.id;
          return (
            <th
              key={header.id}
              style={{ display: "flex", width: 180, minWidth: 180 }}
              className="group relative items-center border-b border-r border-gray-200 px-2 py-1 text-left text-xs font-medium text-gray-600"
            >
              <InlineEdit
                value={headerName}
                onSave={(name) => onRenameColumn(columnId, name)}
                className="flex-1 truncate"
              />
              <button
                onClick={() => onDeleteColumn(columnId)}
                className="ml-1 hidden rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:inline-flex"
                title="Delete column"
              >
                ×
              </button>
            </th>
          );
        })}
        <th
          style={{ display: "flex", minWidth: 120 }}
          className="border-b border-gray-200 px-2 py-1"
        >
          <AddColumnMenu onAdd={onAddColumn} />
        </th>
      </tr>
    </thead>
  );
}
