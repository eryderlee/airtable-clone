"use client";

import type { FilterCondition } from "~/server/api/routers/row";

interface FilterPanelProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
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

export function FilterPanel({ filters, onFiltersChange, columnsData, onClose }: FilterPanelProps) {
  const firstColumn = columnsData[0];

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
    <div className="w-[480px] rounded-lg border border-[#e2e0ea] bg-white p-3 shadow-lg">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] text-[#6b7280]">
          In this view, show records that match
        </span>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
          title="Close filter panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Filter conditions */}
      <div className="flex flex-col gap-2">
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
            <div key={i} className="flex items-center gap-2">
              {/* Column picker */}
              <select
                value={f.columnId}
                onChange={(e) => handleColumnChange(i, e.target.value)}
                className="rounded border border-[#ddd] px-2 py-1 text-[13px]"
              >
                {columnsData.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Operator picker */}
              <select
                value={currentOperator}
                onChange={(e) => handleOperatorChange(i, e.target.value)}
                className="rounded border border-[#ddd] px-2 py-1 text-[13px]"
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value input */}
              {showValueInput && (
                <input
                  type={colType === "number" ? "number" : "text"}
                  value={currentValue}
                  onChange={(e) => handleValueChange(i, e.target.value)}
                  placeholder="Value"
                  className="w-28 rounded border border-[#ddd] px-2 py-1 text-[13px] outline-none focus:border-[#166ee1]"
                />
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemove(i)}
                className="ml-auto rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                title="Remove condition"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add condition */}
      <button
        onClick={handleAddCondition}
        className="mt-3 flex items-center gap-1 rounded px-2 py-1 text-[13px] text-[#166ee1] hover:bg-[#eff6ff]"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add condition
      </button>
    </div>
  );
}

// Export a helper for determining the default operator per type (used by SortPanel indirectly)
export { getDefaultOperator };
