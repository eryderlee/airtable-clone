"use client";

interface SearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  matchCount: number;
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
}

export function SearchBar({
  searchInput,
  onSearchChange,
  onClose,
  matchCount,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
}: SearchBarProps) {
  const hasQuery = searchInput.trim().length > 0;

  return (
    <div className="w-[360px] rounded-lg border border-[#e2e0ea] bg-white p-2 shadow-lg">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find in view"
          className="w-full rounded border border-[#ccc] px-2 py-1.5 text-[13px] outline-none focus:border-[#166ee1]"
        />

        {/* Match count indicator */}
        {hasQuery && (
          <span className="flex-shrink-0 text-[12px] text-[#6b7280]">
            {matchCount === 0 ? "No matches" : `${currentMatchIndex + 1} of ${matchCount}`}
          </span>
        )}

        {/* Prev / next navigation */}
        <button
          onClick={onPrevMatch}
          disabled={matchCount === 0}
          className="flex-shrink-0 rounded p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous match"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 8L6 4L10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onNextMatch}
          disabled={matchCount === 0}
          className="flex-shrink-0 rounded p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
          title="Next match"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

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
