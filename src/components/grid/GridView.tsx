"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useCallback, useRef, useReducer, useEffect } from "react";

import { api } from "~/trpc/react";
import { GridTable, type RowData } from "./GridTable";
import { GridToolbar } from "./GridToolbar";

const PAGE_SIZE = 100;
const ROW_HEIGHT = 32;

interface GridViewProps {
  tableId: string;
  viewId: string;
}

export function GridView({ tableId, viewId: _viewId }: GridViewProps) {
  const utils = api.useUtils();

  // Column definitions
  const { data: columnsData } = api.column.getByTableId.useQuery({ tableId });

  // Total row count — always on; drives virtualizer size
  const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
    { tableId },
    { staleTime: 30_000 },
  );
  const totalCount = countData?.count ?? 0;

  // Page cache — refs so reads/writes don't trigger re-renders
  const pageCacheRef = useRef<Record<number, RowData[]>>({});
  const loadingPagesRef = useRef<Set<number>>(new Set());

  // Single dispatch to force a re-render after cache updates
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  function getRow(index: number): RowData | undefined {
    const page = Math.floor(index / PAGE_SIZE);
    const indexInPage = index % PAGE_SIZE;
    return pageCacheRef.current[page]?.[indexInPage];
  }

  const fetchPage = useCallback(
    async (pageIndex: number) => {
      if (pageCacheRef.current[pageIndex] !== undefined) return;
      if (loadingPagesRef.current.has(pageIndex)) return;

      loadingPagesRef.current.add(pageIndex);
      forceUpdate(); // re-render to show skeletons

      try {
        const data = await utils.row.getByOffset.fetch({
          tableId,
          offset: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        pageCacheRef.current[pageIndex] = data.items.map((r) => ({
          id: r.id,
          cells: r.cells,
        }));
      } finally {
        loadingPagesRef.current.delete(pageIndex);
        forceUpdate(); // re-render to show real data
      }
    },
    [tableId, utils.row.getByOffset],
  );

  // Load page 0 on mount / when count first resolves
  useEffect(() => {
    if (totalCount > 0) {
      void fetchPage(0);
    }
  }, [totalCount, fetchPage]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight } = e.currentTarget;
      const overscanPx = ROW_HEIGHT * 20; // prefetch 20 rows beyond viewport
      const startRow = Math.max(0, Math.floor((scrollTop - overscanPx) / ROW_HEIGHT));
      const endRow = Math.min(
        totalCount - 1,
        Math.ceil((scrollTop + clientHeight + overscanPx) / ROW_HEIGHT),
      );
      const startPage = Math.floor(startRow / PAGE_SIZE);
      const endPage = Math.floor(endRow / PAGE_SIZE);
      for (let p = startPage; p <= endPage; p++) {
        void fetchPage(p);
      }
    },
    [fetchPage, totalCount],
  );

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
      // Clear cache — cell structure changed
      pageCacheRef.current = {};
      loadingPagesRef.current = new Set();
      void fetchPage(0);
    },
  });

  // Bulk create
  const bulkCreate = api.row.bulkCreate.useMutation({
    onSuccess: async () => {
      // Clear cache and refresh count; page 0 will reload via the useEffect
      pageCacheRef.current = {};
      loadingPagesRef.current = new Set();
      forceUpdate();
      await refetchCount();
    },
  });

  // Poll live count while inserting
  const { data: liveCountData } = api.row.count.useQuery(
    { tableId },
    {
      enabled: bulkCreate.isPending,
      refetchInterval: bulkCreate.isPending ? 800 : false,
    },
  );
  const displayCount = bulkCreate.isPending && liveCountData
    ? liveCountData.count
    : totalCount;

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

  const handleUpdateColumn = useCallback(
    (columnId: string, name: string, type: "text" | "number") => {
      renameColumn.mutate({ id: columnId, name, type });
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

  const columnDefs = useMemo<ColumnDef<RowData>[]>(() => {
    if (!columnsData) return [];
    return columnsData.map((col) => ({
      id: col.id,
      header: col.name,
      accessorFn: (row: RowData) => row.cells[col.id] ?? null,
      meta: { type: col.type, columnId: col.id },
    }));
  }, [columnsData]);

  const columnIds = useMemo(
    () => columnsData?.map((c) => c.id) ?? [],
    [columnsData],
  );

  const isInitialLoading = !columnsData || countData === undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GridToolbar
        onBulkCreate={handleBulkCreate}
        isBulkCreating={bulkCreate.isPending}
        rowCount={totalCount}
      />
      {isInitialLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#aaa]">Loading...</p>
        </div>
      ) : (
        <GridTable
          totalCount={totalCount}
          getRow={getRow}
          columnIds={columnIds}
          columns={columnDefs}
          onScroll={handleScroll}
          isBulkCreating={bulkCreate.isPending}
          onRenameColumn={handleRenameColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddColumn={handleAddColumn}
          displayCount={displayCount}
        />
      )}
    </div>
  );
}
