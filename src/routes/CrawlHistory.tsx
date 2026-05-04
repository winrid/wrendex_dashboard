// Crawl history page (plan section 4A.1). Lives at
// /t/:tenantId/sites/:siteId/crawls. Bound to listCrawlLog so we get the
// finishedAt + duration fields the in-flight CrawlRun doesn't carry. The
// "Compare to..." button stubs a toast; that lands in iter 5 with the diff
// endpoint (plan section 4A.4).

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { isApiError } from "@/api/client"
import type { CrawlLogEntry } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CrawlRunningView } from "@/components/site-detail/CrawlRunningView"
import { formatDurationMs, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type CrawlHistoryRow = CrawlLogEntry & {
  /** Score change vs the previous (older) row. null on the oldest row. */
  delta: number | null
}

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "running":
    case "queued":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    case "failed":
    case "error":
    case "cancelled":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function deltaClass(delta: number | null) {
  if (delta == null || delta === 0) return "text-muted-foreground"
  if (delta > 0) return "text-emerald-600 dark:text-emerald-400"
  return "text-red-600 dark:text-red-400"
}

export function CrawlHistory() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const client = useApiClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [runningCrawlId, setRunningCrawlId] = useState<string | null>(null)

  const logQ = useQuery({
    queryKey: ["crawl-log", siteId],
    queryFn: () => client.listCrawlLog(siteId),
    enabled: Boolean(siteId),
  })

  const startMut = useMutation({
    mutationFn: () => client.startCrawlAsync(siteId),
    onSuccess: (run) => setRunningCrawlId(run.id),
    onError: (err) => {
      if (
        isApiError(err) &&
        err.status === 409 &&
        err.body &&
        typeof err.body === "object"
      ) {
        const live = err.body as { id?: string }
        if (live.id) {
          setRunningCrawlId(live.id)
          toast.info("A crawl is already running for this site.")
          return
        }
      }
      toast.error("Could not start crawl")
    },
  })

  const rows: CrawlHistoryRow[] = useMemo(() => {
    const entries = logQ.data ?? []
    // listCrawlLog returns newest-first per the iter 2 contract; deltas
    // are score(i) - score(i+1) (current minus previous-older).
    return entries.map((entry, i) => {
      const prev = entries[i + 1]
      const delta = prev != null ? entry.healthScore - prev.healthScore : null
      return { ...entry, delta }
    })
  }, [logQ.data])

  const columns: ColumnDef<CrawlHistoryRow>[] = [
    {
      accessorKey: "startedAt",
      header: "Started",
      cell: ({ row }) => (
        <span title={row.original.startedAt}>
          {relativeTime(row.original.startedAt)}
        </span>
      ),
    },
    {
      accessorKey: "finishedAt",
      header: "Finished",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {relativeTime(row.original.finishedAt)}
        </span>
      ),
    },
    {
      accessorKey: "durationMs",
      header: "Duration",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDurationMs(row.original.durationMs ?? null)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={statusVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "pagesDiscovered",
      header: "Discovered",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.pagesDiscovered.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "pagesCrawled",
      header: "Crawled",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.pagesCrawled.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "healthScore",
      header: "Score",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {row.original.healthScore}
        </span>
      ),
    },
    {
      id: "delta",
      header: "Delta",
      cell: ({ row }) => {
        const d = row.original.delta
        return (
          <span className={cn("tabular-nums", deltaClass(d))}>
            {d == null ? "-" : d > 0 ? `+${d}` : d}
          </span>
        )
      },
    },
    {
      accessorKey: "errorCount",
      header: "Errors",
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums",
            row.original.errorCount > 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground",
          )}
        >
          {row.original.errorCount}
        </span>
      ),
    },
    {
      accessorKey: "warningCount",
      header: "Warnings",
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums",
            row.original.warningCount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {row.original.warningCount}
        </span>
      ),
    },
    {
      accessorKey: "noticeCount",
      header: "Notices",
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums",
            row.original.noticeCount > 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted-foreground",
          )}
        >
          {row.original.noticeCount}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        // Earlier crawls (older than this one) are the "before" candidates;
        // we cap to the previous 5 to keep the dropdown short.
        const idx = rows.findIndex((r) => r.id === row.original.id)
        const previous = idx >= 0 ? rows.slice(idx + 1, idx + 6) : []
        return (
          <div className="flex gap-1">
            <Button asChild size="xs" variant="ghost">
              <Link
                to={`/t/${tenantId}/sites/${siteId}/crawls/${row.original.id}`}
              >
                View
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="xs"
                  variant="ghost"
                  data-testid="compare-to-trigger"
                  disabled={previous.length === 0}
                >
                  Compare to...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Compare to a previous crawl</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {previous.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No previous crawls available
                  </DropdownMenuItem>
                ) : (
                  previous.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() =>
                        navigate(
                          `/t/${tenantId}/sites/${siteId}/compare?a=${p.id}&b=${row.original.id}`,
                        )
                      }
                    >
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(p.startedAt)} - score {p.healthScore}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const isEmpty = !logQ.isLoading && rows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Crawl history
          </h1>
          <p className="text-sm text-muted-foreground">
            Every crawl that has run for this site, newest first.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites/${siteId}`}>Back to site</Link>
        </Button>
      </div>
      {runningCrawlId ? (
        <CrawlRunningView
          crawlRunId={runningCrawlId}
          onComplete={() => {
            setRunningCrawlId(null)
            void queryClient.invalidateQueries({
              queryKey: ["crawl-log", siteId],
            })
            void queryClient.invalidateQueries({
              queryKey: ["site-runs", siteId],
            })
            toast.success("Crawl complete")
          }}
        />
      ) : null}
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-md border bg-card p-12 text-center">
          <div className="text-sm text-muted-foreground">
            No crawls have run for this site yet.
          </div>
          <Button
            disabled={startMut.isPending}
            onClick={() => startMut.mutate()}
          >
            {startMut.isPending ? "Starting..." : "Run your first audit"}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={logQ.isLoading}
          emptyState="No crawls yet."
        />
      )}
    </div>
  )
}
