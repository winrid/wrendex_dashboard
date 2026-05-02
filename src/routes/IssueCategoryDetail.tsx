// Per-category drill-in (plan section 4A.2). Lands at
// /t/:tenantId/crawls/:crawlId/issues/category/:categoryId.
//
// Two backend calls:
//   - getIssuesSummary(crawlId): totals + per-AlertType breakdown for the
//     header strip and the type chip row.
//   - listCrawlAlerts(crawlId, ...): the rows, server-paginated.
//
// The `?type=` query param the BE exposes filters by a single AlertType.
// Categories aggregate many types, so we list all alerts for the crawl with
// the toolbar params (severity, pageUrlContains) and FILTER CLIENT-SIDE by
// `getCheck(alert.type).category === categoryId`. This is fine for v1 - the
// IssuesSummary header proves how many we expect to see, and DataTable is
// already paginating in the BE for size. If a single category bloats past
// the default page size the user can still use the search input to narrow.
//
// Each AlertType chip in the per-type breakdown links to the per-AlertType
// drill-in at /t/:tenantId/crawls/:crawlId/issues/type/:alertType (sec 4A.3).

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
  CategorySummary,
} from "@/api/types"
import { getCheck, getChecksInCategory } from "@/api/checkCatalog"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { AlertDetailDrawer } from "@/components/alerts-table/AlertDetailDrawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"

const DEFAULT_TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

export function IssueCategoryDetail() {
  const { tenantId = "default", crawlId = "", categoryId: rawCategoryId = "" } =
    useParams<{ tenantId: string; crawlId: string; categoryId: string }>()
  const categoryId = decodeURIComponent(rawCategoryId)
  const client = useApiClient()
  const queryClient = useQueryClient()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [toolbar, setToolbar] = useState<AlertsTableToolbarState>(DEFAULT_TOOLBAR)
  const [openAlert, setOpenAlert] = useState<Alert | null>(null)

  const summaryQ = useQuery({
    queryKey: ["crawl-issues", crawlId],
    queryFn: () => client.getIssuesSummary(crawlId),
    enabled: Boolean(crawlId),
  })

  const sevSingle =
    toolbar.severities.length === 1 ? toolbar.severities[0] : undefined

  const params = useMemo<AlertListParams>(
    () => ({
      page: pagination.pageIndex,
      size: pagination.pageSize,
      severity: sevSingle,
      pageUrlContains: toolbar.pageUrlContains || undefined,
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
    }),
    [pagination, sevSingle, toolbar.pageUrlContains, sorting],
  )

  const alertsQ = useQuery<AlertQueryResult>({
    queryKey: ["crawl-alerts", crawlId, params],
    queryFn: () => client.listCrawlAlerts(crawlId, params),
    enabled: Boolean(crawlId),
  })

  // Filter the loaded page by category client-side; the catalog is the
  // source of truth (mirrors IssuesSummaryBuilder.categoryOf on the BE).
  const rows = useMemo<Alert[]>(() => {
    const items = alertsQ.data?.items ?? []
    return items.filter(
      (a) => (getCheck(a.type)?.category ?? "Unknown") === categoryId,
    )
  }, [alertsQ.data, categoryId])

  const ignoreMut = useMutation({
    mutationFn: (alertId: string) => client.ignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert ignored")
      void queryClient.invalidateQueries({ queryKey: ["crawl-alerts", crawlId] })
      void queryClient.invalidateQueries({ queryKey: ["crawl-issues", crawlId] })
    },
    onError: () => toast.error("Could not ignore alert"),
  })

  const unignoreMut = useMutation({
    mutationFn: (alertId: string) => client.unignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert restored")
      void queryClient.invalidateQueries({ queryKey: ["crawl-alerts", crawlId] })
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

  // Find the category breakdown for the header.
  const catSummary: CategorySummary | undefined = useMemo(
    () =>
      summaryQ.data?.byCategory.find((c) => c.category === categoryId),
    [summaryQ.data, categoryId],
  )

  const totalCount = catSummary
    ? catSummary.errorCount + catSummary.warningCount + catSummary.noticeCount
    : 0

  // Type chips: prefer the breakdown from the BE (proven counts), fall back
  // to every catalog entry in the category if the BE has not seen any
  // alerts yet.
  const typeChips = useMemo(() => {
    if (catSummary) {
      return Object.entries(catSummary.byType)
        .map(([type, count]) => ({
          type,
          count,
          title: getCheck(type)?.title ?? type,
        }))
        .sort((a, b) => b.count - a.count)
    }
    return getChecksInCategory(categoryId).map((entry) => ({
      type: entry.type,
      count: 0,
      title: entry.title,
    }))
  }, [catSummary, categoryId])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to={`/t/${tenantId}/sites`}
            className="hover:underline"
          >
            Sites
          </Link>
          <span>/</span>
          <span>Crawl</span>
          <span>/</span>
          <span>Category</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{categoryId}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {totalCount} total
          </Badge>
          {catSummary?.errorCount ? (
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">
              {catSummary.errorCount} error
            </Badge>
          ) : null}
          {catSummary?.warningCount ? (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {catSummary.warningCount} warning
            </Badge>
          ) : null}
          {catSummary?.noticeCount ? (
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
              {catSummary.noticeCount} notice
            </Badge>
          ) : null}
        </div>
      </div>

      {typeChips.length > 0 ? (
        <div className="rounded-md border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Checks in this category
          </div>
          <div className="flex flex-wrap gap-2">
            {typeChips.map((chip) => (
              <Button
                key={chip.type}
                asChild
                variant="outline"
                size="sm"
              >
                <Link
                  to={`/t/${tenantId}/crawls/${crawlId}/issues/type/${encodeURIComponent(chip.type)}`}
                >
                  <span>{chip.title}</span>
                  {chip.count > 0 ? (
                    <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                      {chip.count}
                    </span>
                  ) : null}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <AlertsTable
        data={rows}
        total={rows.length}
        isLoading={alertsQ.isLoading || summaryQ.isLoading}
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
        // The crawl-scope drill-in does not know which site directly; we
        // read it lazily through the alert when needed. Pass the alert's
        // siteId via a wrapper effect kept inline here:
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
