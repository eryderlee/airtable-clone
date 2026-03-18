"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams, usePathname } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { useBaseColor } from "./BaseColorContext";

function getBaseColor(color: string | null | undefined, id: string): string {
  if (color) return color;
  const colors = ["#4aa4ff", "#f97316", "#22c55e", "#a855f7", "#ec4899"];
  const index =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index] ?? "#4aa4ff";
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function lightTint(hex: string, amount = 0.85): string {
  const rgb = hexToRgb(hex);
  // If the color is already light (luminance > 0.75), return it directly
  if (luminance(rgb) > 0.75) return hex;
  const tr = Math.round(rgb.r + (255 - rgb.r) * amount);
  const tg = Math.round(rgb.g + (255 - rgb.g) * amount);
  const tb = Math.round(rgb.b + (255 - rgb.b) * amount);
  return `rgb(${tr}, ${tg}, ${tb})`;
}

interface TableTabBarProps {
  baseId: string;
  initialColor?: string | null;
  initialName?: string | null;
}

export function TableTabBar({ baseId, initialColor, initialName }: TableTabBarProps) {
  const router = useRouter();
  const params = useParams<{ tableId?: string }>();
  const activeTableId = params.tableId;
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  useEffect(() => { setNavigatingTo(null); }, [pathname]);

  const { data: base } = api.base.getById.useQuery({ id: baseId }, { staleTime: Infinity });
  const { data: tables } = api.table.getByBaseId.useQuery({ baseId });
  const { liveColor } = useBaseColor();
  const bgColor = lightTint(getBaseColor(liveColor ?? base?.color ?? initialColor, baseId));
  const utils = api.useUtils();

  const createTable = api.table.create.useMutation({
    onMutate: async ({ baseId: mutBaseId }) => {
      await utils.table.getByBaseId.cancel({ baseId: mutBaseId });
      const previous = utils.table.getByBaseId.getData({ baseId: mutBaseId });
      const optimisticId = `optimistic-${Date.now()}`;
      utils.table.getByBaseId.setData({ baseId: mutBaseId }, (old) => [
        ...(old ?? []),
        {
          id: optimisticId,
          name: `Table ${(old?.length ?? 0) + 1}`,
          baseId: mutBaseId,
          createdAt: new Date(),
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: async (newTable) => {
      const fetchedViews = await utils.view.getByTableId.fetch({ tableId: newTable.id });
      if (fetchedViews[0]) {
        router.push(`/base/${baseId}/${newTable.id}/view/${fetchedViews[0].id}`);
      } else {
        router.push(`/base/${baseId}/${newTable.id}`);
      }
    },
    onError: (_err, { baseId: mutBaseId }, context) => {
      if (context?.previous !== undefined) {
        utils.table.getByBaseId.setData({ baseId: mutBaseId }, context.previous);
      }
      toast.error("Failed to create table. Changes reverted.");
    },
    onSettled: (_data, _err, { baseId: mutBaseId }) => {
      void utils.table.getByBaseId.invalidate({ baseId: mutBaseId });
    },
  });

  const renameTable = api.table.update.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.table.getByBaseId.cancel({ baseId });
      const previous = utils.table.getByBaseId.getData({ baseId });
      utils.table.getByBaseId.setData({ baseId }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, name: name ?? t.name } : t)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.table.getByBaseId.setData({ baseId }, context.previous);
      }
      toast.error("Failed to rename table. Changes reverted.");
    },
    onSettled: () => {
      void utils.table.getByBaseId.invalidate({ baseId });
    },
  });

  const deleteTable = api.table.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.table.getByBaseId.cancel({ baseId });
      const previous = utils.table.getByBaseId.getData({ baseId });
      utils.table.getByBaseId.setData({ baseId }, (old) =>
        old?.filter((t) => t.id !== id) ?? [],
      );
      return { previous };
    },
    onSuccess: async (_data, { id }) => {
      if (id !== activeTableId) return;
      const remaining = utils.table.getByBaseId.getData({ baseId });
      if (remaining && remaining.length > 0 && remaining[0]) {
        const views = await utils.view.getByTableId.fetch({ tableId: remaining[0].id });
        if (views[0]) {
          router.push(`/base/${baseId}/${remaining[0].id}/view/${views[0].id}`);
        } else {
          router.push(`/base/${baseId}/${remaining[0].id}`);
        }
      } else {
        router.push(`/base/${baseId}`);
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.table.getByBaseId.setData({ baseId }, context.previous);
      }
      toast.error("Failed to delete table. Changes reverted.");
    },
    onSettled: () => {
      void utils.table.getByBaseId.invalidate({ baseId });
    },
  });

  const handleTabHover = (tableId: string) => {
    void utils.column.getByTableId.prefetch({ tableId });
    void utils.view.getByTableId.prefetch({ tableId });
    void utils.row.count.prefetch({ tableId, filters: [] });
  };

  return (
    <div className="relative flex h-[30px] flex-shrink-0 items-stretch justify-between" style={{ backgroundColor: bgColor, borderBottom: "1px solid #dfe3ea", overflow: "visible" }}>
      {/* Tabs + actions */}
      <div className="flex flex-1 items-stretch" style={{ overflow: "visible" }}>
        {tables?.map((table, index) => {
          const isActive = activeTableId === table.id;
          const nextActive = index < tables.length - 1 && activeTableId === tables[index + 1]?.id;
          return (
            <TableTab
              key={table.id}
              table={table}
              isActive={isActive}
              isFirst={index === 0}
              baseId={baseId}
              bgColor={bgColor}
              isPending={table.id.startsWith("optimistic-")}
              isNavigating={navigatingTo === table.id}
              onNavigate={() => setNavigatingTo(table.id)}
              onHover={() => handleTabHover(table.id)}
              onRename={(name) => renameTable.mutate({ id: table.id, name })}
              onDelete={() => deleteTable.mutate({ id: table.id })}
              showDelete={(tables?.length ?? 0) > 1}
              showRightDivider={!isActive && !nextActive}
            />
          );
        })}

        {/* Chevron after last tab */}
        <button className="flex items-center self-center px-1.5 text-[#4c5667] opacity-70 hover:opacity-100">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Divider */}
        <div className="mx-1 self-center h-3 w-px bg-[#4c5667] opacity-30" />

        {/* Add or import */}
        <button
          onClick={() => createTable.mutate({ baseId, seed: true })}
          disabled={createTable.isPending}
          className="flex items-center gap-1 self-center px-2 py-1 text-[13px] text-[#4c5667] hover:text-[#1f2328] disabled:opacity-40"
          data-testid="add-or-import-button"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Add or import
        </button>
      </div>

      {/* Tools */}
      <button
        className="mb-1 ml-3 mr-2 flex flex-shrink-0 items-center gap-1 rounded border border-transparent px-3 py-1 text-[13px] text-[#4c5667] hover:border-[#dfe3ea]"
        data-testid="tools-button"
      >
        Tools
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#6b7280]">
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function TableTab({
  table,
  isActive,
  isFirst,
  baseId,
  bgColor,
  isPending,
  isNavigating,
  onNavigate,
  onHover,
  onRename,
  onDelete,
  showDelete,
  showRightDivider,
}: {
  table: { id: string; name: string };
  isActive: boolean;
  isFirst: boolean;
  baseId: string;
  bgColor: string;
  isPending?: boolean;
  isNavigating?: boolean;
  onNavigate: () => void;
  onHover: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  showDelete: boolean;
  showRightDivider?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      {renameOpen && (
        <TableRenameModal
          name={table.name}
          onSave={(name) => { onRename(name); setRenameOpen(false); }}
          onCancel={() => setRenameOpen(false)}
        />
      )}
    <div
      onMouseEnter={() => { setHovered(true); onHover(); }}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => { e.preventDefault(); setRenameOpen(true); }}
      className={`relative flex flex-shrink-0 ${(isPending ?? isNavigating) ? "cursor-wait" : "cursor-pointer"} items-center gap-1 px-3 transition-colors ${
        isFirst ? "rounded-tr-md" : "rounded-t-md"
      } ${
        isActive
          ? "border-r border-t border-[#dfe3ea] bg-white text-[#1f2328]"
          : "h-[22px] self-center border border-transparent text-[#4c5667]"
      } ${isActive && !isFirst ? "border-l" : ""}`}
      style={{
        marginBottom: isActive ? "-1px" : "0",
        marginTop: isActive && isFirst ? "-2px" : undefined,
        zIndex: menuOpen ? 10 : isActive ? 2 : 0,
        backgroundColor: isActive ? undefined : bgColor,
      }}
    >
      {showRightDivider && (
        <div className="absolute right-0 top-1/2 h-3 w-px -translate-y-1/2 bg-[#4c5667] opacity-30" />
      )}
      {isPending ? (
        <span className="pointer-events-none cursor-wait opacity-60 whitespace-nowrap text-[13px] text-[#4c5667]">
          {table.name}
        </span>
      ) : (
        <Link
          href={`/base/${baseId}/${table.id}`}
          style={{ textDecoration: "none" }}
          className="flex items-center gap-1"
          onClick={onNavigate}
        >
          <span className={`whitespace-nowrap text-[13px] ${isActive ? "font-medium text-[#1f2328]" : "text-[#4c5667] hover:text-[#1f2328]"}`}>
            {table.name}
          </span>
        </Link>
      )}

      {/* Chevron — opens dropdown */}
      {(isActive || hovered) && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="flex h-4 w-4 items-center justify-center rounded text-[#6b7280] hover:bg-[#e8eaed]"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-50 mt-1 w-[240px] overflow-hidden rounded-lg border border-[#e2e0ea] bg-white py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={<ImportIcon />} label="Import data" chevron disabled />
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <MenuItem icon={<RenameIcon />} label="Rename table" disabled />
          <MenuItem icon={<HideIcon />} label="Hide table" disabled />
          <MenuItem icon={<FieldsIcon />} label="Manage fields" badge="Team" disabled />
          <MenuItem icon={<DuplicateIcon />} label="Duplicate table" disabled />
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <MenuItem icon={<DepsIcon />} label="Configure date dependencies" badge="Team" disabled />
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <MenuItem icon={<DescriptionIcon />} label="Edit table description" disabled />
          <MenuItem icon={<PermissionsIcon />} label="Edit table permissions" badge="Team" disabled />
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <MenuItem icon={<ClearIcon />} label="Clear data" disabled />
          {showDelete && (
            <MenuItem
              icon={<DeleteIcon />}
              label="Delete table"
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            />
          )}
        </div>
      )}
    </div>
    </>
  );
}

function TableRenameModal({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { const t = draft.trim(); if (t) onSave(t); }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[10004] flex items-start justify-start"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="mt-24 ml-2 w-[299px] rounded-lg border border-[#e2e0ea] bg-white p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Name input */}
        <input
          ref={inputRef}
          aria-label="Table name editor"
          type="text"
          maxLength={255}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mb-3 w-full rounded-md border-2 border-[#1471e8] px-2 py-1.5 text-[15px] outline-none"
        />

        {/* Record terminology row */}
        <div className="mb-2 flex items-center justify-between">
          <h5 className="text-[13px] text-[#666]">What should each record be called?</h5>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#999]">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Record dropdown */}
        <div className="mb-2 flex cursor-pointer items-center justify-between rounded-md bg-[#f5f5f5] px-2 py-1.5">
          <span className="truncate text-[13px] text-[#333]">Record</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-none text-[#666]">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Examples */}
        <div className="mb-4 flex text-[12px] text-[#999]">
          <span className="mr-2 shrink-0">Examples:</span>
          <div className="flex flex-wrap gap-x-3">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              Add record
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.1" /><path d="M4 3V2a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
              Send records
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[13px] text-[#333] hover:bg-[#f0f0f0]"
          >
            Cancel
          </button>
          <button
            onClick={() => { const t = draft.trim(); if (t) onSave(t); }}
            className="rounded-md bg-[#1471e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1260cc]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon, label, disabled, danger, chevron, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  chevron?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition-colors ${
        disabled
          ? "cursor-default text-[#bbb]"
          : danger
          ? "text-[#d32f2f] hover:bg-[#fff5f5]"
          : "text-[#333] hover:bg-[#f5f5f5]"
      }`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${disabled ? "text-[#ccc]" : danger ? "text-[#d32f2f]" : "text-[#666]"}`}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="flex items-center gap-1 rounded-full bg-[#e8f4ff] px-2 py-0.5 text-[11px] text-[#1a73e8]">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
            <path d="M3 5l1.5 1.5L7.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {badge}
        </span>
      )}
      {chevron && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#aaa]">
          <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function ImportIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5v7M4 6l3 3 3-3M2.5 10.5v1.5h9v-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function RenameIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L5 11H3v-2l6.5-6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function HideIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}
function FieldsIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2" width="11" height="2.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" /><rect x="1.5" y="5.75" width="11" height="2.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" /><rect x="1.5" y="9.5" width="11" height="2.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" /></svg>;
}
function DuplicateIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M2.5 9.5V2.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}
function DepsIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="11" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="11" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 7H7l2.5-3M7 7l2.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}
function DescriptionIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" /><path d="M7 6.5v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}
function PermissionsIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}
function ClearIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5.5 4V2.5h3V4M6 6.5v4M8 6.5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.5 4l.5 7.5h6L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
