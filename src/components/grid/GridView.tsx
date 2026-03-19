"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useMemo, useCallback, useRef, useReducer, useEffect, useState } from "react";

import { toast } from "sonner";

import { api } from "~/trpc/react";
import { GridTable, type RowData, COLUMN_VIRTUALIZATION_THRESHOLD } from "./GridTable";
import { GridToolbar } from "./GridToolbar";
import { ViewsPanel } from "~/components/nav/ViewsPanel";
import { ViewConfigFlushProvider, useViewConfigFlush } from "./ViewConfigFlushContext";
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
  return (
    <ViewConfigFlushProvider>
      <GridViewInner tableId={tableId} viewId={viewId} initialConfig={initialConfig} />
    </ViewConfigFlushProvider>
  );
}

function GridViewInner({ tableId, viewId, initialConfig }: GridViewProps) {
  const utils = api.useUtils();

  // Column definitions
  const { data: columnsData, refetch: refetchColumns } = api.column.getByTableId.useQuery({ tableId });

  // Page cache — refs so reads/writes don't trigger re-renders
  const pageCacheRef = useRef<Record<number, RowData[]>>({});
  const loadingPagesRef = useRef<Set<number>>(new Set());
  const cacheGenerationRef = useRef(0);

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

  const deleteRows = api.row.deleteMany.useMutation();

  const handleDeleteSelectedRows = useCallback(async () => {
    if (selectedRowIds.size === 0) return;
    const ids = [...selectedRowIds];

    // Optimistic: rebuild pageCacheRef without the deleted rows
    const allRows = Object.values(pageCacheRef.current)
      .flat()
      .filter((r) => !selectedRowIds.has(r.id));
    pageCacheRef.current = {};
    for (let i = 0; i < allRows.length; i++) {
      const page = Math.floor(i / PAGE_SIZE);
      if (!pageCacheRef.current[page]) pageCacheRef.current[page] = [];
      pageCacheRef.current[page]?.push(allRows[i]);
    }
    setSelectedRowIds(new Set());
    setCursor(null);
    forceUpdate();

    try {
      await deleteRows.mutateAsync({ ids, tableId });
      await utils.row.getByOffset.invalidate({ tableId });
      void refetchCount();
    } catch {
      // On error: clear cache and reload so we don't show stale optimistic state
      pageCacheRef.current = {};
      loadingPagesRef.current = new Set();
      void refetchCount();
      forceUpdate();
    }
  }, [selectedRowIds, deleteRows, tableId, refetchCount, utils.row.getByOffset]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (rowId.startsWith('optimistic-')) return;
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
      const gen = cacheGenerationRef.current;

      try {
        const data = await utils.row.getByOffset.fetch({
          tableId,
          offset: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
          filters,
          sorts,
        });
        // Discard if cache was reset by a newer filter/sort since this fetch started
        if (cacheGenerationRef.current !== gen) return;
        pageCacheRef.current[pageIndex] = data.items.map((r) => ({
          id: r.id,
          cells: r.cells,
        }));
      } finally {
        if (cacheGenerationRef.current === gen) {
          loadingPagesRef.current.delete(pageIndex);
          forceUpdate(); // re-render to show real data
        }
      }
    },
    [tableId, utils.row.getByOffset, filters, sorts],
  );

  // Reset page cache — clears all cached pages and loading state
  const resetCache = useCallback(() => {
    cacheGenerationRef.current += 1;
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
  // Always-current refs so the unmount flush can read latest values without stale closure
  const filtersRef = useRef(filters);
  const sortsRef = useRef(sorts);
  const hiddenColumnsRef = useRef(hiddenColumns);
  const isDirtyRef = useRef(false);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { sortsRef.current = sorts; }, [sorts]);
  useEffect(() => { hiddenColumnsRef.current = hiddenColumns; }, [hiddenColumns]);

  // Auto-save filters/sorts/hiddenColumns to DB after 800ms debounce
  // searchInput/searchQuery are intentionally excluded — search is ephemeral (Phase 6 decision)
  useEffect(() => {
    if (isFirstConfigRender.current) {
      isFirstConfigRender.current = false;
      return;
    }
    isDirtyRef.current = true;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const timer = setTimeout(() => {
      isDirtyRef.current = false;
      updateViewConfig.mutate({
        id: viewId,
        config: { filters, sorts, hiddenColumns: hiddenColumns.filter((id) => uuidRe.test(id)) },
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [filters, sorts, hiddenColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register a flush function with the context so ViewsPanel can await it before navigating
  const { register, unregister } = useViewConfigFlush();
  useEffect(() => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const flushFn = async () => {
      if (!isDirtyRef.current) return;
      isDirtyRef.current = false;
      await updateViewConfig.mutateAsync({
        id: viewId,
        config: {
          filters: filtersRef.current,
          sorts: sortsRef.current,
          hiddenColumns: hiddenColumnsRef.current.filter((id) => uuidRe.test(id)),
        },
      });
    };
    register(flushFn);
    return () => unregister();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    onMutate: async ({ tableId: mutTableId, name, type }) => {
      await utils.column.getByTableId.cancel({ tableId: mutTableId });
      const previous = utils.column.getByTableId.getData({ tableId: mutTableId });
      const optimisticId = `optimistic-${Date.now()}`;
      utils.column.getByTableId.setData({ tableId: mutTableId }, (old) => [
        ...(old ?? []),
        {
          id: optimisticId,
          name,
          type: type ?? "text",
          tableId: mutTableId,
          isPrimary: false,
          order: Math.max(...(old?.map((col) => col.order) ?? []), -1) + 1,
        },
      ]);
      return { previous };
    },
    onError: (_err, { tableId: mutTableId }, context) => {
      if (context?.previous !== undefined) {
        utils.column.getByTableId.setData({ tableId: mutTableId }, context.previous);
      }
      toast.error("Failed to add column. Changes reverted.");
    },
    onSettled: () => {
      void refetchColumns();
    },
  });

  const renameColumn = api.column.update.useMutation({
    onMutate: async ({ id, name, type }) => {
      await utils.column.getByTableId.cancel({ tableId });
      const previous = utils.column.getByTableId.getData({ tableId });
      utils.column.getByTableId.setData({ tableId }, (old) =>
        old?.map((col) =>
          col.id === id
            ? { ...col, name: name ?? col.name, ...(type ? { type } : {}) }
            : col,
        ) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.column.getByTableId.setData({ tableId }, context.previous);
      }
      toast.error("Failed to rename column. Changes reverted.");
    },
    onSettled: () => {
      // Intentionally no invalidate: onMutate already set the correct name;
      // re-fetching causes a flicker as stale cache is briefly shown during revalidation.
    },
  });

  const deleteColumn = api.column.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.column.getByTableId.cancel({ tableId });
      const previous = utils.column.getByTableId.getData({ tableId });
      utils.column.getByTableId.setData({ tableId }, (old) =>
        old?.filter((col) => col.id !== id) ?? [],
      );
      // Also remove the column's cells from all cached rows
      const prevPageCache = { ...pageCacheRef.current };
      for (const key of Object.keys(pageCacheRef.current)) {
        const pageRows = pageCacheRef.current[Number(key)];
        if (pageRows) {
          pageCacheRef.current[Number(key)] = pageRows.map((row) => {
            const remainingCells = Object.fromEntries(
              Object.entries(row.cells).filter(([k]) => k !== id),
            );
            return { ...row, cells: remainingCells };
          });
        }
      }
      forceUpdate();
      return { previous, prevPageCache };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.column.getByTableId.setData({ tableId }, context.previous);
      }
      if (context?.prevPageCache !== undefined) {
        pageCacheRef.current = context.prevPageCache;
        forceUpdate();
      }
      toast.error("Failed to delete column. Changes reverted.");
    },
    onSettled: () => {
      void utils.column.getByTableId.invalidate({ tableId });
    },
  });

  // Bulk create — no onSuccess; all logic lives in handleBulkCreate
  const bulkCreate = api.row.bulkCreate.useMutation();
  const [isBulkCreating, setIsBulkCreating] = useState(false);

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

  const handleBulkCreate = useCallback(async () => {
    const CHUNK = 1000;
    const TOTAL = 100_000;
    setIsBulkCreating(true);
    // Clear any stale page 0 so phase 1 can populate it fresh.
    delete pageCacheRef.current[0];
    loadingPagesRef.current.delete(0);
    try {
      // Phase 1 — insert the first chunk then immediately fetch count + page 0
      // together so the virtualizer expands and top rows render in the same paint.
      await bulkCreate.mutateAsync({ tableId, count: CHUNK });
      const [, phase1Page0] = await Promise.all([
        refetchCount(),
        utils.row.getByOffset
          .fetch({ tableId, offset: 0, limit: PAGE_SIZE, filters, sorts }, { staleTime: 0 })
          .catch(() => null),
      ]);
      if (phase1Page0) {
        pageCacheRef.current[0] = phase1Page0.items.map((r) => ({ id: r.id, cells: r.cells }));
      }
      forceUpdate();

      // Remaining chunks — fire-and-forget refetchCount so the footer counter
      // updates as rows accumulate (page 0 is already loaded; user can't scroll
      // faster than new pages are fetched on demand).
      for (let i = 1; i < TOTAL / CHUNK; i++) {
        await bulkCreate.mutateAsync({ tableId, count: CHUNK });
        void refetchCount();
      }
    } finally {
      // Full cache refresh after all rows are inserted
      await utils.row.getByOffset.invalidate({ tableId });
      pageCacheRef.current = {};
      loadingPagesRef.current = new Set();
      const [, page0] = await Promise.all([
        refetchCount(),
        utils.row.getByOffset
          .fetch({ tableId, offset: 0, limit: PAGE_SIZE, filters, sorts }, { staleTime: 0 })
          .catch(() => null),
      ]);
      if (page0) {
        pageCacheRef.current[0] = page0.items.map((r) => ({ id: r.id, cells: r.cells }));
      }
      forceUpdate();
      setIsBulkCreating(false);
    }
  }, [tableId, bulkCreate, refetchCount, utils.row.getByOffset, filters, sorts]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRow = api.row.create.useMutation({
    onMutate: ({ tableId: mutTableId, cells }) => {
      const optimisticId = `optimistic-${Date.now()}`;
      const currentCount = utils.row.count.getData({ tableId: mutTableId, filters })?.count ?? totalCount;
      const newIndex = currentCount;
      const pageIndex = Math.floor(newIndex / PAGE_SIZE);
      const pageEntry = pageCacheRef.current[pageIndex];
      const newRow: RowData = { id: optimisticId, cells: cells as Record<string, string | number | null> };
      if (pageEntry) {
        pageEntry.push(newRow);
      } else {
        pageCacheRef.current[pageIndex] = [newRow];
      }
      utils.row.count.setData({ tableId: mutTableId, filters }, (old) => ({
        count: (old?.count ?? currentCount) + 1,
      }));
      forceUpdate();
      // Scroll and focus on the primary cell
      const primaryColId = columnsData?.find((c) => c.isPrimary)?.id ?? columnsData?.[0]?.id;
      if (primaryColId) {
        requestAnimationFrame(() => {
          rowVirtualizerRef.current?.scrollToIndex(newIndex, { align: "end" });
          setCursor({ rowIndex: newIndex, columnId: primaryColId });
          setEditingCell({ rowIndex: newIndex, columnId: primaryColId });
        });
      }
      return { optimisticId, newIndex, pageIndex };
    },
    onSuccess: (created, _vars, ctx) => {
      if (!ctx) return;
      const page = pageCacheRef.current[ctx.pageIndex];
      if (page) {
        const idx = page.findIndex((r) => r.id === ctx.optimisticId);
        if (idx !== -1) {
          page[idx] = { id: created.id, cells: created.cells };
          forceUpdate();
        }
      }
    },
    onError: (_err, { tableId: mutTableId }, ctx) => {
      if (!ctx) return;
      const page = pageCacheRef.current[ctx.pageIndex];
      if (page) {
        const idx = page.findIndex((r) => r.id === ctx.optimisticId);
        if (idx !== -1) {
          page.splice(idx, 1);
          utils.row.count.setData({ tableId: mutTableId, filters }, (old) => ({
            count: Math.max(0, (old?.count ?? 0) - 1),
          }));
          forceUpdate();
        }
      }
      toast.error("Failed to add row. Changes reverted.");
    },
    onSettled: (_d, _e, { tableId: mutTableId }) => {
      void utils.row.getByOffset.invalidate({ tableId: mutTableId });
      void refetchCount();
    },
  });

  const handleAddRow = useCallback(() => {
    createRow.mutate({ tableId, cells: {} });
  }, [tableId, createRow]);

  const [isBulkAddingColumns, setIsBulkAddingColumns] = useState(false);
  const handleBulkAddColumns = useCallback(async () => {
    setIsBulkAddingColumns(true);
    try {
      for (let i = 0; i < 20; i++) {
        await createColumn.mutateAsync({ tableId, name: `Col ${i + 1}`, type: i % 3 === 0 ? "number" : "text" });
      }
    } finally {
      setIsBulkAddingColumns(false);
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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <GridToolbar
        onToggleViewsPanel={() => setViewsPanelOpen((v) => !v)}
        viewsPanelOpen={viewsPanelOpen}
        onHamburgerMouseEnter={() => { cancelHoverClose(); if (!viewsPanelOpen) setViewsPanelHover(true); }}
        onHamburgerMouseLeave={() => { if (!viewsPanelOpen) startHoverClose(); }}
        onBulkCreate={handleBulkCreate}
        isBulkCreating={isBulkCreating}
        onBulkAddColumns={handleBulkAddColumns}
        isBulkAddingColumns={isBulkAddingColumns}
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
            height: "100%",
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
          isBulkCreating={isBulkCreating}
          onRenameColumn={handleRenameColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddColumn={handleAddColumn}
          displayCount={totalCount}
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
          onDeleteSelectedRows={handleDeleteSelectedRows}
          allSelected={totalCount > 0 && selectedRowIds.size === totalCount}
          onAddRow={handleAddRow}
          searchQuery={searchQuery}
          currentSearchMatch={searchMatches[searchMatchIndex] ?? null}
          sortedColumnIds={sorts.map((s) => s.columnId)}
          filteredColumnIds={filters.map((f) => f.columnId)}
        />
      )}
      </div>

    </div>
  );
}
