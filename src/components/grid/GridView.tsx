"use client";

import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useCallback } from "react";

import { api } from "~/trpc/react";
import { GridTable, type RowData } from "./GridTable";
import { GridToolbar } from "./GridToolbar";

interface GridViewProps {
  tableId: string;
  viewId: string;
}

export function GridView({ tableId, viewId }: GridViewProps) {
  const utils = api.useUtils();

  const { data: columnsData } = api.column.getByTableId.useQuery({ tableId });

  const {
    data: rowsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = api.row.getRows.useInfiniteQuery(
    { tableId, viewId, limit: 100 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    },
  );

  const flatRows = useMemo(
    () => rowsData?.pages.flatMap((page) => page.items) ?? [],
    [rowsData],
  );

  const columnDefs = useMemo<ColumnDef<RowData>[]>(() => {
    if (!columnsData) return [];
    return columnsData.map((col) => ({
      id: col.id,
      header: col.name,
      accessorFn: (row: RowData) => row.cells[col.id] ?? null,
      meta: { type: col.type, columnId: col.id },
    }));
  }, [columnsData]);

  // Column mutations
  const createColumn = api.column.create.useMutation({
    onSuccess: () => {
      void utils.column.getByTableId.invalidate({ tableId });
    },
  });

  const renameColumn = api.column.update.useMutation({
    onSuccess: () => {
      void utils.column.getByTableId.invalidate({ tableId });
    },
  });

  const deleteColumn = api.column.delete.useMutation({
    onSuccess: () => {
      void utils.column.getByTableId.invalidate({ tableId });
      void utils.row.getRows.invalidate();
    },
  });

  // Bulk create mutation
  const bulkCreate = api.row.bulkCreate.useMutation({
    onSuccess: () => {
      void utils.row.getRows.invalidate();
    },
  });

  // Callback handlers
  const handleAddColumn = useCallback(
    (type: "text" | "number") => {
      const name = type === "text" ? "Text Field" : "Number Field";
      createColumn.mutate({ tableId, name, type });
    },
    [tableId, createColumn],
  );

  const handleRenameColumn = useCallback(
    (columnId: string, name: string) => {
      renameColumn.mutate({ id: columnId, name });
    },
    [renameColumn],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      if (window.confirm("Delete this column? This cannot be undone.")) {
        deleteColumn.mutate({ id: columnId });
      }
    },
    [deleteColumn],
  );

  const handleBulkCreate = useCallback(() => {
    bulkCreate.mutate({ tableId, count: 100000 });
  }, [tableId, bulkCreate]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const { scrollHeight, scrollTop, clientHeight } = target;
      if (
        scrollHeight - scrollTop - clientHeight < 500 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        void fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GridToolbar
        onBulkCreate={handleBulkCreate}
        isBulkCreating={bulkCreate.isPending}
        rowCount={flatRows.length}
      />
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      ) : (
        <GridTable
          rows={flatRows}
          columns={columnDefs}
          onScroll={handleScroll}
          isFetchingNextPage={isFetchingNextPage}
          onRenameColumn={handleRenameColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddColumn={handleAddColumn}
        />
      )}
    </div>
  );
}
