"use client";

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
  onClose,
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
    <div className="w-[280px] rounded-lg border border-[#e2e0ea] bg-white p-3 shadow-lg">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#1f2328]">Hide fields</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Column list */}
      <div className="flex flex-col gap-1">
        {columnsData.map((col) => {
          const isHidden = hiddenColumns.includes(col.id);
          const isVisible = !isHidden;

          return (
            <div
              key={col.id}
              className="flex items-center gap-2 rounded px-1 py-1 hover:bg-[#f5f7fa]"
            >
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={isVisible}
                disabled={col.isPrimary}
                onClick={() => !col.isPrimary && toggleColumn(col.id)}
                className={`relative flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
                  col.isPrimary
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer"
                } ${isVisible ? "bg-[#166ee1]" : "bg-[#ccc]"}`}
                title={col.isPrimary ? "Primary column cannot be hidden" : undefined}
              >
                <span
                  className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    isVisible ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* Column name */}
              <span className="flex-1 truncate text-[13px] text-[#1f2328]">{col.name}</span>

              {/* Primary label */}
              {col.isPrimary && (
                <span className="text-[11px] text-[#9ca3af]">(Primary)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hide all / Show all buttons */}
      <div className="mt-3 flex items-center gap-2 border-t border-[#f0edf8] pt-2">
        <button
          onClick={handleHideAll}
          className="rounded px-2 py-1 text-[12px] text-[#4c5667] hover:bg-[#edf0f4]"
        >
          Hide all
        </button>
        <button
          onClick={handleShowAll}
          className="rounded px-2 py-1 text-[12px] text-[#4c5667] hover:bg-[#edf0f4]"
        >
          Show all
        </button>
      </div>
    </div>
  );
}
