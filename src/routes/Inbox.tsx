// Cross-site inbox (plan section 3). Three tabs - Open / Snoozed / Resolved
// - over listSiteAlerts. Snoozed renders a "coming soon" stub for now; the
// backend snooze surface lands later. The tenant may have multiple sites;
// the picker lets the user pin which site's alerts they're triaging.
//
// Filters live in component state: search by URL, severity multi-select,
// category multi-select. Severity / pageUrlContains feed straight to the
// backend; category is filtered client-side via the local check catalog
// because the API exposes filter-by-type, not filter-by-category. The
// catalog still owns category mapping (single source of truth, see
// AGENTS.md "Repo layout").
//
// Deep links: ?siteId=, ?status=, ?crawlRunId= seed initial state. siteId
// overrides the auto-pick-first-site default; status switches the active
// tab; crawlRunId narrows alerts to that single crawl (BE Phase 1 fix
// added the ?crawlRunId= filter on /api/sites/{siteId}/alerts).

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type {
  Alert,
  AlertListParams,
  AlertQueryResult,
  AlertStatus,
} from "@/api/types"
import { getAllCategories, getCheck } from "@/api/checkCatalog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { AlertDetailDrawer } from "@/components/alerts-table/AlertDetailDrawer"
import { siteDisplayName } from "@/lib/format"

type TabKey = "open" | "snoozed" | "resolved"

function statusForTab(tab: TabKey): AlertStatus | undefined {
  if (tab === "open") return "OPEN"
  if (tab === "resolved") return "RESOLVED"
  return undefined // snoozed - no BE status yet
}

function tabFromStatusParam(raw: string | null): TabKey {
  if (!raw) return "open"
  const upper = raw.toUpperCase()
  if (upper === "RESOLVED") return "resolved"
  if (upper === "SNOOZED" || upper === "IGNORED") return "snoozed"
  return "open"
}

const DEFAULT_TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

export function Inbox() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const [searchParams] = useSearchParams()
  const initialSiteId = searchParams.get("siteId")
  const initialTab = tabFromStatusParam(searchParams.get("status"))
  const crawlRunIdParam = searchParams.get("crawlRunId") || undefined
  const client = useApiClient()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [siteId, setSiteId] = useState<string | null>(initialSiteId)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [toolbar, setToolbar] = useState<AlertsTableToolbarState>(DEFAULT_TOOLBAR)
  const [openAlert, setOpenAlert] = useState<Alert | null>(null)

  const sitesQ = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: () => client.listSitesByTenant(tenantId),
    enabled: Boolean(tenantId),
  })

  // Auto-select the first site once loaded if the user has not picked one
  // AND no ?siteId= URL param was provided.
  useEffect(() => {
    if (siteId) return
    const first = sitesQ.data?.[0]
    if (first) setSiteId(first.id)
  }, [sitesQ.data, siteId])

  const sevSingle = toolbar.severities.length === 1 ? toolbar.severities[0] : undefined
  const tabStatus = statusForTab(tab)

  const params = useMemo<AlertListParams>(
    () => ({
      page: pagination.pageIndex,
      size: pagination.pageSize,
      severity: sevSingle,
      pageUrlContains: toolbar.pageUrlContains || undefined,
      status: tabStatus,
      crawlRunId: crawlRunIdParam,
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
    }),
    [pagination, sevSingle, toolbar.pageUrlContains, tabStatus, crawlRunIdParam, sorting],
  )

  const alertsQ = useQuery<AlertQueryResult>({
    queryKey: ["site-alerts", siteId, params],
    queryFn: () => client.listSiteAlerts(siteId!, params),
    enabled: Boolean(siteId) && tab !== "snoozed",
  })

  const filtered = useMemo<Alert[]>(() => {
    const items = alertsQ.data?.items ?? []
    if (toolbar.categories.length === 0) return items
    const set = new Set(toolbar.categories)
    return items.filter((a) => {
      const cat = getCheck(a.type)?.category ?? "Unknown"
      return set.has(cat)
    })
  }, [alertsQ.data, toolbar.categories])

  const ignoreMut = useMutation({
    mutationFn: (alertId: string) => client.ignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert ignored")
      void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
    },
    onError: () => toast.error("Could not ignore alert"),
  })

  const unignoreMut = useMutation({
    mutationFn: (alertId: string) => client.unignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert restored")
      void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
    },
    onError: () => toast.error("Could not unignore alert"),
  })

  const sites = sitesQ.data ?? []
  const showSitePicker = sites.length > 1

  // When tab changes, reset pagination so the user lands on page 1 of the
  // new status bucket.
  const onTabChange = (next: string) => {
    setTab(next as TabKey)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Review and triage alerts across your sites.
          </p>
        </div>
        {showSitePicker ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Site</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={siteId ?? ""}
              onChange={(e) => setSiteId(e.target.value)}
              aria-label="Site"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {siteDisplayName(s.url)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {renderBody()}
        </TabsContent>
        <TabsContent value="snoozed" className="mt-4">
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            Snoozed alerts are coming soon.
          </div>
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          {renderBody()}
        </TabsContent>
      </Tabs>

      <AlertDetailDrawer
        alert={openAlert}
        open={openAlert !== null}
        onOpenChange={(o) => {
          if (!o) setOpenAlert(null)
        }}
        tenantId={tenantId}
        siteId={siteId ?? ""}
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

  function renderBody() {
    if (sitesQ.isLoading) {
      return (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Loading sites...
        </div>
      )
    }
    if (sites.length === 0) {
      return (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No sites yet. Add a site to start receiving alerts.
        </div>
      )
    }
    if (!siteId) {
      return (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Select a site...
        </div>
      )
    }
    return (
      <AlertsTable
        data={filtered}
        total={alertsQ.data?.total ?? 0}
        isLoading={alertsQ.isLoading}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        toolbar={toolbar}
        onToolbarChange={setToolbar}
        categoryOptions={getAllCategories()}
        onIgnore={(a) => ignoreMut.mutate(a.id)}
        onUnignore={(a) => unignoreMut.mutate(a.id)}
        onRowClick={(a) => setOpenAlert(a)}
      />
    )
  }
}
