"use client";

import { type Header } from "@tanstack/react-table";
import { useState, useRef, useEffect } from "react";

import type { RowData } from "./GridTable";

interface GridHeaderProps {
  headers: Header<RowData, unknown>[];
  onRenameColumn: (columnId: string, name: string) => void;
  onUpdateColumn: (columnId: string, name: string, type: "text" | "number") => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
  allSelected: boolean;
  onSelectAll: () => void | Promise<void>;
  columnsToRender?: string[];       // column IDs to actually render (when virtualized)
  virtualPaddingLeft?: number;
  virtualPaddingRight?: number;
}

// ---------------------------------------------------------------------------
// Edit Field Modal
// ---------------------------------------------------------------------------

const FIELD_TYPES: { value: "text" | "number"; label: string; icon: React.ReactNode }[] = [
  {
    value: "text",
    label: "Single line text",
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
        <path d="M2 3h8M6 3v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "number",
    label: "Number",
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
        <path d="M4.5 2l-1 8M8.5 2l-1 8M2 4.5h8M1.5 7.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function EditFieldModal({
  columnId,
  columnName,
  columnType,
  onSave,
  onClose,
}: {
  columnId: string;
  columnName: string;
  columnType: "text" | "number";
  onSave: (id: string, name: string, type: "text" | "number") => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(columnName);
  const [type, setType] = useState<"text" | "number">(columnType);
  const [typeOpen, setTypeOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    }
    if (typeOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [typeOpen]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(columnId, trimmed, type);
    onClose();
  }

  const selectedType = FIELD_TYPES.find((t) => t.value === type)!;

  return (
    <div
      className="absolute left-0 top-full z-40 mt-0.5 w-[260px] rounded-lg border border-[#e2e0ea] bg-white shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Name input */}
      <div className="p-3 pb-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          className="w-full rounded border border-[#2563eb] px-2 py-1.5 text-[13px] text-[#1f2328] outline-none ring-2 ring-[#2563eb]/20"
        />
      </div>

      {/* Field type selector */}
      <div className="px-3 pb-2" ref={typeRef}>
        <div className="relative">
          <button
            onClick={() => setTypeOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded border border-[#e2e0ea] px-2 py-1.5 text-[13px] text-[#333] hover:border-[#bbb]"
          >
            <span className="text-[#666]">{selectedType.icon}</span>
            <span className="flex-1 text-left">{selectedType.label}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {typeOpen && (
            <div className="absolute left-0 top-full z-50 mt-0.5 w-full rounded border border-[#e2e0ea] bg-white py-1 shadow-lg">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => { setType(ft.value); setTypeOpen(false); }}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-[#f5f5f5] ${ft.value === type ? "text-[#2563eb]" : "text-[#333]"}`}
                >
                  <span className={ft.value === type ? "text-[#2563eb]" : "text-[#666]"}>{ft.icon}</span>
                  {ft.label}
                  {ft.value === type && (
                    <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enter text hint */}
      {type === "text" && (
        <div className="px-3 pb-2">
          <p className="text-[12px] text-[#e8384f]">Enter text.</p>
        </div>
      )}

      {/* Add description */}
      <div className="border-t border-[#f0f0f0] px-3 py-2">
        <button className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#333]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Add description
        </button>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-[#f0f0f0] px-3 py-2">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-[13px] text-[#555] hover:bg-[#f5f5f5]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="rounded bg-[#2563eb] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Column Menu
// ---------------------------------------------------------------------------

function AddColumnMenu({ onAdd }: { onAdd: (type: "text" | "number") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex h-full w-full items-center justify-center">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-full w-full items-center justify-center text-[#888] hover:bg-[#f0f0f0]"
        title="Add field"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-0.5 min-w-[140px] rounded border border-[#e2e0ea] bg-white py-1 shadow-lg">
          <button
            onClick={() => { onAdd("text"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f3f4f6]"
          >
            <TextIcon /> Text
          </button>
          <button
            onClick={() => { onAdd("number"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f3f4f6]"
          >
            <NumberIcon /> Number
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column context menu (chevron dropdown)
// ---------------------------------------------------------------------------

function ColumnMenu({
  columnId: _columnId,
  columnName: _columnName,
  isPrimary,
  onRename: _onRename,
  onDelete,
  onEditField,
}: {
  columnId: string;
  columnName: string;
  isPrimary: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onEditField: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleDelete() {
    setOpen(false);
    onDelete();
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-5 w-5 items-center justify-center rounded text-[#555] hover:bg-[#e0e0e0]"
        title="Field options"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-0.5 w-[220px] overflow-hidden rounded-lg border border-[#e2e0ea] bg-white py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Item icon={<EditIcon />} label="Edit field" onClick={() => { setOpen(false); onEditField(); }} />
          <Divider />
          <Item icon={<DuplicateIcon />} label="Duplicate field" onClick={() => setOpen(false)} />
          <Item icon={<InsertLeftIcon />} label="Insert left" disabled />
          <Item icon={<InsertRightIcon />} label="Insert right" disabled />
          <Item icon={<ChangePrimaryIcon />} label="Change primary field" disabled />
          <Divider />
          <Item icon={<LinkIcon />} label="Copy field URL" onClick={() => setOpen(false)} />
          <Item icon={<DescriptionIcon />} label="Edit field description" onClick={() => setOpen(false)} />
          <Item icon={<PermissionsIcon />} label="Edit field permissions" badge="Team" onClick={() => setOpen(false)} />
          <Divider />
          <Item icon={<SortAZIcon />} label={<><span>Sort</span><span className="ml-1 text-[#6b7280]">A → Z</span></>} onClick={() => setOpen(false)} />
          <Item icon={<SortZAIcon />} label={<><span>Sort</span><span className="ml-1 text-[#6b7280]">Z → A</span></>} onClick={() => setOpen(false)} />
          <Divider />
          <Item icon={<FilterIcon />} label="Filter by this field" onClick={() => setOpen(false)} />
          <Item icon={<GroupIcon />} label="Group by this field" onClick={() => setOpen(false)} />
          <Divider />
          <Item icon={<HideIcon />} label="Hide field" disabled />
          {!isPrimary && <Item icon={<DeleteIcon />} label="Delete field" onClick={handleDelete} danger />}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[#f0f0f0]" />;
}

function Item({
  icon,
  label,
  onClick,
  disabled,
  danger,
  badge,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition-colors
        ${disabled ? "cursor-default text-[#bbb]" : danger ? "text-[#d32f2f] hover:bg-[#fff5f5]" : "text-[#333] hover:bg-[#f5f5f5]"}`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${disabled ? "text-[#bbb]" : danger ? "text-[#d32f2f]" : "text-[#666]"}`}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="flex items-center gap-1 rounded-full bg-[#e8f4ff] px-2 py-0.5 text-[11px] text-[#1a73e8]">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
            <path d="M3 5l1.5 1.5L7.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GridHeader
// ---------------------------------------------------------------------------

export function GridHeader({
  headers,
  onRenameColumn,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  allSelected,
  onSelectAll,
  columnsToRender,
  virtualPaddingLeft = 0,
  virtualPaddingRight = 0,
}: GridHeaderProps) {
  // Track which column has its edit modal open
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  // When virtualized, only render headers whose id is in columnsToRender
  const headersToRender = columnsToRender
    ? headers.filter((h) => columnsToRender.includes(h.id))
    : headers;

  return (
    <thead style={{ display: "grid", position: "sticky", top: 0, zIndex: 3 }}>
      <tr style={{ display: "flex" }}>
        {/* Checkbox column — sticky */}
        <th
          style={{ display: "flex", width: 100, minWidth: 100, height: 32, position: "sticky", left: 0, zIndex: 4 }}
          className="items-center border-b border-[#e2e0ea] bg-white px-2"
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="h-3.5 w-3.5 cursor-pointer rounded border-[#ccc] accent-[#2563eb]"
          />
        </th>

        {/* Left virtual padding spacer */}
        {virtualPaddingLeft > 0 && (
          <th
            style={{ display: "flex", width: virtualPaddingLeft, minWidth: virtualPaddingLeft, height: 32 }}
            className="border-b border-[#e2e0ea] bg-white"
          />
        )}

        {headersToRender.map((header) => {
          const meta = header.column.columnDef.meta as
            | { type: string; columnId: string; isPrimary?: boolean }
            | undefined;
          const columnId = meta?.columnId ?? header.id;
          const colType = (meta?.type ?? "text") as "text" | "number";
          const isPrimary = meta?.isPrimary ?? false;
          const colWidth = isPrimary ? 200 : 180;
          const headerName =
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : header.id;
          const isEditing = editingColumnId === columnId;

          return (
            <th
              key={header.id}
              style={{
                display: "flex", width: colWidth, minWidth: colWidth, height: 32,
                ...(isPrimary ? { position: "sticky", left: 100, zIndex: 4 } : {}),
              }}
              className="group relative items-center border-b border-r border-[#e2e0ea] bg-white px-2 py-0 text-left"
            >
              {/* Field type icon — key for primary, text/number otherwise */}
              <span className="mr-1.5 flex-shrink-0 text-[#888]">
                {isPrimary ? <PrimaryKeyIcon /> : colType === "number" ? <NumberIcon /> : <TextIcon />}
              </span>

              {/* Column name — double-click opens edit modal */}
              <span
                className="flex-1 cursor-default truncate text-[13px] font-medium text-[#333]"
                onDoubleClick={(e) => { e.stopPropagation(); setEditingColumnId(columnId); }}
              >
                {headerName}
              </span>

              {/* Chevron dropdown — visible on hover */}
              <span className="ml-1 hidden group-hover:flex">
                <ColumnMenu
                  columnId={columnId}
                  columnName={headerName}
                  isPrimary={isPrimary}
                  onRename={(name) => onRenameColumn(columnId, name)}
                  onDelete={() => onDeleteColumn(columnId)}
                  onEditField={() => setEditingColumnId(columnId)}
                />
              </span>

              {/* Edit field modal */}
              {isEditing && (
                <EditFieldModal
                  columnId={columnId}
                  columnName={headerName}
                  columnType={colType}
                  onSave={onUpdateColumn}
                  onClose={() => setEditingColumnId(null)}
                />
              )}
            </th>
          );
        })}

        {/* Right virtual padding spacer — before add-column button */}
        {virtualPaddingRight > 0 && (
          <th
            style={{ display: "flex", width: virtualPaddingRight, minWidth: virtualPaddingRight, height: 32 }}
            className="border-b border-[#e2e0ea] bg-white"
          />
        )}

        {/* Add column button — sticky right */}
        <th
          style={{ display: "flex", width: 90, minWidth: 90, height: 32, position: "sticky", right: 0, zIndex: 4 }}
          className="border-b border-l border-[#e2e0ea] bg-white p-0"
        >
          <AddColumnMenu onAdd={onAddColumn} />
        </th>

      </tr>
    </thead>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PrimaryKeyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="4.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 5h3M8 3.5V5M9.5 3.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M6 3v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function NumberIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2l-1 8M8.5 2l-1 8M2 4.5h8M1.5 7.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M9.5 2.5l2 2L5 11H3v-2l6.5-6.5z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <rect x="4" y="4" width="7" height="7" rx="1" strokeWidth="1.2" />
      <path d="M3 10V3h7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsertLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M5 7H1M1 7l2-2M1 7l2 2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="2" width="6" height="10" rx="1" strokeWidth="1.2" />
    </svg>
  );
}

function InsertRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M9 7h4M13 7l-2-2M13 7l-2 2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="2" width="6" height="10" rx="1" strokeWidth="1.2" />
    </svg>
  );
}

function ChangePrimaryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2 7h10M8 4l3 3-3 3" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M5.5 8.5L8.5 5.5M6 3.5L7 2.5a3 3 0 1 1 4.243 4.243L10 7.5M8 10.5l-1 1a3 3 0 1 1-4.243-4.243L4 6.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <circle cx="7" cy="7" r="5.5" strokeWidth="1.2" />
      <path d="M7 6.5v3.5M7 4.5v.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PermissionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <rect x="3" y="6" width="8" height="6" rx="1" strokeWidth="1.2" />
      <path d="M5 6V4.5a2 2 0 1 1 4 0V6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SortAZIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2 4h6M2 7h4M2 10h2" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 3v8M10 11l-2-2M10 11l2-2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortZAIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2 4h2M2 7h4M2 10h6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 11V3M10 3l-2 2M10 3l2 2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2 3.5h10M4 7h6M6 10.5h2" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <rect x="1.5" y="2.5" width="11" height="3" rx="0.75" strokeWidth="1.2" />
      <rect x="1.5" y="8.5" width="11" height="3" rx="0.75" strokeWidth="1.2" />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2 2l10 10M5.5 4.5A5 5 0 0 1 12 7s-1.5 3-5 3a4.5 4.5 0 0 1-2.5-.8M2 7s.7-1.5 2-2.3" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
      <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 7.5h6L11 4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
