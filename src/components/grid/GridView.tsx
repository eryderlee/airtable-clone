"use client";

import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useCallback } from "react";

import { api } from "~/trpc/react";
import { GridTable, type RowData } from "./GridTable";

interface GridViewProps {
  tableId: string;
  viewId: string;
}

export function GridView({ tableId, viewId }: GridViewProps) {
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <GridTable
      rows={flatRows}
      columns={columnDefs}
      onScroll={handleScroll}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
}
