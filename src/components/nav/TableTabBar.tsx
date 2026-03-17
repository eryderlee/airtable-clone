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

  const { data: tables } = api.table.getByBaseId.useQuery({ baseId });
  const utils = api.useUtils();

  const createTable = api.table.create.useMutation({
    onSuccess: async (newTable) => {
      await utils.table.getByBaseId.invalidate({ baseId });
      const views = await utils.view.getByTableId.fetch({ tableId: newTable.id });
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

  return (
    <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-[#e4e7ec] bg-white px-2">
      {/* Tabs + actions */}
      <div className="flex flex-1 items-end overflow-hidden">
        {tables?.map((table) => {
          const isActive = activeTableId === table.id;
          return (
            <TableTab
              key={table.id}
              table={table}
              isActive={isActive}
              baseId={baseId}
              onRename={(name) => renameTable.mutate({ id: table.id, name })}
              onDelete={() => {
                if (window.confirm("Delete this table?")) deleteTable.mutate({ id: table.id });
              }}
              showDelete={(tables?.length ?? 0) > 1}
            />
          );
        })}

        <button
          onClick={() => createTable.mutate({ baseId, seed: true })}
          disabled={createTable.isPending}
          className="ml-1 flex items-center gap-1 rounded border border-transparent px-3 py-1 text-[13px] text-[#4c5667] hover:border-[#dfe3ea] disabled:opacity-40"
          data-testid="add-or-import-button"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Add or import
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#6b7280]">
            <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Tools */}
      <button
        className="ml-3 flex items-center gap-1 rounded border border-transparent px-3 py-1 text-[13px] text-[#4c5667] hover:border-[#dfe3ea]"
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
  baseId,
  onRename,
  onDelete,
  showDelete,
}: {
  table: { id: string; name: string };
  isActive: boolean;
  baseId: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  showDelete: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`mb-[-1px] mr-1 flex h-8 flex-shrink-0 cursor-pointer items-center gap-1 rounded-t-lg border px-3 transition-colors ${
        isActive ? "border-[#dfe3ea] bg-white text-[#1f2328]" : "border-transparent bg-[#f4f5f7] text-[#4c5667]"
      }`}
      style={{
        borderBottomColor: isActive ? "#ffffff" : "transparent",
      }}
    >
      <Link
        href={`/base/${baseId}/${table.id}`}
        style={{ textDecoration: "none" }}
        className="flex items-center gap-1"
      >
        <InlineEdit
          value={table.name}
          onSave={onRename}
          className={`whitespace-nowrap text-[13px] ${
            isActive ? "font-medium text-[#1f2328]" : "text-[#4c5667] hover:text-[#1f2328]"
          }`}
        />
        {/* Dropdown arrow — shown always on active, on hover otherwise */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={isActive || hovered ? "text-[#6b7280]" : "text-transparent"}
        >
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      {hovered && showDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="flex h-4 w-4 items-center justify-center rounded text-[#9e9e9e] hover:bg-red-100 hover:text-red-500"
        >
          <span className="text-xs leading-none">&times;</span>
        </button>
      )}
    </div>
  );
}
