// Redirect Chains report (plan section 4.5 - R.05). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/redirects.
//
// Reads getRedirects(crawlId) and lays the entries out in DataTable. Each
// row exposes the source URL, the terminal URL, the chain length, the
// terminal status code, and a "Loop" badge when the chain is cyclic. The
// originatingPages count (a sample emitted by iter 2 BE-2) is rendered as a
// "N pages link here" trigger that opens a popover listing the URLs.

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { ExternalLinkIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type { RedirectEntry, RedirectsResult } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (code >= 300 && code < 400)
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (code >= 400 && code < 500)
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  if (code >= 500) return "bg-red-500/15 text-red-700 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

export function RedirectsReport() {
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

  const redirectsQ = useQuery<RedirectsResult>({
    queryKey: ["redirects", crawlId],
    queryFn: () => client.getRedirects(crawlId),
    enabled: Boolean(crawlId),
  })

  const columns = useMemo<ColumnDef<RedirectEntry>[]>(
    () => [
      {
        id: "sourceUrl",
        header: "Source",
        accessorKey: "sourceUrl",
        cell: ({ row }) => (
          <span
            className="block max-w-[320px] truncate font-mono text-xs"
            title={row.original.sourceUrl}
          >
            {row.original.sourceUrl}
          </span>
        ),
      },
      {
        id: "finalUrl",
        header: "Terminal",
        accessorKey: "finalUrl",
        cell: ({ row }) => (
          <span
            className="block max-w-[320px] truncate font-mono text-xs"
            title={row.original.finalUrl}
          >
            {row.original.finalUrl}
          </span>
        ),
      },
      {
        id: "chainLength",
        header: "Hops",
        accessorKey: "chainLength",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.chainLength}
          </span>
        ),
      },
      {
        id: "statusCode",
        header: "Final status",
        accessorKey: "statusCode",
        cell: ({ row }) => (
          <Badge className={cn(statusBadgeClass(row.original.statusCode))}>
            {row.original.statusCode}
          </Badge>
        ),
      },
      {
        id: "loop",
        header: "Loop",
        cell: ({ row }) =>
          row.original.loop ? (
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">
              Loop
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          ),
      },
      {
        id: "originatingPages",
        header: "Originating",
        cell: ({ row }) => (
          <OriginatingPagesCell entry={row.original} tenantId={tenantId} siteId={siteId} />
        ),
      },
    ],
    [tenantId, siteId],
  )

  const entries = redirectsQ.data?.entries ?? []
  const isEmpty = entries.length === 0 && !redirectsQ.isLoading
  const totalLoops = redirectsQ.data?.totalLoops ?? 0
  const totalChains = redirectsQ.data?.totalChains ?? 0

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
          <span>Redirects</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Redirect chains
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{totalChains} chains</Badge>
          {totalLoops > 0 ? (
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">
              {totalLoops} loops
            </Badge>
          ) : null}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No redirects found in this crawl - everything resolves directly.
        </div>
      ) : (
        <DataTable<RedirectEntry>
          columns={columns}
          data={entries}
          isLoading={redirectsQ.isLoading}
          emptyState={
            redirectsQ.isError ? (
              <span className="text-red-600 dark:text-red-400">
                Could not load redirects.
              </span>
            ) : (
              "No redirects found in this crawl - everything resolves directly."
            )
          }
        />
      )}
    </div>
  )
}

function OriginatingPagesCell({
  entry,
  tenantId,
  siteId,
}: {
  entry: RedirectEntry
  tenantId: string
  siteId: string
}) {
  const pages = entry.originatingPages ?? []
  const count = pages.length
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {count} pages link here
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Originating pages
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {pages.map((url) => (
            <li key={url}>
              <Link
                to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(url)}`}
                className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
              >
                {url}
                <ExternalLinkIcon className="size-3 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
