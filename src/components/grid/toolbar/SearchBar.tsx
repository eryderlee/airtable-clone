"use client";

interface SearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}

export function SearchBar({ searchInput, onSearchChange, onClose }: SearchBarProps) {
  return (
    <div className="w-[320px] rounded-lg border border-[#e2e0ea] bg-white p-2 shadow-lg">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find in view"
          className="w-full rounded border border-[#ccc] px-2 py-1.5 text-[13px] outline-none focus:border-[#166ee1]"
        />
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
          title="Close search"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
