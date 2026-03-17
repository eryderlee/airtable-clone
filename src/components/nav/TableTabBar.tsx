"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

import { api } from "~/trpc/react";
import { InlineEdit } from "~/components/ui/InlineEdit";

interface TableTabBarProps {
  baseId: string;
}

export function TableTabBar({ baseId }: TableTabBarProps) {
  const router = useRouter();
  const params = useParams<{ tableId?: string }>();
  const activeTableId = params.tableId;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data: tables } = api.table.getByBaseId.useQuery({ baseId });
  const utils = api.useUtils();

  const createTable = api.table.create.useMutation({
    onSuccess: async (newTable) => {
      await utils.table.getByBaseId.invalidate({ baseId });
      const views = await utils.view.getByTableId.fetch({
        tableId: newTable.id,
      });
      if (views[0]) {
        router.push(`/base/${baseId}/${newTable.id}/view/${views[0].id}`);
      } else {
        router.push(`/base/${baseId}/${newTable.id}`);
      }
    },
  });

  const renameTable = api.table.update.useMutation({
    onSuccess: () => void utils.table.getByBaseId.invalidate({ baseId }),
  });

  const deleteTable = api.table.delete.useMutation({
    onSuccess: () => {
      void utils.table.getByBaseId.invalidate({ baseId });
      router.push(`/base/${baseId}`);
    },
  });

  function handleCreateTable() {
    createTable.mutate({ baseId, name: "Untitled Table", seed: true });
  }

  function handleDeleteTable(id: string) {
    if (window.confirm("Delete this table?")) {
      deleteTable.mutate({ id });
    }
  }

  return (
    <header className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2">
      {!tables || tables.length === 0 ? (
        <span className="text-sm text-gray-400">No tables</span>
      ) : (
        tables.map((table) => {
          const isActive = activeTableId === table.id;
          return (
            <div
              key={table.id}
              className={`relative flex items-center rounded-t px-3 py-1 text-sm ${
                isActive
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              onMouseEnter={() => setHoveredId(table.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link
                href={`/base/${baseId}/${table.id}`}
                className="flex items-center gap-1"
              >
                <InlineEdit
                  value={table.name}
                  onSave={(name) =>
                    renameTable.mutate({ id: table.id, name })
                  }
                  className={`text-sm ${isActive ? "font-medium text-blue-700" : "text-gray-600"}`}
                />
              </Link>
              {hoveredId === table.id && tables.length > 1 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteTable(table.id);
                  }}
                  className="ml-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600"
                  title="Delete table"
                >
                  <span className="text-xs leading-none">&times;</span>
                </button>
              )}
            </div>
          );
        })
      )}
      <button
        onClick={handleCreateTable}
        disabled={createTable.isPending}
        className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        title="Create new table"
      >
        <span className="text-base leading-none">+</span>
      </button>
    </header>
  );
}
