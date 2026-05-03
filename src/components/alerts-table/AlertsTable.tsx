// Reusable alerts grid. Wraps DataTable with controlled state so the inbox
// (sec 3) and the per-category / per-AlertType drill-ins (sec 4A.2 / 4A.3)
// can share one implementation. Keep this component dumb: data fetching
// lives in the parent route, which means callers control pagination,
// sorting, and filter parameters. Server-paginated by default - pass `total`
// so DataTable switches into manualPagination mode.
//
// The toolbar is intentionally tiny. Search input filters by
// `pageUrlContains`; severity / category multi-selects use a dropdown-menu
// with checkbox items. We accept the shadcn defaults; do not skin them.

import { useMemo } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  EyeOffIcon,
  EyeIcon,
  MoreHorizontalIcon,
} from "lucide-react"
import type { Alert, AlertStatus, Severity } from "@/api/types"
import { getCheck } from "@/api/checkCatalog"
import { DataTable } from "@/components/data-table/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/format"

const SEVERITIES: Severity[] = ["ERROR", "WARNING", "NOTICE"]
const STATUSES: AlertStatus[] = ["OPEN", "IGNORED", "RESOLVED"]

export type AlertsTableToolbarState = {
  pageUrlContains: string
  severities: Severity[]
  categories: string[]
  status?: AlertStatus
}

export type AlertsTableProps = {
  data: Alert[]
  total: number
  isLoading?: boolean
  /** Server-paginated state. Pass these together. */
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  /** Toolbar state. The parent route is the source of truth and folds these
   *  values into its query keys / filters. */
  toolbar: AlertsTableToolbarState
  onToolbarChange: (next: AlertsTableToolbarState) => void
  /** Optional list of categories to surface in the category multi-select.
   *  Default: every catalog category. Drill-ins can constrain this. */
  categoryOptions?: string[]
  /** Hide the status dropdown entirely (the per-AlertType drill-in does
   *  not need it; the inbox uses tabs instead). */
  hideStatusFilter?: boolean
  /** Hide the category multi-select (the per-category drill-in pins one). */
  hideCategoryFilter?: boolean
  /** Optional row actions. */
  onIgnore?: (alert: Alert) => void
  onUnignore?: (alert: Alert) => void
  onRowClick?: (alert: Alert) => void
  /** Per-row dropdown actions. When supplied, renders a kebab menu in the
   *  actions column with Snooze 24h / Snooze 7d / Assign / Acknowledge
   *  options. Each handler is passed the row alert. */
  onSnooze24h?: (alert: Alert) => void
  onSnooze7d?: (alert: Alert) => void
  onAssign?: (alert: Alert) => void
  onAcknowledge?: (alert: Alert) => void
  /** Row selection wiring. When `enableRowSelection` is true the table
   *  renders a leading checkbox column and surfaces the controlled state via
   *  `rowSelection` / `onRowSelectionChange`. The parent route maps the
   *  selected rows to alert ids via the `data` array - the table keys row
   *  selection on `Alert.id` so toggling persists across pagination. */
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
}

function severityDotClass(sev: Severity): string {
  switch (sev) {
    case "ERROR":
      return "bg-red-500"
    case "WARNING":
      return "bg-amber-500"
    case "NOTICE":
      return "bg-blue-500"
  }
}

/** Wraps DataTable with a toolbar and the standard alert columns. */
export function AlertsTable({
  data,
  total,
  isLoading,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  toolbar,
  onToolbarChange,
  categoryOptions,
  hideStatusFilter,
  hideCategoryFilter,
  onIgnore,
  onUnignore,
  onRowClick,
  onSnooze24h,
  onSnooze7d,
  onAssign,
  onAcknowledge,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
}: AlertsTableProps) {
  const columns = useMemo<ColumnDef<Alert>[]>(() => {
    const cols: ColumnDef<Alert>[] = []
    if (enableRowSelection) {
      cols.push({
        id: "select",
        header: ({ table }) => {
          const allChecked =
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          return (
            <Checkbox
              aria-label="Select all"
              checked={allChecked}
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(Boolean(value))
              }
              data-testid="alerts-select-all"
            />
          )
        },
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select alert ${row.original.id}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            onClick={(e) => e.stopPropagation()}
            data-testid={`alerts-select-${row.original.id}`}
          />
        ),
        enableSorting: false,
      })
    }
    cols.push(
      {
        id: "severity",
        header: "Severity",
        accessorKey: "severity",
        enableSorting: true,
        cell: ({ row }) => {
          const sev = row.original.severity
          return (
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("inline-block size-2 rounded-full", severityDotClass(sev))}
              />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {sev}
              </span>
            </div>
          )
        },
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const entry = getCheck(row.original.type)
          return (
            <span className="text-sm">{entry?.category ?? "Unknown"}</span>
          )
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const entry = getCheck(row.original.type)
          return (
            <span className="text-sm font-medium">
              {entry?.title ?? row.original.type}
            </span>
          )
        },
      },
      {
        id: "pageUrl",
        header: "Page",
        cell: ({ row }) => (
          <span
            className="block max-w-[420px] truncate font-mono text-xs"
            title={row.original.pageUrl}
          >
            {row.original.pageUrl}
          </span>
        ),
      },
      {
        id: "lastSeenAt",
        header: "Last seen",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.lastSeenAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "affected",
        header: "Affected",
        cell: ({ row }) => {
          const n = row.original.affectedUrls?.length ?? 0
          return (
            <span className="text-xs tabular-nums text-muted-foreground">
              {n}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const alert = row.original
          const hasMenu =
            Boolean(onSnooze24h) ||
            Boolean(onSnooze7d) ||
            Boolean(onAssign) ||
            Boolean(onAcknowledge)
          return (
            <div className="flex items-center justify-end gap-1">
              {alert.status === "OPEN" && onIgnore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onIgnore(alert)
                  }}
                >
                  <EyeOffIcon />
                  <span className="sr-only">Ignore</span>
                </Button>
              ) : null}
              {alert.status === "IGNORED" && onUnignore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnignore(alert)
                  }}
                >
                  <EyeIcon />
                  <span className="sr-only">Unignore</span>
                </Button>
              ) : null}
              {hasMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`alerts-row-menu-${alert.id}`}
                      aria-label="Row actions"
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onSnooze24h ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          onSnooze24h(alert)
                        }}
                      >
                        Snooze 24h
                      </DropdownMenuItem>
                    ) : null}
                    {onSnooze7d ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          onSnooze7d(alert)
                        }}
                      >
                        Snooze 7d
                      </DropdownMenuItem>
                    ) : null}
                    {onAssign ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          onAssign(alert)
                        }}
                      >
                        Assign...
                      </DropdownMenuItem>
                    ) : null}
                    {onAcknowledge ? (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          onAcknowledge(alert)
                        }}
                      >
                        Acknowledge
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )
        },
      },
    )
    return cols
  }, [
    enableRowSelection,
    onIgnore,
    onUnignore,
    onSnooze24h,
    onSnooze7d,
    onAssign,
    onAcknowledge,
  ])

  // The DataTable wrapper exposes controlled `columnFilters`, but the alert
  // toolbar maps to server params (pageUrlContains, severity, etc.) rather
  // than per-column filters. We keep columnFilters empty and drive
  // everything through `toolbar` instead.
  const columnFilters: ColumnFiltersState = []
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = () => {
    /* no-op - toolbar drives filters */
  }

  const categories = categoryOptions ?? null

  return (
    <div className="space-y-3">
      <Toolbar
        toolbar={toolbar}
        onToolbarChange={onToolbarChange}
        categoryOptions={categories}
        hideStatusFilter={hideStatusFilter}
        hideCategoryFilter={hideCategoryFilter}
      />
      <div onClickCapture={onRowClick ? handleRowClickCapture(data, onRowClick) : undefined}>
        <DataTable<Alert>
          columns={columns}
          data={data}
          rowCount={total}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          sorting={sorting}
          onSortingChange={onSortingChange}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          isLoading={isLoading}
          emptyState="No alerts match these filters."
          enableRowSelection={enableRowSelection}
          rowSelection={rowSelection}
          onRowSelectionChange={onRowSelectionChange}
          getRowId={enableRowSelection ? (row) => row.id : undefined}
        />
      </div>
    </div>
  )
}

// Row-click is handled via event delegation against the rendered <tr>'s
// data-* attributes. The DataTable wrapper does not expose an onRowClick
// prop, but we know it renders one <tr> per row in source order. Using a
// closure that maps event.target -> data index keeps AlertsTable additive
// without forking DataTable.
function handleRowClickCapture(
  rows: Alert[],
  onRowClick: (a: Alert) => void,
): (e: React.MouseEvent<HTMLDivElement>) => void {
  return (e) => {
    const target = e.target as HTMLElement
    // Don't hijack clicks on buttons / links inside the row.
    if (target.closest("button, a, [data-slot='dropdown-menu-trigger']")) return
    const tr = target.closest("tr")
    if (!tr) return
    const tbody = tr.parentElement
    if (!tbody || tbody.tagName !== "TBODY") return
    const trs = Array.from(tbody.querySelectorAll(":scope > tr"))
    const idx = trs.indexOf(tr)
    if (idx < 0 || idx >= rows.length) return
    onRowClick(rows[idx]!)
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type ToolbarProps = {
  toolbar: AlertsTableToolbarState
  onToolbarChange: (next: AlertsTableToolbarState) => void
  categoryOptions: string[] | null
  hideStatusFilter?: boolean
  hideCategoryFilter?: boolean
}

function Toolbar({
  toolbar,
  onToolbarChange,
  categoryOptions,
  hideStatusFilter,
  hideCategoryFilter,
}: ToolbarProps) {
  const setSeverity = (sev: Severity, on: boolean) => {
    const next = on
      ? Array.from(new Set([...toolbar.severities, sev]))
      : toolbar.severities.filter((s) => s !== sev)
    onToolbarChange({ ...toolbar, severities: next })
  }
  const setCategory = (cat: string, on: boolean) => {
    const next = on
      ? Array.from(new Set([...toolbar.categories, cat]))
      : toolbar.categories.filter((c) => c !== cat)
    onToolbarChange({ ...toolbar, categories: next })
  }
  const setStatus = (status: AlertStatus | undefined) => {
    onToolbarChange({ ...toolbar, status })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Filter by URL..."
        value={toolbar.pageUrlContains}
        onChange={(e) =>
          onToolbarChange({ ...toolbar, pageUrlContains: e.target.value })
        }
        className="max-w-xs"
        aria-label="Filter alerts by URL"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Severity
            {toolbar.severities.length > 0 ? (
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {toolbar.severities.length}
              </span>
            ) : null}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Severity</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SEVERITIES.map((sev) => (
            <DropdownMenuCheckboxItem
              key={sev}
              checked={toolbar.severities.includes(sev)}
              onCheckedChange={(v) => setSeverity(sev, Boolean(v))}
              onSelect={(e) => e.preventDefault()}
            >
              {sev}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!hideCategoryFilter && categoryOptions && categoryOptions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Category
              {toolbar.categories.length > 0 ? (
                <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                  {toolbar.categories.length}
                </span>
              ) : null}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categoryOptions.map((cat) => (
              <DropdownMenuCheckboxItem
                key={cat}
                checked={toolbar.categories.includes(cat)}
                onCheckedChange={(v) => setCategory(cat, Boolean(v))}
                onSelect={(e) => e.preventDefault()}
              >
                {cat}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {!hideStatusFilter ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Status: {toolbar.status ?? "Any"}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem
              checked={toolbar.status === undefined}
              onCheckedChange={() => setStatus(undefined)}
              onSelect={(e) => e.preventDefault()}
            >
              Any
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={toolbar.status === s}
                onCheckedChange={() => setStatus(s)}
                onSelect={(e) => e.preventDefault()}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
