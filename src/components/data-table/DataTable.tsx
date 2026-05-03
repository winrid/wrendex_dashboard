import { useRef, useState, type ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type DataTableProps<TData, TValue = unknown> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  emptyState?: ReactNode
  pageSize?: number
  /** When true, render rows via @tanstack/react-virtual for large datasets and skip pagination. */
  virtualize?: boolean
  /** Total row count when paginating server-side; enables manualPagination. */
  rowCount?: number
  // Controlled state - pass these together to drive the table from outside
  // (e.g. a server-paginated report). Omit them all to fall back to the
  // internal client-side state below.
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  columnPinning?: ColumnPinningState
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>
  /** Row-selection wiring. Pair with `getRowId` so the selection persists
   *  across server-paginated page changes (the default uses the row index,
   *  which collides). */
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Stable per-row id used by row-selection, sorting, and downstream
   *  effects. Defaults to the row index. */
  getRowId?: (row: TData, index: number, parent?: Row<TData>) => string
}

/**
 * Shared TanStack Table v8 wrapper used by every report and explorer in the
 * Wrendex dashboard (see DASHBOARD_PLAN.txt sec 4 + 4A). Generic over the row
 * shape. Ships sortable headers, page-based pagination, optional virtualized
 * scroll (virtualize prop), client-side filtering, column pinning, and
 * loading/empty slots. Every state (sorting, pagination, filters, pinning) is
 * controllable: pass the value + onChange pair to drive it from a parent that
 * mirrors server-side pagination, otherwise the table manages its own state.
 */
export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  isLoading = false,
  emptyState,
  pageSize = 25,
  virtualize = false,
  rowCount,
  sorting: sortingProp,
  onSortingChange: onSortingChangeProp,
  pagination: paginationProp,
  onPaginationChange: onPaginationChangeProp,
  columnFilters: columnFiltersProp,
  onColumnFiltersChange: onColumnFiltersChangeProp,
  columnPinning: columnPinningProp,
  onColumnPinningChange: onColumnPinningChangeProp,
  enableRowSelection,
  rowSelection: rowSelectionProp,
  onRowSelectionChange: onRowSelectionChangeProp,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([])
  const [internalColumnPinning, setInternalColumnPinning] = useState<ColumnPinningState>({})
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})

  const sorting = sortingProp ?? internalSorting
  const pagination = paginationProp ?? internalPagination
  const columnFilters = columnFiltersProp ?? internalColumnFilters
  const columnPinning = columnPinningProp ?? internalColumnPinning
  const rowSelection = rowSelectionProp ?? internalRowSelection

  const isServerPaginated = rowCount != null

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnPinning,
      rowSelection,
    },
    rowCount,
    manualPagination: isServerPaginated,
    enableRowSelection,
    onSortingChange: onSortingChangeProp ?? setInternalSorting,
    onPaginationChange: onPaginationChangeProp ?? setInternalPagination,
    onColumnFiltersChange: onColumnFiltersChangeProp ?? setInternalColumnFilters,
    onColumnPinningChange: onColumnPinningChangeProp ?? setInternalColumnPinning,
    onRowSelectionChange: onRowSelectionChangeProp ?? setInternalRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: virtualize ? undefined : getPaginationRowModel(),
  })

  const rows = table.getRowModel().rows

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 12,
    enabled: virtualize,
  })

  const renderEmpty = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length}
        className="h-32 text-center text-sm text-muted-foreground"
      >
        {emptyState ?? "No results."}
      </TableCell>
    </TableRow>
  )

  const renderLoading = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length}
        className="h-32 text-center text-sm text-muted-foreground"
      >
        Loading...
      </TableCell>
    </TableRow>
  )

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className={cn(
          "rounded-md border bg-card",
          virtualize && "max-h-[calc(100vh-220px)] overflow-auto",
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 gap-1.5 px-2 font-medium"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-50" />
                          )}
                        </Button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoading()
            ) : rows.length === 0 ? (
              renderEmpty()
            ) : virtualize ? (
              <>
                {(() => {
                  const virtualRows = rowVirtualizer.getVirtualItems()
                  const totalSize = rowVirtualizer.getTotalSize()
                  const paddingTop =
                    virtualRows.length > 0 ? virtualRows[0].start : 0
                  const paddingBottom =
                    virtualRows.length > 0
                      ? totalSize -
                        virtualRows[virtualRows.length - 1].end
                      : 0
                  return (
                    <>
                      {paddingTop > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            style={{ height: paddingTop, padding: 0 }}
                          />
                        </TableRow>
                      )}
                      {virtualRows.map((vRow) => {
                        const row = rows[vRow.index]
                        return (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                      {paddingBottom > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            style={{ height: paddingBottom, padding: 0 }}
                          />
                        </TableRow>
                      )}
                    </>
                  )
                })()}
              </>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!virtualize && rows.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
