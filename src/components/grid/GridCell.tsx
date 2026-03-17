"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface GridCellProps {
  rowId: string;
  rowIndex: number;
  columnId: string;
  columnType: "text" | "number";
  value: string | number | null;
  isFocused: boolean;
  isEditing: boolean;
  onCommit: (rowId: string, columnId: string, value: string | number | null) => void;
  onRevert: () => void;
  onStartEditing: () => void;
  onSelect: () => void;
}

export function GridCell({
  rowId,
  rowIndex,
  columnId,
  columnType,
  value,
  isFocused,
  isEditing,
  onCommit,
  onRevert,
  onStartEditing,
  onSelect,
}: GridCellProps) {
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize draft when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setDraft(String(value ?? ""));
    }
  }, [isEditing, value]);

  // Auto-focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleCommit = useCallback(() => {
    if (columnType === "number") {
      const trimmed = draft.trim();
      const numValue = trimmed === "" ? null : Number(trimmed);
      // Only commit if valid number or null (empty)
      if (trimmed !== "" && isNaN(numValue as number)) return;
      onCommit(rowId, columnId, numValue);
    } else {
      onCommit(rowId, columnId, draft);
    }
  }, [draft, columnType, rowId, columnId, onCommit]);

  const handleClick = () => {
    if (!isFocused) {
      onSelect();
    } else if (!isEditing) {
      onStartEditing();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onRevert();
    } else if (e.key === "Enter") {
      e.stopPropagation();
      handleCommit();
    }
    // Tab is handled by container-level handler in 05-02
  };

  const handleBlur = useCallback(() => {
    handleCommit();
  }, [handleCommit]);

  return (
    <div
      data-row-index={rowIndex}
      data-column-id={columnId}
      tabIndex={-1}
      onClick={handleClick}
      className={`flex h-full w-full items-center truncate px-2 py-1 text-sm outline-none ${
        isFocused ? "ring-2 ring-inset ring-blue-500" : ""
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type={columnType === "number" ? "number" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          className="h-full w-full bg-transparent outline-none"
        />
      ) : (
        <span className="truncate">{value ?? ""}</span>
      )}
    </div>
  );
}
