"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useMemo, useCallback, useRef, useReducer, useEffect, useState } from "react";

import { api } from "~/trpc/react";
import { GridTable, type RowData } from "./GridTable";
import { GridToolbar } from "./GridToolbar";
import { ViewsPanel } from "~/components/nav/ViewsPanel";

const PAGE_SIZE = 100;
const ROW_HEIGHT = 32;

interface GridViewProps {
  tableId: string;
  viewId: string;
}

export function GridView({ tableId, viewId }: GridViewProps) {
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

  // Optimistic cell update mutation — directly mutates pageCacheRef for instant feedback
  const updateCell = api.row.update.useMutation({
    onMutate: ({ id, cells }) => {
      for (const [pageIdxStr, pageRows] of Object.entries(pageCacheRef.current)) {
        const rowIdx = pageRows.findIndex((r) => r.id === id);
        if (rowIdx !== -1) {
          const row = pageRows[rowIdx];
          if (!row) continue;
          const prevCells = { ...row.cells };
          const pageIdx = Number(pageIdxStr);
          const pageEntry = pageCacheRef.current[pageIdx];
          const targetRow = pageEntry?.[rowIdx];
          if (targetRow) {
            targetRow.cells = { ...prevCells, ...cells };
            forceUpdate();
            return { pageIdx, rowIdx, prevCells };
          }
        }
      }
    },
    onError: (_err, _vars, context) => {
      if (context) {
        const targetRow = pageCacheRef.current[context.pageIdx]?.[context.rowIdx];
        if (targetRow) {
          targetRow.cells = context.prevCells;
          forceUpdate();
        }
      }
    },
  });

  // Cursor state — not in context, plain useState
  const [cursor, setCursor] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  // Set when a printable character triggers edit mode — passed to GridCell as initialDraft
  const [initialDraft, setInitialDraft] = useState<string | undefined>(undefined);

  // Row selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const handleToggleRow = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    // Collect all loaded row ids from the page cache
    const allIds = Object.values(pageCacheRef.current).flatMap((page) => page.map((r) => r.id));
    setSelectedRowIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  // Ref for the rowVirtualizer — lets GridView call scrollToIndex
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  // Double-rAF: first allows virtualizer to scroll+render, second allows DOM query
  const scrollToCell = useCallback((rowIndex: number, columnId: string) => {
    requestAnimationFrame(() => {
      rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: "auto" });
      requestAnimationFrame(() => {
        const cellEl = document.querySelector<HTMLElement>(
          `[data-row-index="${rowIndex}"][data-column-id="${columnId}"]`,
        );
        cellEl?.focus();
      });
    });
  }, []);

  const handleSelect = useCallback((rowIndex: number, columnId: string) => {
    setCursor({ rowIndex, columnId });
    setEditingCell(null);
    scrollToCell(rowIndex, columnId);
  }, [scrollToCell]);

  const handleStartEditing = useCallback((rowIndex: number, columnId: string) => {
    setEditingCell({ rowIndex, columnId });
  }, []);

  const handleRevert = useCallback(() => {
    setEditingCell(null);
    setInitialDraft(undefined);
  }, []);

  const handleCommit = useCallback((rowId: string, columnId: string, value: string | number | null) => {
    setEditingCell(null);
    setInitialDraft(undefined);
    updateCell.mutate({ id: rowId, cells: { [columnId]: value } });
  }, [updateCell]);

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
    onMutate: ({ id, name, type }) => {
      utils.column.getByTableId.setData({ tableId }, (old) =>
        old?.map((col) =>
          col.id === id
            ? { ...col, name, ...(type ? { type } : {}) }
            : col,
        ),
      );
    },
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
      meta: { type: col.type, columnId: col.id, isPrimary: col.isPrimary },
    }));
  }, [columnsData]);

  const columnIds = useMemo(
    () => columnsData?.map((c) => c.id) ?? [],
    [columnsData],
  );

  const columnWidths = useMemo(
    () => Object.fromEntries((columnsData ?? []).map((c) => [c.id, c.isPrimary ? 200 : 180])),
    [columnsData],
  );

  // Ordered list of column IDs for arrow-key / Tab navigation
  const columnOrder = useMemo(() => {
    if (!columnsData) return [];
    return columnsData.map((col) => col.id);
  }, [columnsData]);

  // Move cursor to a new cell and scroll it into view
  const moveCursor = useCallback((rowIndex: number, columnId: string) => {
    setCursor({ rowIndex, columnId });
    setEditingCell(null);
    setInitialDraft(undefined);
    scrollToCell(rowIndex, columnId);
  }, [scrollToCell]);

  // Container-level keyboard handler — full spreadsheet navigation model
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cursor) return;

    const { rowIndex, columnId } = cursor;
    const colIdx = columnOrder.indexOf(columnId);
    const isEditingNow = editingCell !== null;
    const totalRows = totalCount;

    // --- EDIT MODE ---
    if (isEditingNow) {
      // In edit mode, only intercept Tab — Enter and Escape handled by GridCell input with stopPropagation
      if (e.key === "Tab") {
        e.preventDefault();
        setEditingCell(null);
        setInitialDraft(undefined);

        if (e.shiftKey) {
          if (colIdx > 0) {
            const prevColId = columnOrder[colIdx - 1];
            if (prevColId) moveCursor(rowIndex, prevColId);
          } else if (rowIndex > 0) {
            const lastColId = columnOrder[columnOrder.length - 1];
            if (lastColId) moveCursor(rowIndex - 1, lastColId);
          }
        } else {
          if (colIdx < columnOrder.length - 1) {
            const nextColId = columnOrder[colIdx + 1];
            if (nextColId) moveCursor(rowIndex, nextColId);
          } else if (rowIndex < totalRows - 1) {
            const firstColId = columnOrder[0];
            if (firstColId) moveCursor(rowIndex + 1, firstColId);
          }
        }
      }
      return;
    }

    // --- NAVIGATION MODE ---
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (rowIndex > 0) moveCursor(rowIndex - 1, columnId);
        break;

      case "ArrowDown":
        e.preventDefault();
        if (rowIndex < totalRows - 1) moveCursor(rowIndex + 1, columnId);
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (colIdx > 0) {
          const prevColId = columnOrder[colIdx - 1];
          if (prevColId) moveCursor(rowIndex, prevColId);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (colIdx < columnOrder.length - 1) {
          const nextColId = columnOrder[colIdx + 1];
          if (nextColId) moveCursor(rowIndex, nextColId);
        }
        break;

      case "Enter":
        e.preventDefault();
        setEditingCell({ rowIndex, columnId });
        setInitialDraft(undefined);
        break;

      case "Escape":
        e.preventDefault();
        setCursor(null);
        break;

      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (colIdx > 0) {
            const prevColId = columnOrder[colIdx - 1];
            if (prevColId) moveCursor(rowIndex, prevColId);
          } else if (rowIndex > 0) {
            const lastColId = columnOrder[columnOrder.length - 1];
            if (lastColId) moveCursor(rowIndex - 1, lastColId);
          }
        } else {
          if (colIdx < columnOrder.length - 1) {
            const nextColId = columnOrder[colIdx + 1];
            if (nextColId) moveCursor(rowIndex, nextColId);
          } else if (rowIndex < totalRows - 1) {
            const firstColId = columnOrder[0];
            if (firstColId) moveCursor(rowIndex + 1, firstColId);
          }
        }
        break;

      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setEditingCell({ rowIndex, columnId });
          setInitialDraft(e.key);
        }
        break;
    }
  }, [cursor, editingCell, columnOrder, totalCount, moveCursor]);

  const isInitialLoading = !columnsData || countData === undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GridToolbar
        onBulkCreate={handleBulkCreate}
        isBulkCreating={bulkCreate.isPending}
        rowCount={totalCount}
      />
      <div className="flex flex-1 overflow-hidden">
        <ViewsPanel tableId={tableId} activeViewId={viewId} />
      {isInitialLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#aaa]">Loading...</p>
        </div>
      ) : (
        <GridTable
          totalCount={totalCount}
          getRow={getRow}
          columnIds={columnIds}
          columnWidths={columnWidths}
          columns={columnDefs}
          onScroll={handleScroll}
          isBulkCreating={bulkCreate.isPending}
          onRenameColumn={handleRenameColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddColumn={handleAddColumn}
          displayCount={displayCount}
          cursor={cursor}
          editingCell={editingCell}
          onSelect={handleSelect}
          onStartEditing={handleStartEditing}
          onCommit={handleCommit}
          onRevert={handleRevert}
          onKeyDown={handleKeyDown}
          initialDraft={initialDraft}
          rowVirtualizerRef={rowVirtualizerRef}
          selectedRowIds={selectedRowIds}
          onToggleRow={handleToggleRow}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
        />
      )}
      </div>
    </div>
  );
}
