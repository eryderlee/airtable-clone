"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

// Deterministic color palette for base icons (matches Airtable's style)
const BASE_COLORS = [
  "#e8384f", // red
  "#fd612c", // orange
  "#f1a325", // yellow
  "#4ab553", // green
  "#0ebf9a", // teal
  "#20aee3", // blue
  "#6e4bec", // purple (default)
  "#ff4ca1", // pink
  "#8b46ff", // violet
  "#ff8c00", // dark orange
];

function getBaseColor(baseId: string): string {
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    hash = (hash * 31 + baseId.charCodeAt(i)) >>> 0;
  }
  return BASE_COLORS[hash % BASE_COLORS.length] ?? "#6e4bec";
}

type BaseTopBarProps = {
  baseId: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export function BaseTopBar({ baseId }: BaseTopBarProps) {
  const router = useRouter();
  const { data: base } = api.base.getById.useQuery({ id: baseId });
  const baseColor = getBaseColor(baseId);

  return (
    <header className="flex h-[56px] flex-shrink-0 items-center border-b border-[#e4e7ec] bg-white px-3">
      {/* Left: base icon + base name */}
      <div className="flex items-center gap-2">
        {/* Base icon — the Airtable-style 3D box SVG */}
        <div
          className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded"
          style={{ backgroundColor: baseColor }}
          onClick={() => router.push("/")}
        >
          <div style={{ position: "relative", top: 1 }}>
            <svg width="20" height="17" viewBox="0 0 200 170" style={{ shapeRendering: "geometricPrecision" }} xmlns="http://www.w3.org/2000/svg">
              <g>
                <path fill="hsla(0, 0%, 100%, 0.95)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
                <path fill="hsla(0, 0%, 100%, 0.95)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
                <path fill="hsla(0, 0%, 100%, 0.95)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
              </g>
            </svg>
          </div>
        </div>

        {/* Base name */}
        <button className="flex items-center gap-1 rounded px-1 py-0.5 text-[15px] font-semibold text-[#1f2328] hover:bg-[#f3f4f6]">
          {base?.name ?? "Untitled Base"}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Center: nav tabs */}
      <nav className="flex flex-1 items-end justify-center self-stretch">
        {[
          { label: "Data", active: true },
          { label: "Automations", active: false },
          { label: "Interfaces", active: false },
          { label: "Forms", active: false },
        ].map(({ label, active }) => (
          <button
            key={label}
            className={`relative flex h-full items-center px-4 text-[14px] font-medium transition-colors ${
              active ? "text-[#1f2328]" : "text-[#6b7280] hover:text-[#1f2328]"
            }`}
          >
            {label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-[#2563eb]" />
            )}
          </button>
        ))}
      </nav>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1.5">
        {/* History */}
        <button className="flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]" title="History">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Upgrade */}
        <button className="flex items-center gap-1.5 rounded border border-[#e4e7ec] px-2.5 py-1 text-[13px] font-medium text-[#374151] hover:bg-[#f3f4f6]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7.8 4.5L11.5 5L9 7.5L9.5 11L6 9.2L2.5 11L3 7.5L0.5 5L4.2 4.5L6 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          Upgrade
        </button>

        {/* Launch */}
        <button className="flex items-center gap-1.5 rounded border border-[#e4e7ec] px-2.5 py-1 text-[13px] font-medium text-[#374151] hover:bg-[#f3f4f6]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H5.5M10 2V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Launch
        </button>

        {/* Link icon — in a bordered box */}
        <button className="flex h-7 w-7 items-center justify-center rounded border border-[#e4e7ec] text-[#6b7280] hover:bg-[#f3f4f6]" title="Copy link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.5 8.5L8.5 5.5M6.5 3.5L7.5 2.5a3 3 0 1 1 4.243 4.243L10.5 7.5M7.5 10.5l-1 1a3 3 0 1 1-4.243-4.243L3.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        {/* Share */}
        <button className="rounded bg-[#1f2328] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#374151]">
          Share
        </button>
      </div>
    </header>
  );
}
