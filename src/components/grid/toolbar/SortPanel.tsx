"use client";

import { useState, useEffect, useRef } from "react";
import type { SortCondition } from "~/server/api/routers/row";
import { ColumnTypeIcon } from "../ColumnIcons";

interface SortPanelProps {
  sorts: SortCondition[];
  onSortsChange: (sorts: SortCondition[]) => void;
  columnsData: { id: string; name: string; type: string; isPrimary?: boolean }[];
  onClose: () => void;
}

function getDirectionOptions(colType: string) {
  if (colType === "number") {
    return [
      { value: "asc", label: "1 → 9" },
      { value: "desc", label: "9 → 1" },
    ];
  }
  return [
    { value: "asc", label: "A → Z" },
    { value: "desc", label: "Z → A" },
  ];
}

export function SortPanel({ sorts, onSortsChange, columnsData }: SortPanelProps) {
  const [search, setSearch] = useState("");
  const [autoSort, setAutoSort] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const handleAddSort = (columnId: string) => {
    if (sorts.some((s) => s.columnId === columnId)) return;
    onSortsChange([...sorts, { columnId, direction: "asc" }]);
  };

  const handleRemove = (index: number) => {
    onSortsChange(sorts.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, columnId: string) => {
    onSortsChange(sorts.map((s, i) => i !== index ? s : { ...s, columnId }));
  };

  const handleDirectionChange = (index: number, direction: "asc" | "desc") => {
    onSortsChange(sorts.map((s, i) => i !== index ? s : { ...s, direction }));
  };

  const filteredColumns = columnsData.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e0ea] bg-white shadow-lg" style={{ minWidth: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[#6b7280]">Sort by</span>
          <button className="flex h-4 w-4 items-center justify-center text-[#9ca3af] hover:text-[#6b7280]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6.5 6.5a1.5 1.5 0 1 1 2.6 1.5c-.5.4-.9.9-.9 1.5v.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="12" r="0.7" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-4 border-b border-[#e2e0ea]" />

      {/* Active sort rules */}
      {sorts.length > 0 && (
        <div className="overflow-auto px-4 pt-3" style={{ minHeight: 70, maxHeight: "calc(100vh - 380px)" }}>
          <ul className="flex flex-col gap-2">
            {sorts.map((s, i) => {
              const col = columnsData.find((c) => c.id === s.columnId);
              const colType = col?.type ?? "text";
              const directionOptions = getDirectionOptions(colType);
              return (
                <li key={i} className="flex items-center gap-2">
                  {/* Column dropdown */}
                  <div className="flex items-center rounded border border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]" style={{ width: 240, height: 28 }}>
                    <select
                      value={s.columnId}
                      onChange={(e) => handleColumnChange(i, e.target.value)}
                      className="w-full appearance-none bg-transparent px-2 text-[13px] text-[#1f2328] outline-none"
                    >
                      {columnsData.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mr-2 flex-shrink-0 text-[#6b7280]">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* Direction dropdown */}
                  <div className="flex items-center rounded border border-[#e2e0ea] bg-white hover:bg-[#f5f7fa]" style={{ width: 120, height: 28 }}>
                    <select
                      value={s.direction}
                      onChange={(e) => handleDirectionChange(i, e.target.value as "asc" | "desc")}
                      className="w-full appearance-none bg-transparent px-2 text-[13px] text-[#1f2328] outline-none"
                    >
                      {directionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mr-2 flex-shrink-0 text-[#6b7280]">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(i)}
                    className="flex h-7 w-7 items-center justify-center rounded text-[#9ca3af] hover:bg-[#f5f7fa] hover:text-[#374151]"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Add another sort — inline field picker */}
          <div className="mt-1 mb-1" ref={pickerRef}>
            {!pickerOpen ? (
              <button
                className="flex items-center gap-2 px-1 py-1 text-[13px] text-[#6b7280] hover:text-[#1f2328]"
                onClick={() => setPickerOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add another sort
              </button>
            ) : (
              <div className="overflow-hidden rounded border border-[#e2e0ea] bg-white">
                <div className="flex items-center gap-2 border-b border-[#e2e0ea] px-3 py-1.5">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-[#9ca3af]">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Find a field"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-[#1f2328] outline-none placeholder:text-[#9ca3af]"
                    autoFocus
                  />
                  <button
                    onClick={() => { setPickerOpen(false); setSearch(""); }}
                    className="flex-shrink-0 text-[#9ca3af] hover:text-[#374151]"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto py-1" style={{ maxHeight: 180 }}>
                  {filteredColumns.filter((c) => !sorts.some((s) => s.columnId === c.id)).map((col) => (
                    <button
                      key={col.id}
                      onClick={() => { handleAddSort(col.id); setPickerOpen(false); setSearch(""); }}
                      className="flex w-full items-center gap-3 px-3 py-[5px] text-[13px] text-[#1f2328] hover:bg-[#f5f7fa]"
                    >
                      <span className="flex-shrink-0 text-[#6b7280]">
                        <ColumnTypeIcon type={col.type} isPrimary={col.isPrimary ?? false} />
                      </span>
                      <span>{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Field picker (shown when no sorts) */}
      {sorts.length === 0 && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-[#9ca3af]">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Find a field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-[#1f2328] outline-none placeholder:text-[#9ca3af]"
            />
          </div>
          <div className="overflow-y-auto pb-2" style={{ minHeight: 100, maxHeight: "calc(100vh - 380px)" }}>
            {filteredColumns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleAddSort(col.id)}
                className="flex w-full items-center gap-3 rounded px-3 py-[5px] text-[13px] text-[#1f2328] hover:bg-[#f5f7fa]"
              >
                <span className="flex-shrink-0 text-[#6b7280]">
                  <ColumnTypeIcon type={col.type} isPrimary={col.isPrimary ?? false} />
                </span>
                <span>{col.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bottom bar: Automatically sort records toggle */}
      <div className="flex items-center justify-between border-t border-[#e2e0ea] bg-[#f9fafb] px-3" style={{ minHeight: 44 }}>
        <button
          onClick={() => setAutoSort((v) => !v)}
          className="flex items-center gap-2 text-[13px] text-[#1f2328]"
        >
          {/* Toggle pill */}
          <div
            className="relative flex flex-none items-center rounded-full transition-colors"
            style={{
              width: 19.2, height: 12, padding: 2,
              backgroundColor: autoSort ? "#2563eb" : "#d1d5db",
            }}
          >
            <div
              className="absolute h-2 w-2 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: autoSort ? "translateX(7.2px)" : "translateX(0px)" }}
            />
          </div>
          Automatically sort records
        </button>
      </div>
    </div>
  );
}
