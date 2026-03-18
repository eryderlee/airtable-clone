"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useMemo, useCallback, useRef, useReducer, useEffect, useState } from "react";

import { api } from "~/trpc/react";
import { GridTable, type RowData, COLUMN_VIRTUALIZATION_THRESHOLD } from "./GridTable";
import { GridToolbar } from "./GridToolbar";
import { ViewsPanel } from "~/components/nav/ViewsPanel";
import type { FilterCondition, SortCondition } from "~/server/api/routers/row";

const PAGE_SIZE = 100;
const ROW_HEIGHT = 32;

interface GridViewProps {
  tableId: string;
  viewId: string;
  initialConfig?: {
    filters: unknown[];
    sorts: unknown[];
    hiddenColumns: string[];
    searchQuery: string;
  };
}

export function GridView({ tableId, viewId, initialConfig }: GridViewProps) {
  const utils = api.useUtils();

  // Column definitions
  const { data: columnsData } = api.column.getByTableId.useQuery({ tableId });

  // Page cache — refs so reads/writes don't trigger re-renders
  const pageCacheRef = useRef<Record<number, RowData[]>>({});
  const loadingPagesRef = useRef<Set<number>>(new Set());

  // Single dispatch to force a re-render after cache updates; cacheVersion used by searchMatches memo
  const [cacheVersion, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Cursor state — not in context, plain useState
  const [cursor, setCursor] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  // Set when a printable character triggers edit mode — passed to GridCell as initialDraft
  const [initialDraft, setInitialDraft] = useState<string | undefined>(undefined);

  // Row selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Toolbar state — declared before useQuery so count query can close over them
  // Seeded from SSR-fetched initialConfig; searchInput/searchQuery always start empty (ephemeral)
  const [filters, setFilters] = useState<FilterCondition[]>(
    (initialConfig?.filters as FilterCondition[]) ?? [],
  );
  const [sorts, setSorts] = useState<SortCondition[]>(
    (initialConfig?.sorts as SortCondition[]) ?? [],
  );
  const [searchInput, setSearchInput] = useState(""); // immediate UI value — never persisted
  const [searchQuery, setSearchQuery] = useState(""); // debounced, sent to DB — never persisted
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(
    initialConfig?.hiddenColumns ?? [],
  );
  const [openPanel, setOpenPanel] = useState<"search" | "filter" | "sort" | "hideFields" | null>(null);
  const [viewsPanelOpen, setViewsPanelOpen] = useState(true);
  const [viewsPanelHover, setViewsPanelHover] = useState(false);
  const showViewsPanel = viewsPanelOpen || viewsPanelHover;
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startHoverClose() {
    hoverCloseTimer.current = setTimeout(() => setViewsPanelHover(false), 100);
  }
  function cancelHoverClose() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
  }

  // 300ms debounce: searchInput -> searchQuery
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Total row count — drives virtualizer size; reflects filtered count when filters active
  const { data: countData, refetch: refetchCount } = api.row.count.useQuery(
    { tableId, filters },
    { staleTime: 30_000 },
  );
  const totalCount = countData?.count ?? 0;

  // View config auto-save mutation — fire and forget, no optimistic update needed
  const updateViewConfig = api.view.updateConfig.useMutation();

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

  const handleToggleRow = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(async () => {
    const loadedIds = Object.values(pageCacheRef.current).flatMap((p) => p.map((r) => r.id));
    const allSelected = loadedIds.length > 0 && loadedIds.every((id) => selectedRowIds.has(id));
    if (allSelected) {
      setSelectedRowIds(new Set());
    } else {
      const allIds = await utils.row.getAllIds.fetch({ tableId });
      setSelectedRowIds(new Set(allIds));
    }
  }, [tableId, utils.row.getAllIds, selectedRowIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  // Refs for virtualizers — lets GridView call scrollToIndex / scrollToCell
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const columnVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  // ---------------------------------------------------------------------------
  // Column/row definitions — placed here so scrollToCell can reference them
  // ---------------------------------------------------------------------------

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

  // Visible column IDs — excludes hidden columns; used for rendering and keyboard nav
  const visibleColumnIds = useMemo(
    () => columnIds.filter((id) => !hiddenColumns.includes(id)),
    [columnIds, hiddenColumns],
  );

  // Ordered list of visible column IDs for arrow-key / Tab navigation
  const columnOrder = visibleColumnIds;

  // Column virtualization is active when visible column count meets the threshold
  const shouldVirtualizeColumns = visibleColumnIds.length >= COLUMN_VIRTUALIZATION_THRESHOLD;

  // Double-rAF: first allows virtualizer to scroll+render, second allows DOM query
  const scrollToCell = useCallback((rowIndex: number, columnId: string) => {
    const colIndex = visibleColumnIds.indexOf(columnId);
    requestAnimationFrame(() => {
      rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: "auto" });
      if (colIndex >= 0 && shouldVirtualizeColumns) {
        columnVirtualizerRef.current?.scrollToIndex(colIndex, { align: "auto" });
      }
      requestAnimationFrame(() => {
        const cellEl = document.querySelector<HTMLElement>(
          `[data-row-index="${rowIndex}"][data-column-id="${columnId}"]`,
        );
        cellEl?.focus();
      });
    });
  }, [visibleColumnIds, shouldVirtualizeColumns]);

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
          filters,
          sorts,
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
    [tableId, utils.row.getByOffset, filters, sorts],
  );

  // Reset page cache — clears all cached pages and loading state
  const resetCache = useCallback(() => {
    pageCacheRef.current = {};
    loadingPagesRef.current = new Set();
    forceUpdate();
  }, []);

  // Track first render to skip cache reset on mount
  const isFirstRender = useRef(true);

  // Reset cache and reload when filter/sort changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    resetCache();
    void refetchCount();
    // fetchPage(0) will be triggered by the existing totalCount effect
  }, [filters, sorts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate ref to guard auto-save — prevents saving on initial mount (SSR-seeded values already correct in DB)
  const isFirstConfigRender = useRef(true);

  // Auto-save filters/sorts/hiddenColumns to DB after 800ms debounce
  // searchInput/searchQuery are intentionally excluded — search is ephemeral (Phase 6 decision)
  useEffect(() => {
    if (isFirstConfigRender.current) {
      isFirstConfigRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      updateViewConfig.mutate({
        id: viewId,
        config: { filters, sorts, hiddenColumns },
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [filters, sorts, hiddenColumns]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Clear cache first, then refresh count; React 18 batches the totalCount
      // update with forceUpdate so the [totalCount, fetchPage] effect fires once
      // with both an empty cache and the new count — fetchPage(0) then runs cleanly.
      pageCacheRef.current = {};
      loadingPagesRef.current = new Set();
      await refetchCount();
      forceUpdate();
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

  const handleBulkAddColumns = useCallback(() => {
    for (let i = 1; i <= 20; i++) {
      createColumn.mutate({ tableId, name: `Col ${i}`, type: i % 3 === 0 ? "number" : "text" });
    }
  }, [tableId, createColumn]);

  // Toggle panel — clicking the same button again closes the panel
  const handleTogglePanel = useCallback((panel: "search" | "filter" | "sort" | "hideFields") => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }, []);

  // Click-outside-to-close: close panel when clicking outside [data-toolbar-panel]
  useEffect(() => {
    if (!openPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      // If click is inside any element with data-toolbar-panel, keep panel open
      if (target.closest("[data-toolbar-panel]")) return;
      setOpenPanel(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [openPanel]);

  // --- Client-side search highlighting ---
  const [searchMatchIndex, setSearchMatchIndex] = useState(-1);

  // Compute matches from loaded page cache (client-side only, no server round-trip)
  const searchMatches = useMemo((): { rowIndex: number; columnId: string }[] => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const matches: { rowIndex: number; columnId: string }[] = [];
    for (const [pageIdxStr, pageRows] of Object.entries(pageCacheRef.current)) {
      const pageIdx = Number(pageIdxStr);
      pageRows.forEach((row, i) => {
        const rowIndex = pageIdx * PAGE_SIZE + i;
        for (const colId of visibleColumnIds) {
          const val = row?.cells[colId];
          if (val != null && String(val).toLowerCase().includes(q)) {
            matches.push({ rowIndex, columnId: colId });
            break; // one match per row
          }
        }
      });
    }
    return matches.sort((a, b) => a.rowIndex - b.rowIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, cacheVersion, visibleColumnIds]); // cacheVersion forces recompute when pages load into cache

  // Reset match index when search query changes
  useEffect(() => {
    setSearchMatchIndex(-1);
  }, [searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (searchMatchIndex >= 0 && searchMatches[searchMatchIndex]) {
      const match = searchMatches[searchMatchIndex];
      if (match) scrollToCell(match.rowIndex, match.columnId);
    }
  }, [searchMatchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setSearchMatchIndex((prev) => (prev <= 0 ? searchMatches.length - 1 : prev - 1));
  }, [searchMatches.length]);

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setSearchMatchIndex((prev) => (prev >= searchMatches.length - 1 ? 0 : prev + 1));
  }, [searchMatches.length]);

  // Simplified columns for toolbar pickers
  const columnsForToolbar = useMemo(
    () => (columnsData ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type, isPrimary: c.isPrimary })),
    [columnsData],
  );

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
        onToggleViewsPanel={() => setViewsPanelOpen((v) => !v)}
        viewsPanelOpen={viewsPanelOpen}
        onHamburgerMouseEnter={() => { cancelHoverClose(); if (!viewsPanelOpen) setViewsPanelHover(true); }}
        onHamburgerMouseLeave={() => { if (!viewsPanelOpen) startHoverClose(); }}
        onBulkCreate={handleBulkCreate}
        isBulkCreating={bulkCreate.isPending}
        onBulkAddColumns={handleBulkAddColumns}
        rowCount={totalCount}
        openPanel={openPanel}
        onTogglePanel={handleTogglePanel}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={setSorts}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={setHiddenColumns}
        columnsData={columnsForToolbar}
        matchCount={searchMatches.length}
        currentMatchIndex={searchMatchIndex}
        onPrevMatch={handlePrevMatch}
        onNextMatch={handleNextMatch}
        hasActiveSearch={searchInput.trim().length > 0}
      />
      <div className="flex flex-1 overflow-hidden">
        <div
          onMouseEnter={() => { cancelHoverClose(); if (!viewsPanelOpen) setViewsPanelHover(true); }}
          onMouseLeave={() => { if (!viewsPanelOpen) startHoverClose(); }}
          style={{
            width: showViewsPanel ? 275 : 0,
            flexShrink: 0,
            overflow: "hidden",
            transition: "width 200ms ease",
          }}
        >
          <ViewsPanel tableId={tableId} activeViewId={viewId} />
        </div>
      {isInitialLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#aaa]">Loading...</p>
        </div>
      ) : (
        <GridTable
          getRow={getRow}
          columnIds={visibleColumnIds}
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
          columnVirtualizerRef={columnVirtualizerRef}
          selectedRowIds={selectedRowIds}
          onToggleRow={handleToggleRow}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          allSelected={totalCount > 0 && selectedRowIds.size === totalCount}
          searchQuery={searchQuery}
          currentSearchMatch={searchMatches[searchMatchIndex] ?? null}
        />
      )}
      </div>
    </div>
  );
}
