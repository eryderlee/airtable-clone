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
    <aside className="flex w-48 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Views
        </span>
        <button
          onClick={handleCreateView}
          disabled={createView.isPending}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
          title="Create new view"
        >
          <span className="text-sm leading-none">+</span>
        </button>
      </div>

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
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-xs">&#9776;</span>
                <span className="truncate">{view.name}</span>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
