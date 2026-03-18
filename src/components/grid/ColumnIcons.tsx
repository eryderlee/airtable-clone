export function PrimaryKeyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="4.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 5h3M8 3.5V5M9.5 3.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function TextIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M6 3v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function NumberIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2l-1 8M8.5 2l-1 8M2 4.5h8M1.5 7.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ColumnTypeIcon({ type, isPrimary }: { type: string; isPrimary?: boolean }) {
  if (isPrimary) return <PrimaryKeyIcon />;
  if (type === "number") return <NumberIcon />;
  return <TextIcon />;
}
