// Per-AlertType drill-in (plan section 4A.3). Lands at
// /t/:tenantId/crawls/:crawlId/issues/type/:alertType.
//
// Header pulls catalog content for the type (title / severity / why this
// matters / how to fix). Body uses listCrawlAlerts(crawlId, {type: ...})
// since iter 1 BE-2 added the `?type=` filter. Each row shows the page URL
// plus the alert's message / detail expanded inline so the user can scan
// without opening the drawer; clicking the row still opens the detail
// drawer for affected URLs and the ignore action.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type {
  Alert,
  AlertListParams,
  AlertQueryResult,
  AlertType,
} from "@/api/types"
import { getCheck } from "@/api/checkCatalog"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { AlertDetailDrawer } from "@/components/alerts-table/AlertDetailDrawer"
import { Badge } from "@/components/ui/badge-fallback"
import { cn } from "@/lib/utils"

const DEFAULT_TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

function severityBadgeClass(sev: "ERROR" | "WARNING" | "NOTICE"): string {
  switch (sev) {
    case "ERROR":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    case "WARNING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "NOTICE":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  }
}

export function IssueTypeDetail() {
  const { tenantId = "default", crawlId = "", alertType: rawType = "" } =
    useParams<{ tenantId: string; crawlId: string; alertType: string }>()
  const alertType = decodeURIComponent(rawType) as AlertType
  const client = useApiClient()
  const queryClient = useQueryClient()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [toolbar, setToolbar] = useState<AlertsTableToolbarState>(DEFAULT_TOOLBAR)
  const [openAlert, setOpenAlert] = useState<Alert | null>(null)

  const sevSingle =
    toolbar.severities.length === 1 ? toolbar.severities[0] : undefined

  const params = useMemo<AlertListParams>(
    () => ({
      page: pagination.pageIndex,
      size: pagination.pageSize,
      severity: sevSingle,
      pageUrlContains: toolbar.pageUrlContains || undefined,
      type: alertType,
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
    }),
    [pagination, sevSingle, toolbar.pageUrlContains, alertType, sorting],
  )

  const alertsQ = useQuery<AlertQueryResult>({
    queryKey: ["crawl-alerts-by-type", crawlId, params],
    queryFn: () => client.listCrawlAlerts(crawlId, params),
    enabled: Boolean(crawlId),
  })

  const ignoreMut = useMutation({
    mutationFn: (alertId: string) => client.ignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert ignored")
      void queryClient.invalidateQueries({
        queryKey: ["crawl-alerts-by-type", crawlId],
      })
    },
    onError: () => toast.error("Could not ignore alert"),
  })

  const unignoreMut = useMutation({
    mutationFn: (alertId: string) => client.unignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert restored")
      void queryClient.invalidateQueries({
        queryKey: ["crawl-alerts-by-type", crawlId],
      })
    },
    onError: () => toast.error("Could not unignore alert"),
  })

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

  const entry = getCheck(alertType)
  const items = alertsQ.data?.items ?? []
  const total = alertsQ.data?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/t/${tenantId}/sites`} className="hover:underline">
            Sites
          </Link>
          <span>/</span>
          <span>Crawl</span>
          <span>/</span>
          {entry ? (
            <Link
              to={`/t/${tenantId}/crawls/${crawlId}/issues/category/${encodeURIComponent(entry.category)}`}
              className="hover:underline"
            >
              {entry.category}
            </Link>
          ) : (
            <span>Type</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {entry?.title ?? alertType}
          </h1>
          {entry ? (
            <Badge className={cn(severityBadgeClass(entry.severityDefault))}>
              {entry.severityDefault}
            </Badge>
          ) : null}
          <Badge variant="outline">{total} affected</Badge>
        </div>
      </div>

      {entry ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-card p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why this matters
            </div>
            <p className="text-sm leading-relaxed">{entry.description}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              How to fix
            </div>
            <p className="text-sm leading-relaxed">{entry.howToFix}</p>
          </div>
        </div>
      ) : null}

      {/* Inline-expanded list. AlertsTable shows the URL row; the per-alert
       *  message + detail is rendered as a leading strip above the table
       *  so the type-specific context is visible without opening the
       *  drawer. */}
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="rounded-md border bg-card p-3 text-sm"
            >
              <div className="font-mono text-xs text-muted-foreground">
                {a.pageUrl}
              </div>
              {a.message ? (
                <div className="mt-1">{a.message}</div>
              ) : null}
              {a.detail ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.detail}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <AlertsTable
        data={items}
        total={total}
        isLoading={alertsQ.isLoading}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        toolbar={toolbar}
        onToolbarChange={setToolbar}
        hideCategoryFilter
        hideStatusFilter
        onIgnore={(a) => ignoreMut.mutate(a.id)}
        onUnignore={(a) => unignoreMut.mutate(a.id)}
        onRowClick={(a) => setOpenAlert(a)}
      />

      <AlertDetailDrawer
        alert={openAlert}
        open={openAlert !== null}
        onOpenChange={(o) => {
          if (!o) setOpenAlert(null)
        }}
        tenantId={tenantId}
        siteId={openAlert?.siteId ?? ""}
        onIgnore={(a) => {
          ignoreMut.mutate(a.id)
          setOpenAlert(null)
        }}
        onUnignore={(a) => {
          unignoreMut.mutate(a.id)
          setOpenAlert(null)
        }}
      />
    </div>
  )
}
