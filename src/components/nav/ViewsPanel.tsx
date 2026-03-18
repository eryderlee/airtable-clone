"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { InlineEdit } from "~/components/ui/InlineEdit";
import { api } from "~/trpc/react";

interface ViewsPanelProps {
  tableId: string;
  activeViewId: string;
}

export function ViewsPanel({ tableId, activeViewId }: ViewsPanelProps) {
  const router = useRouter();
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;
  const [search, setSearch] = useState("");

  const { data: views } = api.view.getByTableId.useQuery({ tableId });
  const utils = api.useUtils();

  const createView = api.view.create.useMutation({
    onSuccess: async (newView) => {
      await utils.view.getByTableId.invalidate({ tableId });
      router.push(`/base/${baseId}/${tableId}/view/${newView.id}`);
    },
  });

  const renameView = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.getByTableId.invalidate({ tableId });
    },
  });

  const deleteView = api.view.delete.useMutation({
    onSuccess: async (deleted) => {
      await utils.view.getByTableId.invalidate({ tableId });
      if (deleted.id === activeViewId) {
        const remaining = await utils.view.getByTableId.fetch({ tableId });
        if (remaining.length > 0 && remaining[0]) {
          router.push(`/base/${baseId}/${tableId}/view/${remaining[0].id}`);
        }
      }
    },
  });

  const filtered = views?.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="flex w-[275px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e2e0ea] bg-white">
      {/* Create new */}
      <button
        onClick={() => createView.mutate({ tableId, name: `Grid view ${(views?.length ?? 0) + 1}` })}
        disabled={createView.isPending}
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#4c5667] hover:bg-[#eceff4] disabled:opacity-40"
        data-testid="create-view-button"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Create new...
      </button>

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
            return (
              <div
                key={view.id}
                className={`group flex items-center gap-2 px-3 py-[7px] transition-colors ${
                  isActive ? "bg-[#e8ebf2]" : "hover:bg-[#f4f5f7]"
                }`}
              >
                {/* Grid icon — clicking navigates */}
                <Link
                  href={`/base/${baseId}/${tableId}/view/${view.id}`}
                  style={{ textDecoration: "none" }}
                  tabIndex={-1}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                    <rect x="1" y="1" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="8" y="1" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="1" y="8" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                    <rect x="8" y="8" width="5" height="5" rx="0.75" fill={isActive ? "#2563eb" : "#7f879b"} />
                  </svg>
                </Link>

                {/* Name — single-click navigates (via surrounding link), double-click renames */}
                <Link
                  href={`/base/${baseId}/${tableId}/view/${view.id}`}
                  style={{ textDecoration: "none" }}
                  className="min-w-0 flex-1"
                >
                  <InlineEdit
                    value={view.name}
                    onSave={(name) => renameView.mutate({ id: view.id, name })}
                    className={`w-full truncate text-[13px] ${isActive ? "font-medium text-[#1f2328]" : "text-[#4c5667]"}`}
                  />
                </Link>

                {/* Delete button — only visible on hover, hidden when last view */}
                {(views?.length ?? 0) > 1 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (window.confirm("Delete this view?")) {
                        deleteView.mutate({ id: view.id });
                      }
                    }}
                    disabled={deleteView.isPending}
                    className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[#dde1ea] group-hover:opacity-100 disabled:cursor-not-allowed"
                    title="Delete view"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="#7f879b" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
