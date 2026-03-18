"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useBaseColor } from "./BaseColorContext";

const COLOR_PALETTE = [
  // Row 1 — light pastels
  ["#ffc9d4","#ffd4b8","#ffedb8","#c8edc8","#b8e8e8","#c8dcf5","#d8cef5","#d8d8d8"],
  // Row 2 — dark/saturated
  ["#e8384f","#f06a00","#f1bc00","#20a84a","#00b2b2","#1264a3","#b144c0","#666666"],
];

function getBaseColor(color: string | null | undefined, id: string): string {
  if (color) return color;
  const defaults = ["#4aa4ff", "#f97316", "#22c55e", "#a855f7", "#ec4899"];
  const index = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % defaults.length;
  return defaults[index] ?? "#4aa4ff";
}

type BaseTopBarProps = {
  baseId: string;
  initialColor?: string | null;
  initialName?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export function BaseTopBar({ baseId, initialColor, initialName }: BaseTopBarProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: base } = api.base.getById.useQuery({ id: baseId }, { staleTime: Infinity });
  const { liveColor, setLiveColor } = useBaseColor();
  const baseColor = liveColor ?? getBaseColor(base?.color ?? initialColor, baseId);
  const [menuOpen, setMenuOpen] = useState(false);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [appearanceTab, setAppearanceTab] = useState<"color" | "icon">("color");
  const [renamingBase, setRenamingBase] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateBase = api.base.update.useMutation({
    onSuccess: (updated) => {
      utils.base.getById.setData({ id: baseId }, updated);
      void utils.base.getAll.invalidate();
      setOptimisticName(null);
    },
  });

  function handleColorSelect(color: string) {
    setLiveColor(color);
    updateBase.mutate({ id: baseId, color });
  }

  useEffect(() => {
    if (renamingBase) renameInputRef.current?.select();
  }, [renamingBase]);

  function handleRenameStart() {
    setRenameValue(base?.name ?? "");
    setRenamingBase(true);
  }

  function handleRenameCommit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== base?.name) {
      setOptimisticName(trimmed);
      updateBase.mutate({ id: baseId, name: trimmed });
    }
    setRenamingBase(false);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setExpandedSection(null);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="relative flex h-[56px] flex-shrink-0 items-center border-b border-[#e4e7ec] bg-white px-3">
      {/* Left: base icon + base name */}
      <div className="flex items-center gap-2">
        {/* Base icon — the Airtable-style 3D box SVG */}
        <div
          className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded"
          style={{ backgroundColor: baseColor }}
          onClick={() => router.push("/")}
        >
          <div style={{ position: "relative", top: 1 }}>
            <svg width="26" height="22" viewBox="0 0 200 170" style={{ shapeRendering: "geometricPrecision" }} xmlns="http://www.w3.org/2000/svg">
              <g>
                <path fill="hsla(0, 0%, 0%, 0.85)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
                <path fill="hsla(0, 0%, 0%, 0.85)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
                <path fill="hsla(0, 0%, 0%, 0.85)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
              </g>
            </svg>
          </div>
        </div>

        {/* Base name + dropdown */}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setExpandedSection(null); }}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-[15px] font-semibold text-[#1f2328] hover:bg-[#f3f4f6]"
          >
            {optimisticName ?? base?.name ?? initialName ?? "Untitled Base"}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-xl border border-[#e4e7ec] bg-white shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
                {renamingBase ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameCommit();
                      if (e.key === "Escape") setRenamingBase(false);
                    }}
                    className="flex-1 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[15px] font-semibold text-[#1f2328] outline-none ring-2 ring-[#2563eb]"
                  />
                ) : (
                  <span
                    onClick={handleRenameStart}
                    className="cursor-text text-[15px] font-semibold text-[#1f2328] hover:text-[#2563eb]"
                    title="Click to rename"
                  >
                    {optimisticName ?? base?.name ?? "Untitled Base"}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <button className="text-[#9aa4b6] hover:text-[#1f2328]" title="Favourite">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M8 2l1.8 3.6 4 .6-2.9 2.8.7 4L8 11l-3.6 2 .7-4L2.2 6.2l4-.6L8 2z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button className="text-[#9aa4b6] hover:text-[#1f2328]" title="More options">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="3" cy="8" r="1.4" />
                      <circle cx="8" cy="8" r="1.4" />
                      <circle cx="13" cy="8" r="1.4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Appearance section */}
              <button
                onClick={() => setExpandedSection(expandedSection === "appearance" ? null : "appearance")}
                className="flex w-full items-center gap-2 px-4 py-3 text-[14px] font-medium text-[#1f2328] hover:bg-[#f4f6fb]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d={expandedSection === "appearance" ? "M2 4.5L6 8L10 4.5" : "M4.5 2L8 6L4.5 10"} strokeLinejoin="round" />
                </svg>
                Appearance
              </button>
              {expandedSection === "appearance" && (
                <div className="border-t border-[#f0f0f0] px-4 py-3">
                  {/* Tabs */}
                  <div className="mb-3 flex gap-4 border-b border-[#f0f0f0]">
                    {(["color", "icon"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAppearanceTab(tab)}
                        className={`pb-2 text-[13px] font-medium capitalize transition-colors ${appearanceTab === tab ? "border-b-2 border-[#2563eb] text-[#2563eb]" : "text-[#6b7280] hover:text-[#1f2328]"}`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {appearanceTab === "color" && (
                    <div className="space-y-1.5">
                      {COLOR_PALETTE.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1.5">
                          {row.map((c) => {
                            const isActive = baseColor === c;
                            const isDark = rowIdx === 1;
                            return (
                              <button
                                key={c}
                                onClick={() => handleColorSelect(c)}
                                style={{ backgroundColor: c }}
                                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                                title={c}
                              >
                                {isActive && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke={isDark ? "white" : "#1f2328"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {appearanceTab === "icon" && (
                    <p className="text-[13px] text-[#6b7280]">Icon picker coming soon.</p>
                  )}
                </div>
              )}

              {/* Base guide section */}
              <button
                onClick={() => setExpandedSection(expandedSection === "guide" ? null : "guide")}
                className="flex w-full items-center gap-2 border-t border-[#f0f0f0] px-4 py-3 text-[14px] font-medium text-[#1f2328] hover:bg-[#f4f6fb]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d={expandedSection === "guide" ? "M2 4.5L6 8L10 4.5" : "M4.5 2L8 6L4.5 10"} strokeLinejoin="round" />
                </svg>
                Base guide
              </button>
              {expandedSection === "guide" && (
                <div className="border-t border-[#f0f0f0] px-4 py-3 text-[13px] text-[#6b7280]">
                  Base guide coming soon.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: nav tabs — absolutely centered across the full bar */}
      <nav className="absolute inset-x-0 flex items-end justify-center self-stretch" style={{ bottom: 0, top: 0, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }} className="flex h-full items-end">
        {[
          { label: "Data", active: true },
          { label: "Automations", active: false },
          { label: "Interfaces", active: false },
          { label: "Forms", active: false },
        ].map(({ label, active }) => (
          <a
            key={label}
            className="relative flex h-full items-center"
          >
            <p className={`px-3 py-2 text-[13px] font-semibold transition-colors ${
              active ? "text-[#1f2328]" : "text-[#6b7280] hover:text-[#1f2328]"
            }`}>
              {label}
            </p>
            <div
              className="absolute left-0 right-0 transition-all duration-150"
              style={{ bottom: -1, height: active ? 2 : 0, backgroundColor: "#20a6b5" }}
            />
          </a>
        ))}
        </div>
      </nav>

      {/* Right: action buttons — pushed to the right */}
      <div className="ml-auto flex items-center gap-1.5">
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
        <button
          className="rounded px-3 py-1.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: baseColor }}
        >
          Share
        </button>
      </div>
      </div>
    </header>
  );
}
