"use client";

import type { SortCondition } from "~/server/api/routers/row";

interface SortPanelProps {
  sorts: SortCondition[];
  onSortsChange: (sorts: SortCondition[]) => void;
  columnsData: { id: string; name: string; type: string }[];
  onClose: () => void;
}

function getDirectionOptions(colType: string) {
  if (colType === "number") {
    return [
      { value: "asc", label: "1 to 9" },
      { value: "desc", label: "9 to 1" },
    ];
  }
  return [
    { value: "asc", label: "A to Z" },
    { value: "desc", label: "Z to A" },
  ];
}

export function SortPanel({ sorts, onSortsChange, columnsData, onClose }: SortPanelProps) {
  const firstColumn = columnsData[0];

  const handleAddSort = () => {
    if (!firstColumn) return;
    const newSort: SortCondition = {
      columnId: firstColumn.id,
      direction: "asc",
    };
    onSortsChange([...sorts, newSort]);
  };

  const handleRemove = (index: number) => {
    onSortsChange(sorts.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, columnId: string) => {
    const updated = sorts.map((s, i) => {
      if (i !== index) return s;
      return { columnId, direction: s.direction };
    });
    onSortsChange(updated);
  };

  const handleDirectionChange = (index: number, direction: "asc" | "desc") => {
    const updated = sorts.map((s, i) => {
      if (i !== index) return s;
      return { ...s, direction };
    });
    onSortsChange(updated);
  };

  return (
    <div className="w-[400px] rounded-lg border border-[#e2e0ea] bg-white p-3 shadow-lg">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        {sorts.length > 0 && (
          <span className="text-[13px] text-[#6b7280]">Sort by</span>
        )}
        <div className="ml-auto">
          <button
            onClick={onClose}
            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            title="Close sort panel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sort rules */}
      <div className="flex flex-col gap-2">
        {sorts.map((s, i) => {
          const col = columnsData.find((c) => c.id === s.columnId);
          const colType = col?.type ?? "text";
          const directionOptions = getDirectionOptions(colType);

          return (
            <div key={i} className="flex items-center gap-2">
              {/* Column picker */}
              <select
                value={s.columnId}
                onChange={(e) => handleColumnChange(i, e.target.value)}
                className="rounded border border-[#ddd] px-2 py-1 text-[13px]"
              >
                {columnsData.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Direction picker */}
              <select
                value={s.direction}
                onChange={(e) => handleDirectionChange(i, e.target.value as "asc" | "desc")}
                className="rounded border border-[#ddd] px-2 py-1 text-[13px]"
              >
                {directionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(i)}
                className="ml-auto rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                title="Remove sort rule"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add sort */}
      <button
        onClick={handleAddSort}
        className="mt-3 flex items-center gap-1 rounded px-2 py-1 text-[13px] text-[#166ee1] hover:bg-[#eff6ff]"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add sort
      </button>
    </div>
  );
}
