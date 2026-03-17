"use client";

import { useEffect, useRef, useState } from "react";

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
}

export function InlineEdit({ value, onSave, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

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
        className={`bg-transparent outline-none ${className ?? ""}`}
      />
    );
  }

  return (
    <span onDoubleClick={handleDoubleClick} className={className}>
      {value}
    </span>
  );
}
