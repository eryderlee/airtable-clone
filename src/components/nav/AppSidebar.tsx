"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { api } from "~/trpc/react";
import { InlineEdit } from "~/components/ui/InlineEdit";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data: bases, isLoading } = api.base.getAll.useQuery();
  const utils = api.useUtils();

  const createBase = api.base.create.useMutation({
    onSuccess: (newBase) => {
      void utils.base.getAll.invalidate();
      router.push(`/base/${newBase.id}`);
    },
  });

  const renameBase = api.base.update.useMutation({
    onSuccess: () => void utils.base.getAll.invalidate(),
  });

  const deleteBase = api.base.delete.useMutation({
    onSuccess: () => {
      void utils.base.getAll.invalidate();
      router.push("/");
    },
  });

  function handleCreateBase() {
    createBase.mutate({ name: "Untitled Base" });
  }

  function handleDeleteBase(id: string) {
    if (window.confirm("Delete this base?")) {
      deleteBase.mutate({ id });
    }
  }

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">Airtable Clone</span>
        <button
          onClick={handleCreateBase}
          disabled={createBase.isPending}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          title="Create new base"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-gray-400">Loading...</div>
        ) : !bases || bases.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-400">No bases yet</div>
        ) : (
          bases.map((base) => {
            const isActive = pathname.startsWith(`/base/${base.id}`);
            return (
              <div
                key={base.id}
                className={`group relative flex items-center gap-2 px-4 py-1.5 ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onMouseEnter={() => setHoveredId(base.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                  onClick={() => router.push(`/base/${base.id}`)}
                >
                  <span className="text-base">&#9634;</span>
                  <InlineEdit
                    value={base.name}
                    onSave={(name) => renameBase.mutate({ id: base.id, name })}
                    className={`flex-1 truncate text-sm font-medium ${
                      isActive ? "text-blue-700" : "text-gray-700"
                    }`}
                  />
                </button>
                {hoveredId === base.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBase(base.id);
                    }}
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600"
                    title="Delete base"
                  >
                    <span className="text-xs leading-none">&times;</span>
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
