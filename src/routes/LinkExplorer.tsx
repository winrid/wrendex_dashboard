// Link Explorer (plan section 4.3 - R.03). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/links.
//
// Server-paginated grid over exploreLinks(). The BE filters by `type`
// (internal | external) only; the rel toggle and the source/target search
// are client-side filters applied to the loaded page. Sorting is server
// driven (sourceUrl / targetUrl are honoured by the BE; status sorts client-
// side on the loaded page).
//
// Each row click opens a Popover with the full anchor text + rel string +
// the canonicalised target URL. The BE LinkEntry only exposes `nofollow`
// (boolean) and `external` (boolean); the full rel string and the
// sponsored / ugc badges depend on a future BE field. We render what the
// shape exposes today and surface a "(rel passthrough)" placeholder so the
// popover slot is wired and ready for that follow-up.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type { LinkEntry, LinkExploreParams, LinkResult } from "@/api/types"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { ShareButton } from "@/components/share/ShareButton"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

type TypeFilter = "all" | "internal" | "external"
type RelFilter = "any" | "nofollow"

function statusBadgeClass(code: number): string {
  if (code === 0) return "bg-muted text-muted-foreground"
  if (code >= 200 && code < 300)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (code >= 300 && code < 400)
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (code >= 400 && code < 500)
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  if (code >= 500) return "bg-red-500/15 text-red-700 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

export function LinkExplorer() {
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [relFilter, setRelFilter] = useState<RelFilter>("any")
  const [search, setSearch] = useState("")

  const params = useMemo<LinkExploreParams>(
    () => ({
      page: pagination.pageIndex,
      size: pagination.pageSize,
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
    }),
    [pagination, sorting, typeFilter],
  )

  const linksQ = useQuery<LinkResult>({
    queryKey: ["explore-links", crawlId, params],
    queryFn: () => client.exploreLinks(crawlId, params),
    enabled: Boolean(crawlId),
  })

  const allRows = linksQ.data?.links ?? []
  const total = linksQ.data?.total ?? 0

  const filteredRows = useMemo<LinkEntry[]>(() => {
    let rows = allRows
    if (relFilter === "nofollow") {
      rows = rows.filter((r) => r.nofollow)
    }
    const needle = search.trim().toLowerCase()
    if (needle.length > 0) {
      rows = rows.filter(
        (r) =>
          r.sourceUrl.toLowerCase().includes(needle) ||
          r.targetUrl.toLowerCase().includes(needle),
      )
    }
    if (sorting[0]?.id === "targetStatusCode") {
      const dir = sorting[0].desc ? -1 : 1
      rows = [...rows].sort(
        (a, b) => dir * (a.targetStatusCode - b.targetStatusCode),
      )
    }
    return rows
  }, [allRows, relFilter, search, sorting])

  const columns = useMemo<ColumnDef<LinkEntry>[]>(
    () => [
      {
        id: "sourceUrl",
        header: "Source",
        accessorKey: "sourceUrl",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate font-mono text-xs"
            title={row.original.sourceUrl}
          >
            {row.original.sourceUrl}
          </span>
        ),
      },
      {
        id: "targetUrl",
        header: "Target",
        accessorKey: "targetUrl",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate font-mono text-xs"
            title={row.original.targetUrl}
          >
            {row.original.targetUrl}
          </span>
        ),
      },
      {
        id: "anchorText",
        header: "Anchor",
        accessorKey: "anchorText",
        cell: ({ row }) => {
          const text = row.original.anchorText?.trim() ?? ""
          if (text.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <span
              className="block max-w-[220px] truncate text-xs"
              title={text}
            >
              {text}
            </span>
          )
        },
      },
      {
        id: "rel",
        header: "Rel",
        cell: ({ row }) =>
          row.original.nofollow ? (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
              nofollow
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          ),
      },
      {
        id: "targetStatusCode",
        header: "Status",
        accessorKey: "targetStatusCode",
        enableSorting: true,
        cell: ({ row }) => {
          const code = row.original.targetStatusCode
          if (!code) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <Badge className={cn(statusBadgeClass(code))}>{code}</Badge>
          )
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) =>
          row.original.external ? (
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
              External
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Internal
            </Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <LinkDetailPopover entry={row.original} />,
      },
    ],
    [],
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

  const setTypeFilterReset = (next: TypeFilter) => {
    setTypeFilter(next)
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
          <span>Links</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Link explorer</h1>
        <p className="text-sm text-muted-foreground">
          Every link discovered in this crawl, with rel attributes and
          target HTTP status.
        </p>
      </div>

      <Toolbar
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilterReset}
        relFilter={relFilter}
        onRelFilterChange={setRelFilter}
        search={search}
        onSearchChange={setSearch}
        crawlId={crawlId}
        siteId={siteId}
        csvParams={params}
      />

      <DataTable<LinkEntry>
        columns={columns}
        data={filteredRows}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        isLoading={linksQ.isLoading}
        emptyState={
          linksQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load links.
            </span>
          ) : (
            "No links match these filters."
          )
        }
      />

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        {linksQ.data ? (
          <span>
            Showing {filteredRows.length} of {total}
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
  typeFilter: TypeFilter
  onTypeFilterChange: (v: TypeFilter) => void
  relFilter: RelFilter
  onRelFilterChange: (v: RelFilter) => void
  search: string
  onSearchChange: (v: string) => void
  crawlId: string
  siteId: string
  csvParams: Record<string, string | number | boolean | null | undefined>
}

function Toolbar({
  typeFilter,
  onTypeFilterChange,
  relFilter,
  onRelFilterChange,
  search,
  onSearchChange,
  crawlId,
  siteId,
  csvParams,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Filter source or target URL..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs"
        aria-label="Search links"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Type filter">
            Type
            {typeFilter !== "all" ? (
              <span className="ml-1 rounded bg-muted px-1 text-xs capitalize tabular-nums">
                {typeFilter}
              </span>
            ) : null}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={typeFilter}
            onValueChange={(v) => onTypeFilterChange(v as TypeFilter)}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="internal">
              Internal
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="external">
              External
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Rel filter">
            Rel
            {relFilter !== "any" ? (
              <span className="ml-1 rounded bg-muted px-1 text-xs">
                {relFilter}
              </span>
            ) : null}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Rel</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={relFilter === "nofollow"}
            onCheckedChange={(v) =>
              onRelFilterChange(v ? "nofollow" : "any")
            }
            onSelect={(e) => e.preventDefault()}
          >
            nofollow only
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <CsvExportButton
          path={`/api/crawls/${crawlId}/links/explore`}
          params={csvParams}
          filename={`links-${crawlId}.csv`}
        />
        <ShareButton
          scope="CRAWL_REPORT"
          targetId={siteId}
          subResource="links"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row detail popover
// ---------------------------------------------------------------------------

function LinkDetailPopover({ entry }: { entry: LinkEntry }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Open link detail">
          Detail
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="space-y-2 text-xs">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Anchor text
            </div>
            <div className="mt-0.5 break-words">
              {entry.anchorText && entry.anchorText.length > 0
                ? entry.anchorText
                : <span className="text-muted-foreground">(empty)</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Rel attributes
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {entry.nofollow ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  nofollow
                </Badge>
              ) : (
                <span className="text-muted-foreground">none</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Canonical target
            </div>
            <div className="mt-0.5 break-all font-mono">
              {entry.targetUrl}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
