"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { api } from "~/trpc/react";

interface ViewsPanelProps {
  tableId: string;
  activeViewId: string;
}

export function ViewsPanel({ tableId, activeViewId }: ViewsPanelProps) {
  const router = useRouter();
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;

  const { data: views } = api.view.getByTableId.useQuery({ tableId });
  const utils = api.useUtils();

  const createView = api.view.create.useMutation({
    onSuccess: async (newView) => {
      await utils.view.getByTableId.invalidate({ tableId });
      router.push(`/base/${baseId}/${tableId}/view/${newView.id}`);
    },
  });

  function handleCreateView() {
    const viewCount = views?.length ?? 0;
    createView.mutate({ tableId, name: `Grid View ${viewCount + 1}` });
  }

  return (
    <aside
      className="flex w-[200px] flex-shrink-0 flex-col overflow-hidden"
      style={{
        backgroundColor: "#f9f8fc",
        borderRight: "1px solid #e2e0ea",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid #e2e0ea" }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Views
        </span>
        <button
          onClick={handleCreateView}
          disabled={createView.isPending}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40"
          title="Create new view"
        >
          <span className="text-sm leading-none">+</span>
        </button>
      </div>

      {/* View list */}
      <div className="flex flex-1 flex-col overflow-y-auto py-1">
        {!views || views.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">No views</div>
        ) : (
          views.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <Link
                key={view.id}
                href={`/base/${baseId}/${tableId}/view/${view.id}`}
                className="flex items-center gap-2 px-3 py-[6px] transition-colors"
                style={{
                  backgroundColor: isActive ? "#e8e4f5" : undefined,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "#f0eef8";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                {/* Grid icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="flex-shrink-0"
                >
                  <rect
                    x="0.5"
                    y="0.5"
                    width="4"
                    height="4"
                    rx="0.5"
                    fill={isActive ? "#5c47a8" : "#888"}
                  />
                  <rect
                    x="7.5"
                    y="0.5"
                    width="4"
                    height="4"
                    rx="0.5"
                    fill={isActive ? "#5c47a8" : "#888"}
                  />
                  <rect
                    x="0.5"
                    y="7.5"
                    width="4"
                    height="4"
                    rx="0.5"
                    fill={isActive ? "#5c47a8" : "#888"}
                  />
                  <rect
                    x="7.5"
                    y="7.5"
                    width="4"
                    height="4"
                    rx="0.5"
                    fill={isActive ? "#5c47a8" : "#888"}
                  />
                </svg>
                <span
                  className={`truncate text-[13px] ${
                    isActive
                      ? "font-medium text-[#5c47a8]"
                      : "text-gray-700"
                  }`}
                >
                  {view.name}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
