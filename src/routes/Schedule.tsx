// Per-tenant schedule overview (plan section 7). Lands at
// /t/:tenantId/schedule. Lists every site in the tenant with its cadence,
// next-run timestamp, and a deep link into SiteSettings where the cadence
// is edited. The route exists so the Schedule sidebar entry has a real
// destination; per-site editing still lives in SiteSettings (the BE only
// exposes per-site PUT /api/sites/{siteId}/schedule).

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type { Site } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { formatCadence, relativeTime, siteDisplayName } from "@/lib/format"

function cadenceBadgeClass(cadence: string | null | undefined): string {
  if (!cadence || cadence === "PAUSED") return "bg-muted text-muted-foreground"
  switch (cadence) {
    case "DAILY":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    case "HOURLY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "CONTINUOUS":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function Schedule() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const client = useApiClient()

  const sitesQ = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: () => client.listSitesByTenant(tenantId),
    enabled: Boolean(tenantId),
  })

  const columns = useMemo<ColumnDef<Site>[]>(
    () => [
      {
        id: "site",
        header: "Site",
        accessorKey: "url",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/t/${tenantId}/sites/${row.original.id}`}
              className="block truncate font-medium hover:underline"
            >
              {siteDisplayName(row.original.url)}
            </Link>
            <span
              className="block truncate font-mono text-xs text-muted-foreground"
              title={row.original.url}
            >
              {row.original.url}
            </span>
          </div>
        ),
      },
      {
        id: "cadence",
        header: "Cadence",
        accessorKey: "cadence",
        cell: ({ row }) => (
          <Badge className={cadenceBadgeClass(row.original.cadence)}>
            {formatCadence(row.original.cadence)}
          </Badge>
        ),
      },
      {
        id: "nextRunAt",
        header: "Next run",
        accessorKey: "nextRunAt",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {relativeTime(row.original.nextRunAt)}
          </span>
        ),
      },
      {
        id: "lastCrawlAt",
        header: "Last crawl",
        accessorKey: "lastCrawlAt",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {relativeTime(row.original.lastCrawlAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild size="sm" variant="outline">
            <Link to={`/t/${tenantId}/sites/${row.original.id}/settings`}>
              Edit schedule
            </Link>
          </Button>
        ),
      },
    ],
    [tenantId],
  )

  const sites = sitesQ.data ?? []
  const isEmpty = !sitesQ.isLoading && sites.length === 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Cadence and next-run for every site in this workspace. Edit a
          schedule from the per-site settings page.
        </p>
      </div>

      {isEmpty ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No sites yet.{" "}
          <Link
            to={`/t/${tenantId}/sites`}
            className="underline hover:text-foreground"
          >
            Add a site
          </Link>{" "}
          to start scheduling crawls.
        </div>
      ) : (
        <DataTable<Site>
          columns={columns}
          data={sites}
          isLoading={sitesQ.isLoading}
          emptyState={
            sitesQ.isError ? (
              <span className="text-red-600 dark:text-red-400">
                Could not load sites.
              </span>
            ) : (
              "No sites yet."
            )
          }
        />
      )}
    </div>
  )
}
