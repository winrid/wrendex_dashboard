// Page Explorer (plan section 4.2 - R.02). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/pages.
//
// Server-paginated grid over explorePages(). The BE caps each page at 200
// rows (iter 1 fixup) so we explicitly request size <= 200 and surface a
// "showing N of M" footer. Status code multi-select drives the BE
// `?statusCode=` filter; the BE accepts a single status code so when more
// than one is selected we filter on the loaded page client-side and let the
// user know via the toolbar count badge.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type { PageExploreParams, PageResult, PageRow } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/format"

const STATUS_CODE_OPTIONS = [200, 301, 302, 404, 500] as const
const PAGE_SIZE = 50

function statusCodeBadgeClass(code: number): string {
  if (code >= 200 && code < 300)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (code >= 300 && code < 400)
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (code >= 400 && code < 500)
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  if (code >= 500) return "bg-red-500/15 text-red-700 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

/** Fallback derivation when the BE row predates the iter 2 round 1 PageRow
 *  shape and does not carry an `indexable` flag. The BE rule (PageRow.java
 *  derivedIndexable) treats noindex / none as not indexable; mirror it. */
function indexableFromRobots(robotsMeta: string | null | undefined): boolean {
  if (!robotsMeta) return true
  const lower = robotsMeta.toLowerCase()
  if (lower.includes("noindex")) return false
  if (lower.includes("none")) return false
  return true
}

function indexableFromRow(row: PageRow): boolean {
  // The BE-derived flag is authoritative (PageRow.indexable). Fallback to
  // the FE rule for any payload that arrived without it (defensive).
  if (typeof row.indexable === "boolean") return row.indexable
  return indexableFromRobots(row.robotsMeta)
}

export function PageExplorer() {
  const {
    tenantId = "default",
    siteId = "",
    crawlId = "",
  } = useParams<{
    tenantId: string
    siteId: string
    crawlId: string
  }>()
  const client = useApiClient()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [statusCodes, setStatusCodes] = useState<number[]>([])
  const [urlContains, setUrlContains] = useState("")

  // BE accepts a single statusCode; pass it through only when exactly one is
  // selected. With more than one we drop the filter and apply it client-side
  // against the rows already on the page.
  const beStatusCode = statusCodes.length === 1 ? statusCodes[0] : undefined

  const params = useMemo<PageExploreParams>(
    () => ({
      page: pagination.pageIndex,
      size: Math.min(pagination.pageSize, 200),
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
      statusCode: beStatusCode,
    }),
    [pagination, sorting, beStatusCode],
  )

  const pagesQ = useQuery<PageResult>({
    queryKey: ["explore-pages", crawlId, params],
    queryFn: () => client.explorePages(crawlId, params),
    enabled: Boolean(crawlId),
  })

  const allRows = pagesQ.data?.pages ?? []
  const total = pagesQ.data?.total ?? 0

  const filteredRows = useMemo<PageRow[]>(() => {
    let rows = allRows
    if (statusCodes.length > 1) {
      const set = new Set(statusCodes)
      rows = rows.filter((p) => set.has(p.statusCode))
    }
    if (urlContains.trim().length > 0) {
      const needle = urlContains.toLowerCase()
      rows = rows.filter((p) => p.url.toLowerCase().includes(needle))
    }
    return rows
  }, [allRows, statusCodes, urlContains])

  const columns = useMemo<ColumnDef<PageRow>[]>(
    () => [
      {
        id: "url",
        header: "URL",
        accessorKey: "url",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="block max-w-[420px] truncate font-mono text-xs"
            title={row.original.url}
          >
            {row.original.url}
          </span>
        ),
      },
      {
        id: "statusCode",
        header: "Status",
        accessorKey: "statusCode",
        enableSorting: true,
        cell: ({ row }) => (
          <Badge className={cn(statusCodeBadgeClass(row.original.statusCode))}>
            {row.original.statusCode}
          </Badge>
        ),
      },
      {
        id: "responseTimeMs",
        header: "Response",
        accessorKey: "responseTimeMs",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.responseTimeMs}ms
          </span>
        ),
      },
      {
        id: "ttfbMs",
        header: "TTFB",
        accessorKey: "ttfbMs",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.ttfbMs}ms
          </span>
        ),
      },
      {
        id: "wordCount",
        header: "Words",
        accessorKey: "wordCount",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.wordCount}
          </span>
        ),
      },
      {
        id: "contentLengthBytes",
        header: "Size",
        accessorKey: "contentLengthBytes",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {formatBytes(row.original.contentLengthBytes)}
          </span>
        ),
      },
      {
        id: "errorCount",
        header: "Issues",
        accessorKey: "errorCount",
        enableSorting: true,
        cell: ({ row }) => <IssueStack row={row.original} />,
      },
      {
        id: "indexable",
        header: "Indexable",
        cell: ({ row }) => {
          const ok = indexableFromRow(row.original)
          return ok ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Yes
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
              No
            </Badge>
          )
        },
      },
      {
        id: "lang",
        header: "Lang",
        cell: ({ row }) => (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.original.lang ?? "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm">
            <Link
              to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(row.original.url)}&crawlId=${crawlId}`}
            >
              Open
            </Link>
          </Button>
        ),
      },
    ],
    [tenantId, siteId, crawlId],
  )

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    )
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    )
  }

  // We only consume column state via the controlled handle; the toolbar
  // drives the actual filtering, so we keep columnFilters empty.
  const columnFilters: ColumnFiltersState = []
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = () => {
    /* no-op */
  }

  const toggleStatusCode = (code: number, on: boolean) => {
    setStatusCodes((prev) =>
      on
        ? Array.from(new Set([...prev, code]))
        : prev.filter((c) => c !== code),
    )
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to={`/t/${tenantId}/sites/${siteId}`}
            className="hover:underline"
          >
            Site
          </Link>
          <span>/</span>
          <Link
            to={`/t/${tenantId}/sites/${siteId}/crawls`}
            className="hover:underline"
          >
            Crawls
          </Link>
          <span>/</span>
          <span>Pages</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Page explorer</h1>
        <p className="text-sm text-muted-foreground">
          Every page crawled in this run, with response and indexability data.
        </p>
      </div>

      <Toolbar
        urlContains={urlContains}
        onUrlContainsChange={(v) => {
          setUrlContains(v)
          setPagination((p) => ({ ...p, pageIndex: 0 }))
        }}
        statusCodes={statusCodes}
        onToggleStatusCode={toggleStatusCode}
        csvParams={{
          page: params.page,
          size: params.size,
          sort: params.sort,
          dir: params.dir,
          statusCode: params.statusCode,
        }}
        crawlId={crawlId}
      />

      <DataTable<PageRow>
        columns={columns}
        data={filteredRows}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        columnFilters={columnFilters}
        onColumnFiltersChange={onColumnFiltersChange}
        isLoading={pagesQ.isLoading}
        emptyState={
          pagesQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load pages.
            </span>
          ) : (
            "No pages match these filters."
          )
        }
      />

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        {pagesQ.data ? (
          <span>
            Showing {filteredRows.length} of {total}
            {total > 200 ? (
              <span className="ml-1 inline-flex items-center gap-1">
                <ExternalLinkIcon className="size-3" />
                Capped at 200 per page
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type ToolbarProps = {
  urlContains: string
  onUrlContainsChange: (v: string) => void
  statusCodes: number[]
  onToggleStatusCode: (code: number, on: boolean) => void
  csvParams: Record<string, string | number | boolean | null | undefined>
  crawlId: string
}

function Toolbar({
  urlContains,
  onUrlContainsChange,
  statusCodes,
  onToggleStatusCode,
  csvParams,
  crawlId,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Filter by URL..."
        value={urlContains}
        onChange={(e) => onUrlContainsChange(e.target.value)}
        className="max-w-xs"
        aria-label="Filter pages by URL"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Status code filter">
            Status code
            {statusCodes.length > 0 ? (
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {statusCodes.length}
              </span>
            ) : null}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Status code</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_CODE_OPTIONS.map((code) => (
            <DropdownMenuCheckboxItem
              key={code}
              checked={statusCodes.includes(code)}
              onCheckedChange={(v) => onToggleStatusCode(code, Boolean(v))}
              onSelect={(e) => e.preventDefault()}
            >
              {code}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto">
        <CsvExportButton
          path={`/api/crawls/${crawlId}/pages/explore`}
          params={csvParams}
          filename={`pages-${crawlId}.csv`}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// IssueStack: small severity-coloured stack of per-page alert counts.
// Reads the iter 2 round 1 PageRow fields (errorCount / warningCount /
// noticeCount). Renders "0" with a muted dash when the page has no alerts.
// ---------------------------------------------------------------------------

function IssueStack({ row }: { row: PageRow }) {
  const e = row.errorCount ?? 0
  const w = row.warningCount ?? 0
  const n = row.noticeCount ?? 0
  if (e === 0 && w === 0 && n === 0) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      {e > 0 ? (
        <span
          className="inline-flex items-center gap-1"
          title={`${e} error${e === 1 ? "" : "s"}`}
        >
          <span className="inline-block size-2 rounded-full bg-red-500" />
          <span className="tabular-nums text-red-700 dark:text-red-400">
            {e}
          </span>
        </span>
      ) : null}
      {w > 0 ? (
        <span
          className="inline-flex items-center gap-1"
          title={`${w} warning${w === 1 ? "" : "s"}`}
        >
          <span className="inline-block size-2 rounded-full bg-amber-500" />
          <span className="tabular-nums text-amber-700 dark:text-amber-400">
            {w}
          </span>
        </span>
      ) : null}
      {n > 0 ? (
        <span
          className="inline-flex items-center gap-1"
          title={`${n} notice${n === 1 ? "" : "s"}`}
        >
          <span className="inline-block size-2 rounded-full bg-blue-500" />
          <span className="tabular-nums text-blue-700 dark:text-blue-400">
            {n}
          </span>
        </span>
      ) : null}
    </div>
  )
}
