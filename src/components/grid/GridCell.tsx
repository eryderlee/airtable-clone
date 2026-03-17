"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";

interface GridCellProps {
  rowId: string;
  rowIndex: number;
  columnId: string;
  columnType: "text" | "number";
  value: string | number | null;
  isFocused: boolean;
  isEditing: boolean;
  initialDraft?: string; // When set, enter edit mode with this value (for printable char entry)
  searchQuery?: string;
  onCommit: (rowId: string, columnId: string, value: string | number | null) => void;
  onRevert: () => void;
  onStartEditing: () => void;
  onSelect: () => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-200">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GridCell({
  rowId,
  rowIndex,
  columnId,
  columnType,
  value,
  isFocused,
  isEditing,
  initialDraft,
  searchQuery,
  onCommit,
  onRevert,
  onStartEditing,
  onSelect,
}: GridCellProps) {
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize draft and focus when entering edit mode.
  // initialDraft and value are intentionally excluded from deps — only fires on isEditing toggle.
  useEffect(() => {
    if (isEditing) {
      setDraft(initialDraft ?? String(value ?? ""));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (!initialDraft) {
          inputRef.current?.select(); // Select all when Enter/click to edit
        } else {
          // Place cursor at end when typing to enter edit
          const len = (initialDraft ?? "").length;
          inputRef.current?.setSelectionRange(len, len);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]); // Intentionally only depend on isEditing toggle

  const handleCommit = useCallback(() => {
    if (columnType === "number") {
      const trimmed = draft.trim();
      if (trimmed === "") {
        onCommit(rowId, columnId, null);
      } else {
        const numValue = Number(trimmed);
        // Silently ignore invalid number input (e.g., "abc")
        if (isNaN(numValue)) return;
        onCommit(rowId, columnId, numValue);
      }
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
        <span className="truncate">
          {searchQuery && value != null
            ? highlightText(String(value), searchQuery)
            : (value ?? "")}
        </span>
      )}
    </div>
  );
}
