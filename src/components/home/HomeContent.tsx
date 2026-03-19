"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react";

type BaseRecord = {
  id: string;
  name: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  lastOpenedAt: Date | string | null;
  color: string | null;
  userId: string;
};

type Props = {
  bases: BaseRecord[];
};

export function HomeContent({ bases: initialBases }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const router = useRouter();
  const utils = api.useUtils();

  // Seed the React Query cache with SSR data so optimistic updates work
  const { data: bases = initialBases } = api.base.getAll.useQuery(undefined, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    initialData: initialBases as unknown as any,
  });

  const createBase = api.base.create.useMutation({
    onMutate: async ({ name }) => {
      await utils.base.getAll.cancel();
      const previous = utils.base.getAll.getData();
      utils.base.getAll.setData(undefined, (old) => [
        ...(old ?? []),
        {
          id: `optimistic-${Date.now()}`,
          name,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastOpenedAt: new Date(),
          color: null,
          userId: "",
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.base.getAll.setData(undefined, context.previous);
      }
      toast.error("Failed to create base. Changes reverted.");
    },
    onSettled: () => {
      void utils.base.getAll.invalidate();
    },
  });

  const renameBase = api.base.update.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.base.getAll.cancel();
      const previous = utils.base.getAll.getData();
      utils.base.getAll.setData(undefined, (old) =>
        old?.map((b) => (b.id === id ? { ...b, name: name ?? b.name } : b)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.base.getAll.setData(undefined, context.previous);
      }
      toast.error("Failed to rename base. Changes reverted.");
    },
    onSettled: () => {
      void utils.base.getAll.invalidate();
    },
  });

  const deleteBase = api.base.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.base.getAll.cancel();
      const previous = utils.base.getAll.getData();
      utils.base.getAll.setData(undefined, (old) =>
        old?.filter((b) => b.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.base.getAll.setData(undefined, context.previous);
      }
      toast.error("Failed to delete base. Changes reverted.");
    },
    onSettled: () => {
      void utils.base.getAll.invalidate();
    },
  });

  const handleCreateBase = () => {
    createBase.mutate({ name: "Untitled base" });
  };

  const handleBaseClick = async (baseId: string) => {
    // Try cached data first for instant navigation
    const tables = utils.table.getByBaseId.getData({ baseId });
    if (tables && tables.length > 0) {
      const firstTable = tables[0];
      if (firstTable) {
        const views = utils.view.getByTableId.getData({ tableId: firstTable.id });
        if (views && views.length > 0 && views[0]) {
          router.push(`/base/${baseId}/${firstTable.id}/view/${views[0].id}`);
          return;
        }
      }
    }
    // Cold path — navigate immediately, fetch in background
    // The base layout will SSR-redirect to the correct table/view once data arrives
    router.push(`/base/${baseId}`);
    void (async () => {
      try {
        const fetchedTables = await utils.table.getByBaseId.fetch({ baseId });
        if (fetchedTables.length > 0 && fetchedTables[0]) {
          const fetchedViews = await utils.view.getByTableId.fetch({ tableId: fetchedTables[0].id });
          if (fetchedViews.length > 0 && fetchedViews[0]) {
            router.push(`/base/${baseId}/${fetchedTables[0].id}/view/${fetchedViews[0].id}`);
          }
        }
      } catch {
        // SSR redirect already handled navigation
      }
    })();
  };

  const sorted = [...bases].sort((a, b) => {
    const aTime = new Date(
      a.lastOpenedAt ?? a.updatedAt ?? a.createdAt ?? Date.now(),
    ).getTime();
    const bTime = new Date(
      b.lastOpenedAt ?? b.updatedAt ?? b.createdAt ?? Date.now(),
    ).getTime();
    return bTime - aTime;
  });
  const { today, earlier } = groupBasesByRecency(sorted);

  return (
    <div className="flex min-h-full flex-col bg-[#f7f8fa] text-[#1f2328]">
      <main className="flex w-full flex-1 flex-col gap-8 px-12 pb-16 pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[1.5rem] font-bold tracking-tight">Home</h1>
            <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-transparent px-0 py-1 text-sm text-[#6a7385] transition hover:text-[#1f2328]">
              Opened anytime <ChevronDownIcon />
            </button>
          </div>
          <div className="flex items-center gap-2 text-[#6a7385]">
            <ViewIconButton
              label="List view"
              active={viewMode === "list"}
              icon={<ListIcon />}
              onClick={() => setViewMode("list")}
            />
            <ViewIconButton
              label="Grid view"
              active={viewMode === "grid"}
              icon={<GridIcon />}
              onClick={() => setViewMode("grid")}
            />
          </div>
        </header>

        {bases.length === 0 ? (
          <EmptyState onCreateBase={handleCreateBase} />
        ) : (
          <section>
            {viewMode === "list" && (
              <div className="mb-1 grid border-b border-[#e4e7ec] pb-2 text-xs text-[#6a7385] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <span>Name</span>
                <span>Last opened</span>
                <span>Workspace</span>
              </div>
            )}
            <div className={`${viewMode === "grid" ? "space-y-10" : "space-y-0"}`}>
              {today.length > 0 && (
                <BaseSection
                  title="Today"
                  bases={today}
                  viewMode={viewMode}
                  onRename={(id, name) => renameBase.mutate({ id, name })}
                  onDelete={(id) => deleteBase.mutate({ id })}
                  onBaseClick={handleBaseClick}
                />
              )}
              {earlier.length > 0 && (
                <BaseSection
                  title="Earlier"
                  bases={earlier}
                  viewMode={viewMode}
                  onRename={(id, name) => renameBase.mutate({ id, name })}
                  onDelete={(id) => deleteBase.mutate({ id })}
                  onBaseClick={handleBaseClick}
                />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function BaseSection({
  title,
  bases,
  viewMode,
  onRename,
  onDelete,
  onBaseClick,
}: {
  title: string;
  bases: BaseRecord[];
  viewMode: "grid" | "list";
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onBaseClick: (id: string) => void;
}) {
  return (
    <div className={`${viewMode === "grid" ? "space-y-3" : ""}`}>
      {viewMode === "grid" ? (
        <>
          <h2 className="text-xs font-medium tracking-wide text-[#6a7385]">
            {title}
          </h2>
          <div className="mt-1 flex flex-wrap gap-4">
            {bases.map((base) => (
              <BaseGridCard
                key={base.id}
                base={base}
                onRename={onRename}
                onDelete={onDelete}
                onBaseClick={onBaseClick}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="px-2 pt-4 pb-1 text-xs text-[#98a1b3]">{title}</div>
          <div>
            {bases.map((base) => (
              <BaseListRow key={base.id} base={base} onBaseClick={onBaseClick} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BaseGridCard({
  base,
  onRename,
  onDelete,
  onBaseClick,
}: {
  base: BaseRecord;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onBaseClick: (id: string) => void;
}) {
  const color = colorFromString(base.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [starred, setStarred] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(base.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== base.name) onRename(base.id, trimmed);
    setRenaming(false);
  }

  return (
    <div className="group relative flex h-24 w-[290px] items-center gap-3 rounded-[0.4rem] border-[1.5px] border-[#d9dadb] bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-[#cad1e0] hover:shadow-[0_4px_12px_rgba(15,23,42,0.1)]">
      <button
        onClick={() => onBaseClick(base.id)}
        className="flex flex-1 items-center gap-5 overflow-hidden text-left"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] text-[20px] font-normal text-white"
          style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,0.15)" }}
        >
          {base.name.slice(0, 2)}
        </div>
        <div className="flex min-w-0 flex-col">
          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full truncate rounded border-2 border-[#1c64e4] bg-white px-1 text-[13px] font-semibold text-[#1f2328] outline-none"
            />
          ) : (
            <span className="truncate text-[13px] font-semibold text-[#1f2328]">
              {base.name}
            </span>
          )}
          <div className="relative h-[18px]">
            <span className="truncate text-[12px] text-[#6a7385] transition-opacity group-hover:opacity-0">
              Opened{" "}
              {formatRelativeTime(
                base.lastOpenedAt ?? base.updatedAt ?? base.createdAt,
              )}
            </span>
            <span className="absolute left-0 top-0 flex items-center gap-1 text-[12px] text-[#6a7385] opacity-0 transition-opacity group-hover:opacity-100">
              <DataIcon />
              Open data
            </span>
          </div>
        </div>
      </button>

      {/* Hover action buttons */}
      <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
        <button
          onClick={(e) => {
            e.preventDefault();
            setStarred((v) => !v);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#f0f2f7]"
          aria-label="Star"
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 ${starred ? "fill-yellow-400 stroke-yellow-400" : "fill-none stroke-[#6a7385]"}`}
            strokeWidth="1.3"
          >
            <path
              d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.4l-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5Z"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#f0f2f7]"
            aria-label="More options"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-[#6a7385]">
              <circle cx="3" cy="8" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="13" cy="8" r="1.2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-[#e4e7ec] bg-white py-1 shadow-lg">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setRenaming(true);
                  setRenameValue(base.name);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#1f2328] hover:bg-[#f4f6fb]"
              >
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  if (confirm(`Delete "${base.name}"?`)) onDelete(base.id);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-[#f4f6fb]"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function BaseListRow({
  base,
  onBaseClick,
}: {
  base: BaseRecord;
  onBaseClick: (id: string) => void;
}) {
  const color = colorFromString(base.id);
  return (
    <button
      onClick={() => onBaseClick(base.id)}
      className="grid w-full gap-4 rounded-xl px-2 py-3 text-left text-sm text-[#1f2328] hover:bg-white md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <span className="flex items-center gap-2 font-normal">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[11px] font-normal text-white"
          style={{ backgroundColor: color }}
        >
          {base.name.slice(0, 2)}
        </span>
        {base.name}
      </span>
      <span className="text-[#6a7385]">
        Opened{" "}
        {formatRelativeTime(
          base.lastOpenedAt ?? base.updatedAt ?? base.createdAt,
        )}
      </span>
      <span className="text-[#6a7385]">Workspace</span>
    </button>
  );
}

function ViewIconButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm ${
        active
          ? "border-[#d1d7e5] bg-white text-[#1f2328]"
          : "border-transparent text-[#6a7385] hover:border-[#e2e7f0]"
      }`}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function EmptyState({ onCreateBase }: { onCreateBase: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#c5ccda] bg-white/50 px-8 py-12 text-center">
      <h2 className="text-xl font-semibold text-[#1f2328]">
        Start building with Airtable
      </h2>
      <p className="mt-2 text-sm text-[#6a7385]">
        Create a base to organize your work or import an existing spreadsheet.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onCreateBase}
          className="rounded-full bg-[#1c64e4] px-6 py-2 text-sm font-medium text-white hover:bg-[#154dbc]"
        >
          Create base
        </button>
        <button className="rounded-full border border-[#dfe3ea] px-6 py-2 text-sm font-medium text-[#1f2328] hover:border-[#c8cedd]">
          Import data
        </button>
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function groupBasesByRecency(bases: BaseRecord[]) {
  const now = Date.now();
  const today: BaseRecord[] = [];
  const earlier: BaseRecord[] = [];

  bases.forEach((base) => {
    const updatedAt = new Date(
      base.lastOpenedAt ?? base.updatedAt ?? base.createdAt ?? Date.now(),
    );
    const diff = now - updatedAt.getTime();
    if (diff <= 1000 * 60 * 60 * 24) {
      today.push(base);
    } else {
      earlier.push(base);
    }
  });

  return { today, earlier };
}

function formatRelativeTime(date: Date | string | null) {
  if (!date) return "recently";
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - target.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes || 1} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function colorFromString(input: string) {
  const colors = ["#1283DA", "#20A6A4", "#D4135B", "#7C39ED", "#F0A000"];
  const index =
    input
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M7 6h9M7 10h9M7 14h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6" r="0.8" fill="currentColor" />
      <circle cx="4" cy="10" r="0.8" fill="currentColor" />
      <circle cx="4" cy="14" r="0.8" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect
        x="3"
        y="3"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="11"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="11"
        y="3"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="11"
        y="11"
        width="6"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <ellipse
        cx="10"
        cy="5.5"
        rx="5"
        ry="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 5.5v7c0 1.38 2.24 2.5 5 2.5s5-1.12 5-2.5v-7"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
