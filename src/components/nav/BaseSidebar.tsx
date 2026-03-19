"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

import { signOutAction } from "~/app/actions";

type BaseSidebarProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export function BaseSidebar({ user }: BaseSidebarProps) {
  const router = useRouter();
  const initial =
    user?.name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "A";

  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  return (
    <aside className="flex h-full w-[56px] flex-shrink-0 flex-col items-center border-r border-[#e4e7ec] bg-white py-2">
      {/* Logo at top */}
      <button
        onClick={() => router.push("/")}
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#f3f4f6]"
        title="Home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/airtable-black.svg"
          alt="Airtable"
          className="h-6 w-6 object-contain"
        />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom icons: help, bell, profile */}
      <div className="flex flex-col items-center gap-2">
        {/* Help */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1f2328]"
          title="Help"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8.5 8.2a2 2 0 1 1 3.1 1.7c-.6.37-1 1-.9 1.7v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="10" cy="14.2" r=".7" fill="currentColor" />
          </svg>
        </button>

        {/* Bell */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1f2328]"
          title="Notifications"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M5 8.5A5 5 0 0 1 10 3a5 5 0 0 1 5 5.5c0 3 1 4 1 4H4s1-1 1-4Z" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 16a2 2 0 0 0 4 0" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden focus:outline-none"
            aria-label="Profile menu"
          >
            {user?.image ? (
              <Image src={user.image} alt={user.name ?? "Profile"} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e01e5a] text-xs font-semibold text-white">
                {initial}
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute bottom-10 left-10 z-50 w-56 rounded-xl border border-[#e4e7ec] bg-white py-2 shadow-lg">
              <div className="border-b border-[#e4e7ec] px-4 pb-3 pt-2">
                {user?.name && <p className="text-sm font-semibold text-[#1f2328]">{user.name}</p>}
                {user?.email && <p className="text-xs text-[#6a7385]">{user.email}</p>}
              </div>
              <div className="py-1">
                <button onClick={() => signOutAction()} className="flex w-full items-center px-4 py-2 text-sm text-[#1f2328] hover:bg-[#f4f6fb]">
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
