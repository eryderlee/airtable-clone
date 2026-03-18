"use client";

import { ColumnTypeIcon } from "../ColumnIcons";

interface HideFieldsPanelProps {
  columnsData: { id: string; name: string; type: string; isPrimary: boolean }[];
  hiddenColumns: string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  onClose: () => void;
}


export function HideFieldsPanel({
  columnsData,
  hiddenColumns,
  onHiddenColumnsChange,
}: HideFieldsPanelProps) {
  const toggleColumn = (id: string) => {
    if (hiddenColumns.includes(id)) {
      onHiddenColumnsChange(hiddenColumns.filter((c) => c !== id));
    } else {
      onHiddenColumnsChange([...hiddenColumns, id]);
    }
  };

  const handleHideAll = () => {
    const nonPrimary = columnsData.filter((c) => !c.isPrimary).map((c) => c.id);
    onHiddenColumnsChange(nonPrimary);
  };

  const handleShowAll = () => {
    onHiddenColumnsChange([]);
  };

  return (
    <div className="w-[280px] rounded-lg border border-[#e2e0ea] bg-white shadow-lg">
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-[#e2e0ea] px-3 py-2">
        <input
          type="text"
          placeholder="Find a field"
          className="flex-1 bg-transparent text-[11px] text-[#1f2328] outline-none placeholder:text-[#9ca3af]"
        />
        <button className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6]" title="Help">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 5.5a1.5 1.5 0 1 1 2 1.415V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.6" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Column list */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {columnsData.filter((col) => !col.isPrimary).map((col) => {
          const isVisible = !hiddenColumns.includes(col.id);
          return (
            <div
              key={col.id}
              className="flex items-center gap-2 px-3 py-[6px] hover:bg-[#f5f7fa]"
            >
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={isVisible}
                onClick={() => toggleColumn(col.id)}
                className={`relative flex h-[8px] w-[14px] flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${isVisible ? "bg-[#2563eb]" : "bg-[#d1d5db]"}`}
              >
                <span
                  className={`absolute h-[5px] w-[5px] rounded-full bg-white shadow-sm transition-transform ${
                    isVisible ? "translate-x-[7px]" : "translate-x-[1.5px]"
                  }`}
                />
              </button>

              {/* Field type icon */}
              <span className="flex-shrink-0 text-[#6b7280]">
                <ColumnTypeIcon type={col.type} isPrimary={col.isPrimary} />
              </span>

              {/* Column name */}
              <span className="flex-1 truncate text-[13px] text-[#1f2328]">{col.name}</span>

              {/* Drag handle (6-dot) */}
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="flex-shrink-0 text-[#d1d5db]">
                <circle cx="3" cy="3" r="1.1" />
                <circle cx="7" cy="3" r="1.1" />
                <circle cx="3" cy="7" r="1.1" />
                <circle cx="7" cy="7" r="1.1" />
                <circle cx="3" cy="11" r="1.1" />
                <circle cx="7" cy="11" r="1.1" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* Hide all / Show all */}
      <div className="flex gap-2 border-t border-[#e2e0ea] px-3 py-2">
        <button
          onClick={handleHideAll}
          className="flex-1 rounded bg-[#f0f1f3] py-1.5 text-[10px] font-medium text-[#4c5667] hover:bg-[#e8eaed]"
        >
          Hide all
        </button>
        <button
          onClick={handleShowAll}
          className="flex-1 rounded bg-[#f0f1f3] py-1.5 text-[10px] font-medium text-[#4c5667] hover:bg-[#e8eaed]"
        >
          Show all
        </button>
      </div>
    </div>
  );
}
