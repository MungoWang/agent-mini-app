"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ListFilter,
  Search,
  Settings2,
  X,
} from "lucide-react"

import { Button } from "@monkey-mini-app/ui/components/button"
import { Checkbox } from "@monkey-mini-app/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@monkey-mini-app/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@monkey-mini-app/ui/components/input-group"
import { NativeSelect, NativeSelectOption } from "@monkey-mini-app/ui/components/native-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@monkey-mini-app/ui/components/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monkey-mini-app/ui/components/table"
import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { exportCsv } from "./export-csv"

export type { ColumnDef } from "@tanstack/react-table"

export type SearchVariant = "text" | "number" | "select" | "none"

export type DataGridColumnMeta = {
  sort?: boolean
  search?: SearchVariant
  label?: string
}

export type DataGridFeatures = {
  sorting?: boolean
  columnSearch?: boolean
  globalSearch?: boolean
  pagination?: boolean
  columnVisibility?: boolean
  rowSelection?: boolean
  columnResize?: boolean
  csvExport?: boolean
  /**
   * TanStack `autoResetPageIndex` — reset to page 1 when the `data` array
   * reference changes (default true). Turn off for inline edits / appends that
   * must keep the current page; pair with a `key` remount for structural loads.
   */
  autoResetPageIndex?: boolean
}

export type DataGridProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  features?: DataGridFeatures
  pageSize?: number
  /** Controlled current page (0-based). Omit for internal state. */
  pageIndex?: number
  /** Fired on every page change (also when the user flips pages). */
  onPageIndexChange?: (pageIndex: number) => void
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  getRowId?: (row: TData) => string
  renderExpanded?: (row: TData) => React.ReactNode
  /** Fired when a row is clicked, with the row's data. */
  onRowClick?: (row: TData) => void
  onStateChange?: (state: {
    sorting: SortingState
    columnFilters: ColumnFiltersState
    globalFilter: string
    pagination: { pageIndex: number; pageSize: number }
  }) => void
}

function columnLabel<TData>(column: Column<TData, unknown>) {
  const meta = column.columnDef.meta as DataGridColumnMeta | undefined
  if (meta?.label) return meta.label
  if (typeof column.columnDef.header === "string") return column.columnDef.header
  return column.id
}

function ColumnHeader<TData>({
  column,
  canSort,
  canFilter,
}: {
  column: Column<TData, unknown>
  canSort: boolean
  canFilter: boolean
}) {
  const t = useLabels("dataGrid")
  const sorted = column.getIsSorted()
  const filterValue = (column.getFilterValue() as string) ?? ""
  const filtered = filterValue.length > 0
  const label = columnLabel(column)

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      {canSort ? (
        <button
          type="button"
          data-testid={`sort-${column.id}`}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
          onClick={() => {
            if (sorted === "desc") column.clearSorting()
            else column.toggleSorting(sorted === "asc")
          }}
        >
          <span className="truncate">{label}</span>
          {sorted === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0 text-foreground" />
          ) : sorted === "desc" ? (
            <ArrowDown className="size-3.5 shrink-0 text-foreground" />
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-0 group-hover/th:opacity-40" />
          )}
        </button>
      ) : (
        <span className="truncate px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      )}

      {canFilter ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                data-testid={`column-filter-${column.id}`}
                aria-label={t.filterColumn(label)}
                className={cn(
                  "shrink-0 text-muted-foreground",
                  filtered
                    ? "text-foreground"
                    : "opacity-0 group-hover/th:opacity-100 data-popup-open:opacity-100"
                )}
              />
            }
          >
            <ListFilter className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <InputGroup>
              <InputGroupAddon>
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                autoFocus
                data-testid={`column-search-${column.id}`}
                placeholder={t.filterColumn(label)}
                value={filterValue}
                onChange={(event) => column.setFilterValue(event.target.value)}
              />
            </InputGroup>
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 w-full"
                onClick={() => column.setFilterValue("")}
              >
                {t.clear}
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

function GridToolbar<TData>({
  table,
  enabled,
  searchPlaceholder,
  toolbar,
}: {
  table: TanstackTable<TData>
  enabled: Required<DataGridFeatures>
  searchPlaceholder: string
  toolbar?: React.ReactNode
}) {
  const t = useLabels("dataGrid")
  const globalFilter = (table.getState().globalFilter as string) ?? ""
  const hideable = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && column.accessorFn)

  const chips = table.getState().columnFilters.filter(
    (filter) => String(filter.value ?? "").length > 0
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {enabled.globalSearch ? (
          <InputGroup className="max-w-xs">
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              data-testid="data-grid-global-search"
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </InputGroup>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {enabled.csvExport ? (
            <Button
              variant="outline"
              size="sm"
              data-testid="data-grid-export"
              onClick={() =>
                exportCsv(
                  table.getFilteredRowModel().rows.map((row) => row.original as Record<string, unknown>)
                )
              }
            >
              <Download />
              {t.export}
            </Button>
          ) : null}
          {toolbar}
          {enabled.columnVisibility && hideable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                <Settings2 />
                {t.view}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                  {hideable.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                      className="capitalize"
                    >
                      {columnLabel(column)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((filter) => {
            const column = table.getColumn(filter.id)
            if (!column) return null
            return (
              <button
                key={filter.id}
                type="button"
                className="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/60 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => column.setFilterValue("")}
              >
                <span className="font-medium text-foreground">
                  {columnLabel(column)}
                </span>
                <span className="max-w-28 truncate">{String(filter.value)}</span>
                <X className="size-3" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Product table: sort, column filter popover, global search, pagination.
 * @when Any list/table of rows — prefer over raw Table*
 * @example
 * const columns: ColumnDef<Row>[] = [
 *   { accessorKey: "name", header: "Name", meta: { sort: true, search: "text" } },
 * ]
 * <DataGrid columns={columns} data={rows} pageSize={20} />
 *
 * Pagination resets to page 1 whenever the `data` reference changes
 * (TanStack `autoResetPageIndex`, default true) — right for filter/refresh
 * flows. For inline edits / streaming appends that must keep the current page,
 * set `features={{ autoResetPageIndex: false }}` and drive page resets with
 * the controlled `pageIndex` prop:
 *
 * @example
 * const [page, setPage] = useState(0)
 * <DataGrid
 *   columns={columns}
 *   data={rows}
 *   features={{ autoResetPageIndex: false }}
 *   pageIndex={page}
 *   onPageIndexChange={setPage}
 * />
 * // “回到第 1 页”按钮：setPage(0)；结构性重载也可用 key 重挂
 */
export function DataGrid<TData>({
  columns,
  data,
  features,
  pageSize = 10,
  pageIndex,
  onPageIndexChange,
  searchPlaceholder,
  toolbar,
  getRowId,
  renderExpanded,
  onRowClick,
  onStateChange,
}: DataGridProps<TData>) {
  const t = useLabels("dataGrid")
  const enabled: Required<DataGridFeatures> = {
    sorting: features?.sorting ?? true,
    columnSearch: features?.columnSearch ?? true,
    globalSearch: features?.globalSearch ?? true,
    pagination: features?.pagination ?? true,
    columnVisibility: features?.columnVisibility ?? true,
    rowSelection: features?.rowSelection ?? false,
    columnResize: features?.columnResize ?? false,
    csvExport: features?.csvExport ?? false,
    autoResetPageIndex: features?.autoResetPageIndex ?? true,
  }

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const selectionColumn = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enabled.rowSelection) return []
    return [
      {
        id: "_select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={t.selectAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t.selectRow}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ]
  }, [enabled.rowSelection, t.selectAll, t.selectRow])

  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize,
  })
  const pagination =
    pageIndex != null
      ? { ...internalPagination, pageIndex }
      : internalPagination

  const table = useReactTable({
    data,
    columns: [...selectionColumn, ...columns],
    state: {
      sorting: enabled.sorting ? sorting : [],
      columnFilters: enabled.columnSearch ? columnFilters : [],
      globalFilter: enabled.globalSearch ? globalFilter : "",
      columnVisibility,
      rowSelection,
      pagination,
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(pagination)
          : updater
      setInternalPagination(next)
      onPageIndexChange?.(next.pageIndex)
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting: enabled.sorting,
    enableFilters: enabled.columnSearch,
    enableGlobalFilter: enabled.globalSearch,
    enableRowSelection: enabled.rowSelection,
    enableColumnResizing: enabled.columnResize,
    columnResizeMode: "onChange",
    getRowId,
    autoResetPageIndex: enabled.autoResetPageIndex,
  })

  React.useEffect(() => {
    onStateChange?.({
      sorting,
      columnFilters,
      globalFilter,
      pagination: table.getState().pagination,
    })
  }, [sorting, columnFilters, globalFilter, table.getState().pagination.pageIndex, table.getState().pagination.pageSize])

  const rows = table.getRowModel().rows
  const filtered = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount() || 1
  const currentPageIndex = table.getState().pagination.pageIndex
  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      data-testid="data-grid"
    >
      <div className="border-b px-3 py-2">
        <GridToolbar
          table={table}
          enabled={enabled}
          searchPlaceholder={searchPlaceholder ?? t.search}
          toolbar={toolbar}
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | DataGridColumnMeta
                    | undefined
                  const canSort =
                    enabled.sorting &&
                    header.column.getCanSort() &&
                    meta?.sort !== false
                  const search = meta?.search ?? "text"
                  const canFilter =
                    enabled.columnSearch &&
                    search !== "none" &&
                    header.column.getCanFilter()

                  return (
                    <TableHead
                      key={header.id}
                      className="group/th relative h-9 px-3"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : typeof header.column
                          .columnDef.header === "function" &&
                        !canSort &&
                        !canFilter ? (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      ) : (
                        <ColumnHeader
                          column={header.column}
                          canSort={canSort}
                          canFilter={canFilter}
                        />
                      )}
                      {enabled.columnResize && header.column.getCanResize() ? (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                        />
                      ) : null}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                <TableRow
                  data-testid="data-grid-row"
                  className="h-10"
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    onRowClick?.(row.original)
                    if (renderExpanded) setExpandedId((id) => (id === row.id ? null : row.id))
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-0">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {renderExpanded && expandedId === row.id ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/30 px-3 py-3">
                      {renderExpanded(row.original)}
                    </TableCell>
                  </TableRow>
                ) : null}
                </React.Fragment>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-auto p-0"
                  data-testid="data-grid-empty"
                >
                  <Empty className="border-0 py-14">
                    <EmptyHeader>
                      <EmptyTitle>{t.noResults}</EmptyTitle>
                      <EmptyDescription>
                        {t.noResultsHint}
                      </EmptyDescription>
                    </EmptyHeader>
                    {filtered === 0 && data.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          table.resetColumnFilters()
                          table.setGlobalFilter("")
                        }}
                      >
                        {t.clearFilters}
                      </Button>
                    ) : null}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enabled.pagination || selectedCount > 0 ? (
        <div className="flex h-11 flex-wrap items-center justify-between gap-3 border-t px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            {enabled.pagination ? (
              <span className="tabular-nums">
                <span className="font-medium text-foreground">{filtered}</span>{" "}
                {filtered === 1 ? t.row : t.rows}
              </span>
            ) : null}
            {selectedCount > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-2 text-foreground"
                data-testid="data-grid-action-bar"
              >
                <span className="tabular-nums font-medium">{t.selected(selectedCount)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground h-6 gap-1 px-1.5 text-xs"
                  aria-label={t.clear}
                  onClick={() => table.resetRowSelection()}
                >
                  <X className="size-3" />
                  {t.clear}
                </Button>
              </span>
            ) : null}
          </div>
          {enabled.pagination ? (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="hidden sm:inline">{t.rowsLabel}</span>
                <NativeSelect
                  size="sm"
                  value={String(table.getState().pagination.pageSize)}
                  onChange={(event) =>
                    table.setPageSize(Number(event.target.value))
                  }
                >
                  {[10, 20, 30, 50].map((size) => (
                    <NativeSelectOption key={size} value={String(size)}>
                      {size}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <span data-testid="data-grid-page">
                {currentPageIndex + 1} / {pageCount}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  data-testid="data-grid-prev"
                  aria-label={t.previousPage}
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-xs"
                  data-testid="data-grid-next"
                  aria-label={t.nextPage}
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
