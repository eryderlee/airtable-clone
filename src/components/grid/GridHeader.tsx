"use client";

import { type Header } from "@tanstack/react-table";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

import type { RowData } from "./GridTable";
import { PrimaryKeyIcon, TextIcon, NumberIcon } from "./ColumnIcons";

interface GridHeaderProps {
  headers: Header<RowData, unknown>[];
  onRenameColumn: (columnId: string, name: string) => void;
  onUpdateColumn: (columnId: string, name: string, type: "text" | "number") => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (type: "text" | "number") => void;
  allSelected: boolean;
  onSelectAll: () => void | Promise<void>;
  columnsToRender?: string[];
  virtualPaddingLeft?: number;
  virtualPaddingRight?: number;
  sortedColumnIds?: string[];
  filteredColumnIds?: string[];
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

const FIELD_AGENTS = [
  { label: "Analyze attachment", color: "#22863a", icon: "M3 3.5A1.5 1.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9Z" },
  { label: "Research companies", color: "#166ee1", icon: "M3 4.5A1.5 1.5 0 0 1 4.5 3h2A1.5 1.5 0 0 1 8 4.5V8H4.5A1.5 1.5 0 0 1 3 6.5v-2Zm5 0A1.5 1.5 0 0 1 9.5 3h2A1.5 1.5 0 0 1 13 4.5v2A1.5 1.5 0 0 1 11.5 8H8V4.5ZM3 9.5A1.5 1.5 0 0 1 4.5 8H8v3.5A1.5 1.5 0 0 1 6.5 13h-2A1.5 1.5 0 0 1 3 11.5v-2Zm5 0V12h3.5a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 11.5 8H8v1.5Z" },
  { label: "Find image from web", color: "#7c37ef", icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Zm0-1.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" },
  { label: "Generate image", color: "#d54401", icon: "M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Z" },
  { label: "Deep match", color: "#0d9488", icon: "M2 8h4l2-3v6l2-3h4" },
  { label: "Build prototype", color: "#7c37ef", icon: "M5.5 2 2 8l3.5 6h5L14 8l-3.5-6h-5Z" },
  { label: "Create custom agent", color: "#eab308", icon: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z" },
  { label: "Browse catalog", color: "#666", icon: "M2 3h4v4H2V3Zm0 6h4v4H2V9Zm6-6h4v4H8V3Zm0 6h4v4H8V9Z" },
];

const STANDARD_FIELDS: { label: string; type: "text" | "number"; icon: string; hasChevron?: boolean }[] = [
  { label: "Link to another record", type: "text", icon: "M2 8h4l2-3v6l2-3h4", hasChevron: true },
  { label: "Single line text", type: "text", icon: "M3 4h10M3 8h7M3 12h9" },
  { label: "Long text", type: "text", icon: "M3 3h10M3 6h10M3 9h10M3 12h6" },
  { label: "Attachment", type: "text", icon: "M3 3.5A1.5 1.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9Z" },
  { label: "Checkbox", type: "text", icon: "M3 3h10v10H3V3Zm2 5 2 2 4-4" },
  { label: "Multiple select", type: "text", icon: "M2 4h3M2 8h3M2 12h3M7 4h7M7 8h7M7 12h7" },
  { label: "Single select", type: "text", icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  { label: "User", type: "text", icon: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1c-2.76 0-5 1.34-5 3v1h10v-1c0-1.66-2.24-3-5-3Z" },
  { label: "Date", type: "text", icon: "M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5v-7ZM5 2v2M11 2v2M3 7h10" },
  { label: "Phone number", type: "text", icon: "M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7ZM8 12a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" },
  { label: "Email", type: "text", icon: "M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Zm1 0L8 8l5-3.5" },
  { label: "URL", type: "text", icon: "M6.5 8.5 9.5 5.5a2 2 0 0 1 2.83 2.83L9.5 11.16M9.5 7.5 6.5 10.5a2 2 0 0 1-2.83-2.83L6.5 4.84" },
  { label: "Number", type: "number", icon: "M5 3v10M11 3v10M3 6h10M3 10h10" },
  { label: "Currency", type: "number", icon: "M8 2v12M5.5 5A2.5 2.5 0 0 1 8 4h1a2.5 2.5 0 0 1 0 5H7a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 0 2.5-2" },
  { label: "Percent", type: "number", icon: "M4 12 12 4M5 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  { label: "Duration", type: "number", icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 5v3l2 2" },
  { label: "Rating", type: "number", icon: "m8 2 1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.3 4.3 13.3l.7-4.1-3-2.9 4.2-.7L8 2Z" },
  { label: "Formula", type: "text", icon: "M5 3 4 13M9 3l-1 10M3 6h10M3 10h10" },
  { label: "Rollup", type: "text", icon: "M8 2a6 6 0 0 0-4 10.5M8 2a6 6 0 0 1 4 10.5M4 12.5A5.9 5.9 0 0 0 8 14a5.9 5.9 0 0 0 4-1.5" },
  { label: "Count", type: "number", icon: "M3 3h10v10H3V3Zm3 3v4M8 6v4M10 6v4" },
  { label: "Lookup", type: "text", icon: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10Zm4-1 3 3" },
  { label: "Created time", type: "text", icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 5v3l2 2M3 14l1-2M13 14l-1-2" },
  { label: "Last modified time", type: "text", icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 5v3l2 2M3 14l1-2M13 14l-1-2" },
  { label: "Created by", type: "text", icon: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1c-2.76 0-5 1.34-5 3v1h10v-1c0-1.66-2.24-3-5-3ZM12 3l1 1" },
  { label: "Last modified by", type: "text", icon: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1c-2.76 0-5 1.34-5 3v1h10v-1c0-1.66-2.24-3-5-3ZM12 3l1 1" },
  { label: "Autonumber", type: "number", icon: "M5 3v10M11 3v10M3 6h10M3 10h10" },
  { label: "Barcode", type: "text", icon: "M3 3v10M5 3v10M8 3v10M10 3v10M13 3v10M6.5 3v10M11.5 3v10" },
  { label: "Button", type: "text", icon: "M5.5 2 2 8l3.5 6h5L14 8l-3.5-6h-5Z" },
];

function AddColumnMenu({ onAdd }: { onAdd: (type: "text" | "number") => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpen = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
    setOpen((v) => !v);
    if (open) setSearch("");
  }, [open]);

  const query = search.toLowerCase();
  const filteredAgents = FIELD_AGENTS.filter((a) => a.label.toLowerCase().includes(query));
  const filteredFields = STANDARD_FIELDS.filter((f) => f.label.toLowerCase().includes(query));

  return (
    <div className="flex h-full w-full items-start justify-center pt-2">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center justify-center rounded p-1 text-[#888] hover:bg-[#f0f0f0]"
        title="Add field"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed w-[340px] overflow-y-auto rounded-lg border border-[#e2e0ea] bg-white shadow-xl"
          style={{ top: pos.top, left: pos.left, zIndex: 10000, maxHeight: "calc(100vh - 60px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3">
            {/* Search bar */}
            <div className="sticky top-0 bg-white pb-2">
              <div className="flex h-8 items-center rounded-lg border border-[#e2e0ea] bg-[#f8f8f8] px-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-1.5 flex-shrink-0 text-[#888]">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10.5 10.5 13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a field type"
                  className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#aaa]"
                />
                <a href="#" className="ml-1 flex-shrink-0 text-[#888] hover:text-[#555]" title="Help">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M6.5 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1-1.5 2M8 11h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
              <hr className="mx-0 mb-0 mt-2 border-[#eee]" />
            </div>

            {/* Field agents */}
            {filteredAgents.length > 0 && (
              <>
                <p className="mx-1 my-2 text-[13px] text-[#888]">Field agents</p>
                <div className="flex flex-wrap">
                  {filteredAgents.map((agent) => (
                    <button
                      key={agent.label}
                      className="flex w-1/2 cursor-pointer items-center rounded-lg px-2.5 py-2.5 text-left hover:bg-[#f5f5f5]"
                      onClick={() => { onAdd("text"); setOpen(false); setSearch(""); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0" style={{ shapeRendering: "geometricPrecision" }}>
                        <path d={agent.icon} fill={agent.color} />
                      </svg>
                      <span className="ml-2 text-[13px] text-[#333]">{agent.label}</span>
                    </button>
                  ))}
                </div>
                <hr className="mx-0 my-1 border-[#eee]" />
              </>
            )}

            {/* Standard fields */}
            {filteredFields.length > 0 && (
              <>
                <p className="mx-1 my-2 text-[13px] text-[#888]">Standard fields</p>
                <div className="px-1">
                  {filteredFields.map((field) => (
                    <button
                      key={field.label}
                      className="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left hover:bg-[#f5f5f5]"
                      onClick={() => { onAdd(field.type); setOpen(false); setSearch(""); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0 text-[#666]" style={{ shapeRendering: "geometricPrecision" }}>
                        <path d={field.icon} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="ml-2 flex-1 text-[13px] text-[#333]">{field.label}</span>
                      {field.hasChevron && (
                        <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0 text-[#ccc]">
                          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {filteredAgents.length === 0 && filteredFields.length === 0 && (
              <p className="py-4 text-center text-[13px] text-[#aaa]">No matching field types</p>
            )}
          </div>
        </div>,
        document.body
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
    setOpen((v) => !v);
  }, [open]);

  function handleDelete() {
    setOpen(false);
    onDelete();
  }

  return (
    <div className={`ml-1 flex-shrink-0 ${open ? "flex" : "hidden group-hover:flex"}`}>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex h-5 w-5 items-center justify-center rounded text-[#555] hover:bg-[#e0e0e0]"
        title="Field options"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed w-[320px] overflow-y-auto rounded-lg border border-[#e2e0ea] bg-white p-1.5 shadow-xl"
          style={{ top: pos.top, left: pos.left, zIndex: 10000, maxHeight: "calc(100vh - 40px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Item icon={<EditIcon />} label="Edit field" onClick={() => { setOpen(false); onEditField(); }} />
          <Divider />
          <Item icon={<DuplicateIcon />} label="Duplicate field" onClick={() => setOpen(false)} />
          <Item icon={<InsertLeftIcon />} label="Insert left" disabled />
          <Item icon={<InsertRightIcon />} label="Insert right" onClick={() => setOpen(false)} />
          <Item icon={<ChangePrimaryIcon />} label="Change primary field" onClick={() => setOpen(false)} />
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
        </div>,
        document.body
      )}
    </div>
  );
}

function Divider() {
  return <div className="mx-1 h-px bg-[#e8e8e8]" />;
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
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] font-normal transition-colors
        ${disabled ? "cursor-default opacity-50" : danger ? "text-[#d32f2f] hover:bg-[#f5f5f5]" : "text-[#333] hover:bg-[#f5f5f5]"}`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${disabled ? "opacity-50" : danger ? "text-[#d32f2f]" : "text-[#333]"}`}>
        {icon}
      </span>
      <span className="ml-1 flex-1">{label}</span>
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
  sortedColumnIds = [],
  filteredColumnIds = [],
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
          style={{ display: "flex", width: 100, minWidth: 100, height: 36, position: "sticky", left: 0, zIndex: 4 }}
          className="items-start justify-center border-b border-[#e2e0ea] bg-white pt-2"
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="h-4 w-4 cursor-pointer appearance-none rounded-[3px] border border-[#d1d5db] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] checked:bg-[#2563eb] checked:border-[#2563eb]"
          />
        </th>

        {/* Left virtual padding spacer */}
        {virtualPaddingLeft > 0 && (
          <th
            style={{ display: "flex", width: virtualPaddingLeft, minWidth: virtualPaddingLeft, height: 36 }}
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
          const colWidth = isPrimary ? 165 : 219;
          const headerName =
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : header.id;
          const isEditing = editingColumnId === columnId;

          const isSorted = sortedColumnIds.includes(columnId);
          const isFiltered = filteredColumnIds.includes(columnId);
          return (
            <th
              key={header.id}
              style={{
                display: "flex", width: colWidth, minWidth: colWidth, height: 36,
                ...(isPrimary ? { position: "sticky", left: 100, zIndex: 4 } : {}),
                backgroundColor: isFiltered ? "#eafaeb" : isSorted ? "#FFF8F3" : undefined,
              }}
              className="group relative items-start border-b border-r border-[#e2e0ea] bg-white px-2 pt-2 text-left hover:!bg-[#f8f8f8]"
            >
              {/* Field type icon — key for primary, text/number otherwise */}
              <div className="flex w-full items-center">
                <span className="mr-1.5 flex-shrink-0 text-[#888]">
                  {isPrimary ? <PrimaryKeyIcon /> : colType === "number" ? <NumberIcon /> : <TextIcon />}
                </span>
                <span
                  className="flex-1 cursor-default truncate text-[13px] font-medium text-[#1d1f25]"
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingColumnId(columnId); }}
                >
                  {headerName}
                </span>
                <ColumnMenu
                  columnId={columnId}
                  columnName={headerName}
                  isPrimary={isPrimary}
                  onRename={(name) => onRenameColumn(columnId, name)}
                  onDelete={() => onDeleteColumn(columnId)}
                  onEditField={() => setEditingColumnId(columnId)}
                />
              </div>

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
            style={{ display: "flex", width: virtualPaddingRight, minWidth: virtualPaddingRight, height: 36 }}
            className="border-b border-[#e2e0ea] bg-white"
          />
        )}

        {/* Add column button — sits after last column */}
        <th
          style={{ display: "flex", width: 90, minWidth: 90, height: 36 }}
          className="border-b border-l border-r border-[#e2e0ea] bg-white p-0"
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
