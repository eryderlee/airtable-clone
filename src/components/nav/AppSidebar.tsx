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
    <aside
      className="flex w-[264px] flex-shrink-0 flex-col overflow-hidden"
      style={{ backgroundColor: "#2d1f4e" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <span className="text-sm font-semibold text-white">Airtable Clone</span>
        <button
          onClick={handleCreateBase}
          disabled={createBase.isPending}
          className="flex h-6 w-6 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          title="Create new base"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      {/* Base list */}
      <div className="flex flex-1 flex-col overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-white/40">Loading...</div>
        ) : !bases || bases.length === 0 ? (
          <div className="px-4 py-2 text-sm text-white/40">No bases yet</div>
        ) : (
          bases.map((base) => {
            const isActive = pathname.startsWith(`/base/${base.id}`);
            return (
              <div
                key={base.id}
                className="group relative flex items-center"
                style={{
                  backgroundColor: isActive
                    ? "rgba(255,255,255,0.15)"
                    : undefined,
                }}
                onMouseEnter={() => setHoveredId(base.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  className="flex flex-1 items-center gap-2 px-4 py-[7px] text-left transition-colors hover:bg-white/[0.07]"
                  onClick={() => router.push(`/base/${base.id}`)}
                >
                  {/* Base icon — colored square */}
                  <span
                    className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-[10px] font-bold"
                    style={{ backgroundColor: "#4a9eff", color: "#fff" }}
                  >
                    {base.name.charAt(0).toUpperCase()}
                  </span>
                  <InlineEdit
                    value={base.name}
                    onSave={(name) => renameBase.mutate({ id: base.id, name })}
                    className={`flex-1 truncate text-[13px] ${
                      isActive ? "font-medium text-white" : "text-white/80"
                    }`}
                  />
                </button>
                {hoveredId === base.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBase(base.id);
                    }}
                    className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white/40 transition-colors hover:bg-red-500/30 hover:text-red-300"
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
