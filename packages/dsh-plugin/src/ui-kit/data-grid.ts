// @ts-nocheck
/**
 * @monkeyagent/ui — DataGrid（TanStack table-core headless + 本袋 Table 渲染）。
 * 用框架无关的 table-core（createTable）而非 react-table，避免 React 双实例。
 * state 由 React 托管，渲染期间同步回 table options（TanStack 官方 headless 模式）。
 */
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
} from "@tanstack/table-core";

function merge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

function mapColumns(columns, sortable) {
  return columns.map((c) => ({
    id: String(c.key),
    accessorKey: c.key,
    header: c.label != null ? String(c.label) : String(c.key),
    enableSorting: sortable !== false && c.sortable !== false,
    cell: c.render
      ? (info) => c.render(info.getValue(), info.row.original)
      : (info) => (info.getValue() == null ? "" : String(info.getValue())),
  }));
}

export function createDataGrid(React, ui) {
  const { useEffect, useRef, useState, createElement: el } = React;
  const flexRender = (comp, props) => (typeof comp === "function" ? el(comp, props) : comp);
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } = ui;

  function DataGrid({
    columns = [],
    data = [],
    sortable = true,
    selectable = false,
    exportable = false,
    exportFilename = "export.csv",
    pageSize = 0,
    maxHeight,
    empty = "暂无数据",
    onRowClick,
    onSelectionChange,
    className,
    style,
  }) {
    const [sorting, setSorting] = useState([]);
    const [rowSelection, setRowSelection] = useState({});
    const [page, setPage] = useState(0);
    const [hoverCol, setHoverCol] = useState(null);
    const [hoverRow, setHoverRow] = useState(null);
    const ps = pageSize > 0 ? pageSize : Math.max(data.length, 1);
    const stateShape = { sorting, rowSelection, pagination: { pageIndex: page, pageSize: ps }, columnPinning: { left: [], right: [] } };

    const tableRef = useRef(null);
    const [table] = useState(() => {
      const t = createTable({
        columns: [],
        data: [],
        state: stateShape,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        enableRowSelection: !!selectable,
        getRowId: (row, index) => (row && row.id != null ? String(row.id) : String(index)),
      });
      tableRef.current = t;
      return t;
    });

    // 渲染期间同步最新配置（TanStack 官方 headless 模式）：每次渲染把完整 options 写回
    // （core 的 mergeOptions 只并默认项，row models / handlers 必须每次带上）。
    table.setOptions({
      columns: mapColumns(columns, sortable),
      data,
      state: stateShape,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      onSortingChange: (updater) => setSorting(typeof updater === "function" ? updater(sorting) : updater),
      onRowSelectionChange: (updater) => setRowSelection(typeof updater === "function" ? updater(rowSelection) : updater),
      onPaginationChange: (updater) => {
        const next = typeof updater === "function" ? updater({ pageIndex: page, pageSize: ps }) : updater;
        setPage(next && next.pageIndex != null ? next.pageIndex : 0);
      },
      enableRowSelection: !!selectable,
      getRowId: (row, index) => (row && row.id != null ? String(row.id) : String(index)),
    });

    useEffect(() => {
      if (onSelectionChange) {
        onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
      }
    }, [rowSelection]);

    function doExport() {
      const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const head = columns.map((c) => esc(c.label != null ? c.label : c.key)).join(",");
      const body = data.map((r) => columns.map((c) => esc(r[c.key])).join(",")).join("\n");
      const blob = new Blob(["\ufeff" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }

    const headerGroups = table.getHeaderGroups();
    const rows = table.getRowModel().rows;
    const canPrev = page > 0;
    const canNext = (page + 1) * ps < data.length;
    const selectedBg = "color-mix(in srgb, var(--primary) 9%, transparent)";

    return el("div", { className, style: merge({ display: "flex", flexDirection: "column", gap: 8 }, style) },
      exportable
        ? el("div", { style: { display: "flex", justifyContent: "flex-end" } },
            el(Button, { size: "sm", variant: "outline", onClick: doExport, disabled: !data.length }, "导出 CSV")
          )
        : null,
      el("div", { style: { overflow: "auto", maxHeight, border: "1px solid var(--border)", borderRadius: "var(--radius)" } },
        el(Table, { style: { minWidth: 420 } },
          el(TableHeader, null,
            headerGroups.map((hg) =>
              el(TableRow, { key: hg.id },
                selectable
                  ? el(TableHead, { style: { width: 36 } },
                      el("input", {
                        type: "checkbox",
                        checked: table.getIsAllRowsSelected(),
                        ref: (n) => { if (n) n.indeterminate = table.getIsSomeRowsSelected(); },
                        onChange: table.getToggleAllRowsSelectedHandler(),
                        style: { accentColor: "var(--primary)", cursor: "pointer" },
                      })
                    )
                  : null,
                hg.headers.map((c) => {
                  const sorted = c.column.getIsSorted();
                  const canSort = sortable !== false && c.column.columnDef.enableSorting !== false;
                  const indicator = sorted ? (sorted === "asc" ? "▲" : "▼") : canSort ? "↕" : null;
                  return el(TableHead, {
                    key: c.id,
                    onClick: canSort ? () => c.column.toggleSorting() : undefined,
                    onMouseEnter: canSort ? () => setHoverCol(c.id) : undefined,
                    onMouseLeave: () => setHoverCol(null),
                    title: canSort ? "点击排序" : undefined,
                    style: canSort
                      ? { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", background: hoverCol === c.id ? "var(--muted)" : undefined, transition: "background-color .12s ease" }
                      : { whiteSpace: "nowrap" },
                  },
                    flexRender(c.column.columnDef.header, c.getContext()),
                    indicator
                      ? el("span", { style: { marginLeft: 4, fontSize: 11, color: sorted ? "var(--primary)" : "var(--muted-foreground)", opacity: sorted ? 1 : 0.55 } }, indicator)
                      : null
                  );
                })
              )
            )
          ),
          el(TableBody, null,
            rows.length
              ? rows.map((row) => {
                  const selected = row.getIsSelected();
                  const hovered = onRowClick && hoverRow === row.id;
                  return el(TableRow, {
                    key: row.id,
                    onClick: onRowClick
                      ? (e) => {
                          if (e.target && e.target.tagName === "INPUT") return;
                          onRowClick(row.original, row.index);
                        }
                      : undefined,
                    onMouseEnter: onRowClick ? () => setHoverRow(row.id) : undefined,
                    onMouseLeave: onRowClick ? () => setHoverRow(null) : undefined,
                    style: {
                      cursor: onRowClick ? "pointer" : undefined,
                      background: hovered ? "var(--muted)" : selected ? selectedBg : undefined,
                      transition: "background-color .12s ease",
                    },
                  },
                    selectable
                      ? el(TableCell, { style: { width: 36 } },
                          el("input", {
                            type: "checkbox",
                            checked: selected,
                            onChange: row.getToggleSelectedHandler(),
                            style: { accentColor: "var(--primary)", cursor: "pointer" },
                          })
                        )
                      : null,
                    row.getVisibleCells().map((cell) =>
                      el(TableCell, { key: cell.id }, flexRender(cell.column.columnDef.cell, cell.getContext()))
                    )
                  );
                })
              : el(TableRow, null, el(TableCell, { colSpan: (headerGroups[0] ? headerGroups[0].headers.length : 0) + (selectable ? 1 : 0) || 1, style: { textAlign: "center", color: "var(--muted-foreground)", padding: 18 } }, empty))
          )
        )
      ),
      pageSize > 0 && data.length > pageSize
        ? el("div", { style: { display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", fontSize: 12 } },
            el("span", { style: { color: "var(--muted-foreground)", marginRight: 4 } },
              (page * pageSize + 1) + "–" + Math.min((page + 1) * pageSize, data.length) + " / " + data.length
            ),
            el(Button, { size: "sm", variant: "outline", disabled: !canPrev, onClick: () => setPage(Math.max(0, page - 1)) }, "上一页"),
            el(Button, { size: "sm", variant: "outline", disabled: !canNext, onClick: () => setPage(page + 1) }, "下一页")
          )
        : null
    );
  }

  return { DataGrid };
}
