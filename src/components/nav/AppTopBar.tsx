"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";

import { signOutAction } from "~/app/actions";

type AppTopBarProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  collapsed: boolean;
  sidebarWidth: number;
  onToggleSidebar: () => void;
};

export function AppTopBar({
  user,
  collapsed: _collapsed,
  sidebarWidth,
  onToggleSidebar,
}: AppTopBarProps) {
  const initial =
    user?.name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "A";

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <header className="relative flex h-14 items-center border-b border-[#e4e7ec] bg-white">
      <div
        className="flex items-center gap-3 pl-4 pr-3"
        style={{ width: sidebarWidth }}
      >
        <button
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent hover:border-[#dfe3ea]"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          <MenuIcon />
        </button>
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Airtable_Logo.svg.png"
            alt="Airtable"
            className="h-7 w-auto object-contain"
          />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3 px-4 text-sm text-[#4c5667]">
        <button className="flex items-center gap-2 rounded-full px-3 py-1 text-[#4c5667] transition hover:bg-[#f4f6fb] hover:text-[#111322]">
          <HelpIcon />
          Help
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e0e3ea] text-[#4c5667] transition hover:border-[#c7ccd8]">
          <BellIcon />
        </button>

        {/* Profile button + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden focus:outline-none"
            aria-label="Profile menu"
          >
            {user?.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "Profile"}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e01e5a] text-xs font-semibold text-white">
                {initial}
              </div>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-[#e4e7ec] bg-white py-2 shadow-lg">
              {/* User info */}
              <div className="border-b border-[#e4e7ec] px-4 pb-3 pt-2">
                {user?.name && (
                  <p className="text-sm font-semibold text-[#1f2328]">{user.name}</p>
                )}
                {user?.email && (
                  <p className="text-xs text-[#6a7385]">{user.email}</p>
                )}
              </div>

              {/* Menu items */}
              <div className="border-b border-[#e4e7ec] py-1">
                <MenuItem label="Account" />
                <MenuItem label="Notification preferences" />
                <MenuItem label="Language preferences" />
                <MenuItem label="Appearance" badge="Beta" />
              </div>

              <div className="border-b border-[#e4e7ec] py-1">
                <MenuItem label="Upgrade" />
              </div>

              <div className="py-1">
                <button
                  onClick={() => signOutAction()}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#1f2328] hover:bg-[#f4f6fb]"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full border border-[#dfe3ea] bg-white px-3 py-1.5 text-xs text-[#5f6c7b] shadow-sm">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm text-[#1f2328] outline-none placeholder:text-[#9aa4b6]"
          />
          <kbd className="rounded border border-[#dfe3ea] bg-[#f5f7fa] px-1.5 py-0.5 text-[10px] text-[#5f6c7b]">
            ctrl K
          </kbd>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ label, badge }: { label: string; badge?: string }) {
  return (
    <button className="flex w-full items-center justify-between px-4 py-2 text-sm text-[#1f2328] hover:bg-[#f4f6fb]">
      {label}
      {badge && (
        <span className="rounded-full bg-[#f0f4ff] px-2 py-0.5 text-[10px] font-medium text-[#3b5bdb]">
          {badge}
        </span>
      )}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-[#7b869b]"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m15 15-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="9"
        cy="9"
        r="4.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-[#4c5667]"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8.5 8.2a2 2 0 1 1 3.1 1.7c-.6.37-1 1-.9 1.7v.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.2" r=".7" fill="currentColor" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
    >
      <path
        d="M5 8.5A5 5 0 0 1 10 3a5 5 0 0 1 5 5.5c0 3 1 4 1 4H4s1-1 1-4Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16a2 2 0 0 0 4 0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 4h10M3 8h10M3 12h10"
        stroke="#1f2328"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
