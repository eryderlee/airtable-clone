"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

import { InlineEdit } from "~/components/ui/InlineEdit";
import { api } from "~/trpc/react";

interface ViewsPanelProps {
  tableId: string;
  activeViewId: string;
}

const VIEW_TYPES = [
  {
    type: "grid",
    label: "Grid",
    color: "#2563eb",
    functional: true,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" fill={color} />
        <rect x="9" y="1" width="6" height="6" rx="1" fill={color} />
        <rect x="1" y="9" width="6" height="6" rx="1" fill={color} />
        <rect x="9" y="9" width="6" height="6" rx="1" fill={color} />
      </svg>
    ),
  },
  {
    type: "calendar",
    label: "Calendar",
    color: "#e8384f",
    functional: false,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke={color} strokeWidth="1.3" />
        <path d="M1.5 6.5h13" stroke={color} strokeWidth="1.3" />
        <path d="M5 1.5v3M11 1.5v3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="4" y="8.5" width="2.5" height="2" rx="0.5" fill={color} />
        <rect x="8" y="8.5" width="2.5" height="2" rx="0.5" fill={color} />
      </svg>
    ),
  },
  {
    type: "gallery",
    label: "Gallery",
    color: "#9333ea",
    functional: false,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="8" rx="1" fill={color} />
        <rect x="9" y="1" width="6" height="8" rx="1" fill={color} />
        <rect x="1" y="11" width="6" height="4" rx="1" fill={color} />
        <rect x="9" y="11" width="6" height="4" rx="1" fill={color} />
      </svg>
    ),
  },
  {
    type: "kanban",
    label: "Kanban",
    color: "#0d9488",
    functional: false,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="4" height="10" rx="1" fill={color} />
        <rect x="6" y="1" width="4" height="7" rx="1" fill={color} />
        <rect x="11" y="1" width="4" height="13" rx="1" fill={color} />
      </svg>
    ),
  },
  {
    type: "timeline",
    label: "Timeline",
    color: "#f59e0b",
    functional: false,
    team: true,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="8" height="3" rx="1" fill={color} />
        <rect x="5" y="7.5" width="10" height="3" rx="1" fill={color} />
        <rect x="2" y="12" width="6" height="3" rx="1" fill={color} />
      </svg>
    ),
  },
  {
    type: "list",
    label: "List",
    color: "#64748b",
    functional: false,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2.5" width="14" height="3" rx="1" fill={color} />
        <rect x="1" y="7" width="14" height="3" rx="1" fill={color} />
        <rect x="1" y="11.5" width="14" height="3" rx="1" fill={color} />
      </svg>
    ),
  },
  {
    type: "gantt",
    label: "Gantt",
    color: "#16a34a",
    functional: false,
    team: true,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3.5h12M2 8h12M2 12.5h12" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" />
        <rect x="1" y="2" width="7" height="2.5" rx="0.75" fill={color} />
        <rect x="5" y="6.5" width="9" height="2.5" rx="0.75" fill={color} />
        <rect x="3" y="11" width="5" height="2.5" rx="0.75" fill={color} />
      </svg>
    ),
  },
  {
    type: "form",
    label: "Form",
    color: "#db2777",
    functional: false,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke={color} strokeWidth="1.3" />
        <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "section",
    label: "Section",
    color: "#64748b",
    functional: false,
    team: true,
    icon: (color: string) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="4" rx="1" fill={color} />
        <rect x="1" y="6.5" width="14" height="3" rx="1" fill={color} opacity="0.5" />
        <rect x="1" y="11" width="14" height="3" rx="1" fill={color} opacity="0.3" />
      </svg>
    ),
  },
];

export function ViewsPanel({ tableId, activeViewId }: ViewsPanelProps) {
  const router = useRouter();
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;
  const [search, setSearch] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null);
  const [openMenuViewId, setOpenMenuViewId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleClick(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCreateMenu]);

  const { data: views } = api.view.getByTableId.useQuery({ tableId });
  const utils = api.useUtils();

  const createView = api.view.create.useMutation({
    onMutate: async ({ tableId: mutTableId, name }) => {
      await utils.view.getByTableId.cancel({ tableId: mutTableId });
      const previous = utils.view.getByTableId.getData({ tableId: mutTableId });
      const optimisticId = `optimistic-${Date.now()}`;
      utils.view.getByTableId.setData({ tableId: mutTableId }, (old) => [
        ...(old ?? []),
        {
          id: optimisticId,
          name,
          tableId: mutTableId,
          config: { filters: [], sorts: [], hiddenColumns: [], searchQuery: "" },
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: async (newView) => {
      router.push(`/base/${baseId}/${tableId}/view/${newView.id}`);
    },
    onError: (_err, { tableId: mutTableId }, context) => {
      if (context?.previous !== undefined) {
        utils.view.getByTableId.setData({ tableId: mutTableId }, context.previous);
      }
      toast.error("Failed to create view. Changes reverted.");
    },
    onSettled: (_data, _err, { tableId: mutTableId }) => {
      void utils.view.getByTableId.invalidate({ tableId: mutTableId });
    },
  });

  const renameView = api.view.update.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.view.getByTableId.cancel({ tableId });
      const previous = utils.view.getByTableId.getData({ tableId });
      utils.view.getByTableId.setData({ tableId }, (old) =>
        old?.map((v) => (v.id === id ? { ...v, name: name ?? v.name } : v)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.view.getByTableId.setData({ tableId }, context.previous);
      }
      toast.error("Failed to rename view. Changes reverted.");
    },
    onSettled: () => {
      void utils.view.getByTableId.invalidate({ tableId });
    },
  });

  const deleteView = api.view.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.view.getByTableId.cancel({ tableId });
      const previous = utils.view.getByTableId.getData({ tableId });
      utils.view.getByTableId.setData({ tableId }, (old) =>
        old?.filter((v) => v.id !== id) ?? [],
      );
      return { previous };
    },
    onSuccess: async (deleted) => {
      if (deleted.id === activeViewId) {
        const remaining = utils.view.getByTableId.getData({ tableId });
        if (remaining && remaining.length > 0 && remaining[0]) {
          router.push(`/base/${baseId}/${tableId}/view/${remaining[0].id}`);
        }
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.view.getByTableId.setData({ tableId }, context.previous);
      }
      toast.error("Failed to delete view. Changes reverted.");
    },
    onSettled: () => {
      void utils.view.getByTableId.invalidate({ tableId });
    },
  });

  const filtered = views?.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="relative flex h-full w-[275px] flex-shrink-0 flex-col border-r border-[#e2e0ea] bg-white">
      {/* Create new */}
      <button
        onClick={(e) => { setCreateMenuAnchor(e.currentTarget); setShowCreateMenu((v) => !v); }}
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#4c5667] hover:bg-[#eceff4]"
        data-testid="create-view-button"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Create new...
      </button>

      {/* Create view type menu */}
      {showCreateMenu && (() => {
        const rect = createMenuAnchor?.getBoundingClientRect();
        return (
        <div
          ref={createMenuRef}
          style={{ position: "fixed", top: rect?.top ?? 0, left: (rect?.right ?? 0) + 4, zIndex: 1000 }}
          className="w-[220px] rounded-lg border border-[#e2e0ea] bg-white py-2 shadow-xl"
        >
          <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#9aa4b6]">View type</p>
          {VIEW_TYPES.map((vt) => (
            <button
              key={vt.type}
              onClick={() => {
                if (!vt.functional) return;
                createView.mutate({ tableId, name: `Grid view ${(views?.length ?? 0) + 1}` });
                setShowCreateMenu(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#1f2328] hover:bg-[#f4f6fb] ${!vt.functional ? "cursor-default" : ""}`}
            >
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {vt.icon(vt.color)}
              </span>
              <span className="flex-1 text-left">{vt.label}</span>
              {vt.team && (
                <span className="flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-medium text-[#0284c7]">
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1a2 2 0 1 1 0 4A2 2 0 0 1 5 1zM1.5 9c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Team
                </span>
              )}
            </button>
          ))}
        </div>
        );
      })()}


      {/* Find a view */}
      <div className="flex items-center gap-2 px-3 py-[7px] text-[#7f879b]">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
          <circle cx="5.5" cy="5.5" r="3.75" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 9l-1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Find a view"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-[#4c5667] outline-none placeholder:text-[#7f879b]"
        />
      </div>

      {/* View list */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {!filtered || filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">No views</div>
        ) : (
          filtered.map((view) => {
            const isActive = view.id === activeViewId;
            const isRenaming = renamingViewId === view.id;
            const menuOpen = openMenuViewId === view.id;
            return (
              <div
                key={view.id}
                className={`group relative flex items-center gap-2 px-3 py-[7px] transition-colors ${
                  isActive ? "bg-[#e8ebf2]" : "hover:bg-[#f4f5f7]"
                }`}
                onMouseEnter={() => {
                  void utils.column.getByTableId.prefetch({ tableId });
                  void utils.row.count.prefetch({ tableId, filters: [], searchQuery: "" });
                }}
              >
                {/* Grid icon */}
                <Link href={`/base/${baseId}/${tableId}/view/${view.id}`} style={{ textDecoration: "none" }} tabIndex={-1}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                    <rect x="1" y="1" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="8" y="1" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="1" y="8" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="8" y="8" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                  </svg>
                </Link>

                {/* Name */}
                <Link
                  href={`/base/${baseId}/${tableId}/view/${view.id}`}
                  style={{ textDecoration: "none" }}
                  className="min-w-0 flex-1"
                  onDoubleClick={(e) => { e.preventDefault(); setRenamingViewId(view.id); }}
                >
                  <InlineEdit
                    value={view.name}
                    onSave={(name) => { renameView.mutate({ id: view.id, name }); setRenamingViewId(null); }}
                    editing={isRenaming}
                    onEditingChange={(v) => { if (!v) setRenamingViewId(null); }}
                    className={`w-full truncate text-[13px] ${isActive ? "font-medium text-[#1f2328]" : "text-[#4c5667]"}`}
                  />
                </Link>

                {/* Three dots + expand — visible on hover */}
                <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuViewId(menuOpen ? null : view.id); setMenuAnchor(e.currentTarget); }}
                    className="flex h-5 w-5 items-center justify-center rounded text-[#7f879b] hover:bg-[#dde1ea]"
                    title="View options"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <circle cx="2" cy="6" r="1.2" />
                      <circle cx="6" cy="6" r="1.2" />
                      <circle cx="10" cy="6" r="1.2" />
                    </svg>
                  </button>
                  <button className="flex h-5 w-5 items-center justify-center rounded text-[#7f879b] hover:bg-[#dde1ea]" title="Drag">
                    <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                      <circle cx="3" cy="2.5" r="1.1" />
                      <circle cx="7" cy="2.5" r="1.1" />
                      <circle cx="3" cy="6" r="1.1" />
                      <circle cx="7" cy="6" r="1.1" />
                      <circle cx="3" cy="9.5" r="1.1" />
                      <circle cx="7" cy="9.5" r="1.1" />
                    </svg>
                  </button>
                </div>

                {/* Options dropdown */}
                {menuOpen && (
                  <ViewOptionsMenu
                    canDelete={(views?.length ?? 0) > 1}
                    anchorEl={menuAnchor}
                    onClose={() => setOpenMenuViewId(null)}
                    onRename={() => { setOpenMenuViewId(null); setRenamingViewId(view.id); }}
                    onDelete={() => { setOpenMenuViewId(null); deleteView.mutate({ id: view.id }); }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ViewOptionsMenu({ canDelete, onClose, onRename, onDelete, anchorEl }: {
  canDelete: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  anchorEl: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = anchorEl?.getBoundingClientRect();
  const top = rect?.top ?? 0;
  const left = (rect?.right ?? 0) + 4;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, zIndex: 1000 }}
      className="w-[220px] overflow-hidden rounded-lg border border-[#e2e0ea] bg-white py-1 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Add to favourites */}
      <button className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#1f2328] hover:bg-[#f4f6fb]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M7 1.5l1.6 3.3 3.7.5-2.7 2.6.6 3.7L7 9.8l-3.2 1.8.6-3.7L1.7 5.3l3.7-.5L7 1.5z" strokeLinejoin="round" />
        </svg>
        <span className="flex-1 text-left">Add to &apos;My favorites&apos;</span>
        <span className="flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-medium text-[#0284c7]">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 1a2 2 0 1 1 0 4A2 2 0 0 1 5 1zM1.5 9c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Team
        </span>
      </button>

      <div className="my-1 h-px bg-[#f0f0f0]" />

      <button
        onClick={onRename}
        className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#1f2328] hover:bg-[#f4f6fb]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2.5l2 2L5 11H3v-2l6.5-6.5z" />
        </svg>
        Rename view
      </button>

      <button className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#1f2328] hover:bg-[#f4f6fb]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <path d="M3 10V3h7" />
        </svg>
        Duplicate view
      </button>

      {canDelete && (
        <>
          <div className="my-1 h-px bg-[#f0f0f0]" />
          <button
            onClick={onDelete}
            className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#e8384f] hover:bg-[#fff5f5]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 7.5h6L11 4" />
            </svg>
            Delete view
          </button>
        </>
      )}
    </div>
  );
}
