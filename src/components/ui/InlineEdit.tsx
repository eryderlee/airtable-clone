"use client";

import { useEffect, useRef, useState } from "react";

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineEdit({ value, onSave, className, editing: editingProp, onEditingChange }: InlineEditProps) {
  const [editingInternal, setEditingInternal] = useState(false);
  const editing = editingProp ?? editingInternal;
  const [draft, setDraft] = useState(value);
  // Optimistic display value — updated immediately on save, before server responds
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function setEditing(v: boolean) {
    setEditingInternal(v);
    onEditingChange?.(v);
  }

  useEffect(() => {
    if (editingProp) {
      setDraft(value);
    }
  }, [editingProp, value]);

  // Once server value catches up to optimistic, clear it
  useEffect(() => {
    if (optimisticValue !== null && value === optimisticValue) {
      setOptimisticValue(null);
    }
  }, [value, optimisticValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleDoubleClick() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== value) {
      setOptimisticValue(trimmed);
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      save();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={`rounded bg-white px-1 ring-2 ring-[#9aa4b6] outline-none ${className ?? ""}`}
      />
    );
  }

  return (
    <span onDoubleClick={handleDoubleClick} className={className}>
      {optimisticValue ?? value}
    </span>
  );
}
