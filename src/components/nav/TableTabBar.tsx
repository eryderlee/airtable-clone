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
    <header
      className="flex h-[40px] flex-shrink-0 items-end gap-0 overflow-x-auto px-2"
      style={{
        backgroundColor: "#f2efff",
        borderBottom: "1px solid #d0c9e8",
      }}
    >
      {!tables || tables.length === 0 ? (
        <span className="mb-[10px] text-sm text-gray-400">No tables</span>
      ) : (
        tables.map((table) => {
          const isActive = activeTableId === table.id;
          return (
            <div
              key={table.id}
              className="relative flex flex-shrink-0 items-center"
              style={{
                height: "32px",
                marginBottom: "-1px",
                borderTopLeftRadius: "4px",
                borderTopRightRadius: "4px",
                backgroundColor: isActive ? "#ffffff" : "transparent",
                borderTop: isActive ? "2px solid #166ee1" : "2px solid transparent",
                borderLeft: isActive ? "1px solid #d0c9e8" : "none",
                borderRight: isActive ? "1px solid #d0c9e8" : "none",
                borderBottom: isActive ? "1px solid #ffffff" : "none",
                paddingLeft: "12px",
                paddingRight: hoveredId === table.id ? "4px" : "12px",
              }}
              onMouseEnter={() => setHoveredId(table.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link
                href={`/base/${baseId}/${table.id}`}
                className="flex items-center gap-1"
                style={{ textDecoration: "none" }}
              >
                <InlineEdit
                  value={table.name}
                  onSave={(name) =>
                    renameTable.mutate({ id: table.id, name })
                  }
                  className={`whitespace-nowrap text-[13px] ${
                    isActive
                      ? "font-medium text-gray-900"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                />
              </Link>
              {hoveredId === table.id && tables.length > 1 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteTable(table.id);
                  }}
                  className="ml-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-500"
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
        className="mb-1 ml-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-black/10 hover:text-gray-700 disabled:opacity-40"
        title="Create new table"
      >
        <span className="text-base leading-none">+</span>
      </button>
    </header>
  );
}
