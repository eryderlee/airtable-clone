"use client";

interface GridToolbarProps {
  onBulkCreate: () => void;
  isBulkCreating: boolean;
  rowCount: number;
}

export function GridToolbar({
  onBulkCreate,
  isBulkCreating,
  rowCount,
}: GridToolbarProps) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3">
      <button
        onClick={onBulkCreate}
        disabled={isBulkCreating}
        className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBulkCreating ? "Inserting..." : "Add 100k rows"}
      </button>
      {isBulkCreating && (
        <span className="text-xs text-gray-400">This may take a moment...</span>
      )}
      <span className="ml-auto text-xs text-gray-400">
        {rowCount.toLocaleString()} rows
      </span>
    </div>
  );
}
