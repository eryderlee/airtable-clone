"use client";

import { useState, useRef, useEffect } from "react";
import type { FilterCondition } from "~/server/api/routers/row";

interface FilterPanelProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  filterConjunction: "and" | "or";
  onFilterConjunctionChange: (v: "and" | "or") => void;
  columnsData: { id: string; name: string; type: string }[];
  onClose: () => void;
}

const TEXT_OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "does_not_contain", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
] as const;

const NUMBER_OPERATORS = [
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
] as const;

function getDefaultFilter(type: string): FilterCondition["filter"] {
  if (type === "number") {
    return { type: "number", operator: "greater_than", value: 0 };
  }
  return { type: "text", operator: "contains", value: "" };
}

function getOperatorsForType(type: string) {
  return type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS;
}

function getDefaultOperator(type: string): string {
  return type === "number" ? "greater_than" : "contains";
}

export function FilterPanel({ filters, onFiltersChange, filterConjunction, onFilterConjunctionChange, columnsData, onClose }: FilterPanelProps) {
  const firstColumn = columnsData[0];
  const [conjunctionDropdownOpen, setConjunctionDropdownOpen] = useState(false);
  const [conjunctionAnchor, setConjunctionAnchor] = useState<DOMRect | null>(null);
  const conjunctionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conjunctionDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (conjunctionMenuRef.current && !conjunctionMenuRef.current.contains(e.target as Node)) {
        setConjunctionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [conjunctionDropdownOpen]);

  const handleAddCondition = () => {
    if (!firstColumn) return;
    const newFilter: FilterCondition = {
      columnId: firstColumn.id,
      filter: getDefaultFilter(firstColumn.type),
    };
    onFiltersChange([...filters, newFilter]);
  };

  const handleRemove = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, columnId: string) => {
    const col = columnsData.find((c) => c.id === columnId);
    const colType = col?.type ?? "text";
    const updated = filters.map((f, i) => {
      if (i !== index) return f;
      return {
        columnId,
        filter: getDefaultFilter(colType),
      };
    });
    onFiltersChange(updated);
  };

  const handleOperatorChange = (index: number, operator: string) => {
    const updated = filters.map((f, i) => {
      if (i !== index) return f;
      const col = columnsData.find((c) => c.id === f.columnId);
      const colType = col?.type ?? "text";
      if (colType === "number") {
        return {
          ...f,
          filter: {
            type: "number" as const,
            operator: operator as "greater_than" | "less_than",
            value: f.filter.type === "number" ? f.filter.value : 0,
          },
        };
      } else {
        const op = operator as "contains" | "does_not_contain" | "equals" | "is_empty" | "is_not_empty";
        return {
          ...f,
          filter: {
            type: "text" as const,
            operator: op,
            value: f.filter.type === "text" ? (f.filter.value ?? "") : "",
          },
        };
      }
    });
    onFiltersChange(updated);
  };

  const handleValueChange = (index: number, value: string) => {
    const updated = filters.map((f, i) => {
      if (i !== index) return f;
      const col = columnsData.find((c) => c.id === f.columnId);
      const colType = col?.type ?? "text";
      if (colType === "number") {
        const numVal = parseFloat(value);
        return {
          ...f,
          filter: {
            type: "number" as const,
            operator: f.filter.type === "number" ? f.filter.operator : ("greater_than" as const),
            value: isNaN(numVal) ? 0 : numVal,
          },
        };
      } else {
        return {
          ...f,
          filter: {
            type: "text" as const,
            operator: f.filter.type === "text" ? f.filter.operator : ("contains" as const),
            value,
          },
        };
      }
    });
    onFiltersChange(updated);
  };

  const hideValueInput = (filter: FilterCondition["filter"]) => {
    if (filter.type === "text") {
      return filter.operator === "is_empty" || filter.operator === "is_not_empty";
    }
    return false;
  };

  return (
    <div className="w-[520px] rounded-lg border border-[#e2e0ea] bg-white shadow-lg">
      {/* Title */}
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-[13px] font-semibold text-[#1f2328]">Filter</span>
      </div>

      {/* AI prompt bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-[6px] border border-[#e2e0ea] bg-white px-2 py-1.5">
          {/* Spinner icon */}
          <svg className="h-4 w-4 flex-shrink-0 text-[#2d7ff9]" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.3" />
          </svg>
          <input
            type="text"
            placeholder="Describe what you want to see"
            className="flex-1 bg-transparent text-[13px] text-[#1f2328] outline-none placeholder:text-[#9ca3af]"
          />
        </div>
      </div>

      {/* "In this view, show records" label */}
      {filters.length > 0 && (
        <div className="px-3 pb-1 text-[12px] text-[#6b7280]">In this view, show records</div>
      )}

      {/* No filters empty state */}
      {filters.length === 0 && (
        <div className="flex items-center gap-2 px-3 pb-3 text-[13px] text-[#6b7280]">
          No filter conditions are applied
          <button className="flex h-4 w-4 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M4.5 4.8a1.5 1.5 0 1 1 2 1.415V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <circle cx="6" cy="8.8" r="0.55" fill="currentColor" />
            </svg>
          </button>
        </div>
      )}

      {/* Filter conditions */}
      {filters.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto px-3 pb-2">
          <div className="flex flex-col gap-1.5">
            {filters.map((f, i) => {
              const col = columnsData.find((c) => c.id === f.columnId);
              const colType = col?.type ?? "text";
              const operators = getOperatorsForType(colType);
              const currentOperator = f.filter.operator;
              const currentValue =
                f.filter.type === "text"
                  ? (f.filter.value ?? "")
                  : String(f.filter.value);
              const showValueInput = !hideValueInput(f.filter);

              return (
                <div key={i} className="flex items-stretch gap-0 rounded border border-[#e2e0ea]" style={{ height: 30 }}>
                  {/* Where / And / Or label */}
                  <div className="flex w-[72px] flex-shrink-0 items-center px-2 text-[12px] text-[#6b7280]">
                    {i === 0 ? "Where" : (
                      <button
                        onClick={(e) => {
                          setConjunctionAnchor(e.currentTarget.getBoundingClientRect());
                          setConjunctionDropdownOpen((v) => !v);
                        }}
                        className="flex items-center gap-0.5 rounded px-1 py-0.5 font-medium text-[#2563eb] hover:bg-[#eff6ff]"
                      >
                        {filterConjunction === "or" ? "Or" : "And"}
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Column picker */}
                  <div className="flex items-stretch border-l border-[#e2e0ea]" style={{ width: 130 }}>
                    <select
                      value={f.columnId}
                      onChange={(e) => handleColumnChange(i, e.target.value)}
                      className="w-full bg-transparent px-2 text-[12px] text-[#1f2328] outline-none hover:bg-[#f5f7fa]"
                    >
                      {columnsData.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Operator picker */}
                  <div className="flex items-stretch border-l border-[#e2e0ea]" style={{ width: 130 }}>
                    <select
                      value={currentOperator}
                      onChange={(e) => handleOperatorChange(i, e.target.value)}
                      className="w-full bg-transparent px-2 text-[12px] text-[#1f2328] outline-none hover:bg-[#f5f7fa]"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Value input */}
                  {showValueInput && (
                    <div className="flex flex-1 items-stretch border-l border-[#e2e0ea]">
                      <input
                        type={colType === "number" ? "number" : "text"}
                        value={currentValue}
                        onChange={(e) => handleValueChange(i, e.target.value)}
                        placeholder="Enter a value"
                        className="w-full bg-transparent px-2 text-[12px] text-[#1f2328] outline-none placeholder:text-[#9ca3af]"
                      />
                    </div>
                  )}

                  {/* Trash + drag handle */}
                  <div className="flex items-stretch border-l border-[#e2e0ea]">
                    <button
                      onClick={() => handleRemove(i)}
                      className="flex w-8 items-center justify-center border-r border-[#e2e0ea] text-[#9ca3af] hover:bg-[#f5f7fa] hover:text-[#374151]"
                      title="Remove"
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 4h9M5.5 4V2.5h3V4M6 6.5v4M8 6.5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3.5 4l.5 7.5h6L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button className="flex w-8 cursor-grab items-center justify-center text-[#9ca3af] hover:bg-[#f5f7fa]">
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="text-[#d1d5db]">
                        <circle cx="3" cy="3" r="1.1" /><circle cx="7" cy="3" r="1.1" />
                        <circle cx="3" cy="7" r="1.1" /><circle cx="7" cy="7" r="1.1" />
                        <circle cx="3" cy="11" r="1.1" /><circle cx="7" cy="11" r="1.1" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: Add condition / Add condition group / Copy from another view */}
      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddCondition}
            className="flex items-center gap-1 text-[13px] font-medium text-[#6b7280] hover:text-[#1f2328]"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add condition
          </button>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 text-[13px] font-medium text-[#6b7280] hover:text-[#1f2328]">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add condition group
            </button>
            <button className="flex h-4 w-4 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M4.5 4.8a1.5 1.5 0 1 1 2 1.415V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <circle cx="6" cy="8.8" r="0.55" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <button className="text-[13px] font-medium text-[#6b7280] hover:text-[#1f2328]">
          Copy from another view
        </button>
      </div>

      {/* And / Or dropdown — fixed position relative to button */}
      {conjunctionDropdownOpen && conjunctionAnchor && (
        <div
          ref={conjunctionMenuRef}
          style={{
            position: "fixed",
            // Prefer below; if too close to bottom, flip above
            top: conjunctionAnchor.bottom + 4,
            left: conjunctionAnchor.left,
            zIndex: 9999,
          }}
          className="w-[90px] rounded-md border border-[#e2e0ea] bg-white py-1 shadow-lg"
        >
          {(["and", "or"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onFilterConjunctionChange(opt);
                setConjunctionDropdownOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-[13px] text-[#1f2328]"
            >
              {opt === "and" ? "And" : "Or"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Export a helper for determining the default operator per type (used by SortPanel indirectly)
export { getDefaultOperator };
