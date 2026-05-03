// Cross-site inbox (plan section 3). Three tabs - Open / Snoozed / Resolved
// - over listSiteAlerts. The tenant may have multiple sites; the picker
// lets the user pin which site's alerts they're triaging.
//
// Filters live in component state: search by URL, severity multi-select,
// category multi-select. Severity / pageUrlContains feed straight to the
// backend; category is filtered client-side via the local check catalog
// because the API exposes filter-by-type, not filter-by-category. The
// catalog still owns category mapping (single source of truth, see
// AGENTS.md "Repo layout").
//
// Bulk actions (Phase 2 iter 3 FE-D): row selection wired through
// AlertsTable; once 1+ rows are selected the BulkActionToolbar renders
// above the table with Ignore / Snooze / Assign / Unignore options. Bulk
// methods on the typed client - bulkIgnore / bulkSnooze / bulkAssign /
// bulkUnignore - hit /api/bulk/alerts/* (BE iter 3).
//
// Per-row actions: a kebab dropdown exposes Snooze 24h / Snooze 7d / Assign
// / Acknowledge for individual rows that don't need bulk semantics.
//
// Deep links: ?siteId=, ?status=, ?crawlRunId= seed initial state. siteId
// overrides the auto-pick-first-site default; status switches the active
// tab (status=SNOOZED selects the Snoozed tab); crawlRunId narrows alerts
// to that single crawl (BE Phase 1 fix added the ?crawlRunId= filter on
// /api/sites/{siteId}/alerts).

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import type {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  Alert,
  AlertListParams,
  AlertQueryResult,
  AlertStatus,
  BulkActionResponse,
} from "@/api/types"
import { getAllCategories, getCheck } from "@/api/checkCatalog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { AlertDetailDrawer } from "@/components/alerts-table/AlertDetailDrawer"
import {
  BulkActionToolbar,
  membershipsToMembers,
} from "@/components/alerts-table/BulkActionToolbar"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { SavedViewMenu } from "@/components/saved-views/SavedViewMenu"
import { consumePendingSavedView } from "@/components/saved-views/handoff"
import { siteDisplayName } from "@/lib/format"

type TabKey = "open" | "snoozed" | "resolved"

/** Stable React Router URL pattern for SavedView.route on the Inbox surface.
 *  Bound to the same path the router mounts under. */
const INBOX_ROUTE = "/inbox"

type InboxFilter = {
  tab: TabKey
  siteId: string | null
  pagination: PaginationState
  sorting: SortingState
  toolbar: AlertsTableToolbarState
}

function isInboxFilter(v: unknown): v is InboxFilter {
  if (!v || typeof v !== "object") return false
  const o = v as Partial<InboxFilter>
  return (
    typeof o.tab === "string" &&
    (o.siteId === null || typeof o.siteId === "string") &&
    Boolean(o.pagination) &&
    Array.isArray(o.sorting) &&
    Boolean(o.toolbar)
  )
}

// SNOOZED is a typed status on the wire (BE iter 3 will land it). The cast
// keeps the param wiring simple; the BE accepts any AlertStatus for the
// ?status= query param (Phase 1 fix routed through the AlertListParams
// shape).
const SNOOZED_STATUS = "SNOOZED" as unknown as AlertStatus

function statusForTab(tab: TabKey): AlertStatus | undefined {
  if (tab === "open") return "OPEN"
  if (tab === "resolved") return "RESOLVED"
  if (tab === "snoozed") return SNOOZED_STATUS
  return undefined
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

function snoozeUntil(durationHours: number): string {
  const ms = durationHours * 60 * 60 * 1000
  return new Date(Date.now() + ms).toISOString()
}

function selectedIds(selection: RowSelectionState): string[] {
  return Object.keys(selection).filter((k) => selection[k] === true)
}

export function Inbox() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const [searchParams] = useSearchParams()
  const initialSiteId = searchParams.get("siteId")
  const initialTab = tabFromStatusParam(searchParams.get("status"))
  const crawlRunIdParam = searchParams.get("crawlRunId") || undefined
  const client = useApiClient()
  const queryClient = useQueryClient()
  const auth = useAuth()

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [siteId, setSiteId] = useState<string | null>(initialSiteId)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [toolbar, setToolbar] = useState<AlertsTableToolbarState>(DEFAULT_TOOLBAR)
  const [openAlert, setOpenAlert] = useState<Alert | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Sidebar -> route handoff (saved-view group on AppShell). Apply once on
  // mount if the sidebar stashed an Inbox filter for us.
  useEffect(() => {
    const pending = consumePendingSavedView(INBOX_ROUTE)
    if (isInboxFilter(pending)) {
      setTab(pending.tab)
      setSiteId(pending.siteId)
      setPagination(pending.pagination)
      setSorting(pending.sorting)
      setToolbar(pending.toolbar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentSavedFilter = useMemo<InboxFilter>(
    () => ({ tab, siteId, pagination, sorting, toolbar }),
    [tab, siteId, pagination, sorting, toolbar],
  )

  const onApplySavedView = (raw: unknown) => {
    if (!isInboxFilter(raw)) return
    setTab(raw.tab)
    setSiteId(raw.siteId)
    setPagination(raw.pagination)
    setSorting(raw.sorting)
    setToolbar(raw.toolbar)
  }

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
    queryFn: async () => {
      try {
        return await client.listSiteAlerts(siteId!, params)
      } catch (e) {
        // Snoozed bucket gracefully degrades when the BE does not yet
        // recognise ?status=SNOOZED (iter 3 ships it).
        if (
          tab === "snoozed" &&
          e instanceof ApiError &&
          (e.status === 400 || e.status === 404)
        ) {
          return {
            items: [],
            total: 0,
            page: 0,
            size: pagination.pageSize,
          }
        }
        throw e
      }
    },
    enabled: Boolean(siteId),
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

  // Clear row selection when the source data changes (filters / pagination
  // / tab) so we don't leave stale selected ids dangling across pages.
  useEffect(() => {
    setRowSelection({})
  }, [siteId, tab, pagination.pageIndex, toolbar])

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

  const snoozeRowMut = useMutation({
    mutationFn: (input: { id: string; hours: number }) =>
      client.snoozeAlert(input.id, snoozeUntil(input.hours)),
    onSuccess: (_data, vars) => {
      toast.success(`Alert snoozed for ${vars.hours >= 24 ? `${vars.hours / 24}d` : `${vars.hours}h`}`)
      void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 404) {
        toast.error("Snooze endpoint not yet available")
        return
      }
      toast.error("Could not snooze alert")
    },
  })

  const assignRowMut = useMutation({
    mutationFn: (input: { id: string; userId: string | null }) =>
      client.assignAlert(input.id, input.userId),
    onSuccess: () => {
      toast.success("Alert assigned")
      void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 404) {
        toast.error("Assign endpoint not yet available")
        return
      }
      toast.error("Could not assign alert")
    },
  })

  const acknowledgeRowMut = useMutation({
    mutationFn: (alertId: string) => client.ignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert acknowledged")
      void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
    },
    onError: () => toast.error("Could not acknowledge alert"),
  })

  // ---- Bulk mutations ------------------------------------------------------

  const onBulkSettled = (resp: BulkActionResponse | undefined) => {
    const n = resp?.updatedCount ?? selectedIds(rowSelection).length
    toast.success(`${n} alerts updated`)
    setRowSelection({})
    void queryClient.invalidateQueries({ queryKey: ["site-alerts"] })
  }

  const onBulkError = (e: unknown) => {
    if (isApiError(e) && e.status === 404) {
      toast.error("Bulk endpoint not yet available")
      return
    }
    toast.error("Bulk action failed")
  }

  const bulkIgnoreMut = useMutation({
    mutationFn: (ids: string[]) => client.bulkIgnore(ids),
    onSuccess: onBulkSettled,
    onError: onBulkError,
  })

  const bulkUnignoreMut = useMutation({
    mutationFn: (ids: string[]) => client.bulkUnignore(ids),
    onSuccess: onBulkSettled,
    onError: onBulkError,
  })

  const bulkSnoozeMut = useMutation({
    mutationFn: (input: { ids: string[]; until: string }) =>
      client.bulkSnooze(input.ids, input.until),
    onSuccess: onBulkSettled,
    onError: onBulkError,
  })

  const bulkAssignMut = useMutation({
    mutationFn: (input: { ids: string[]; userId: string | null }) =>
      client.bulkAssign(input.ids, input.userId),
    onSuccess: onBulkSettled,
    onError: onBulkError,
  })

  const sites = sitesQ.data ?? []
  const showSitePicker = sites.length > 1
  const selectedAlertIds = useMemo(
    () => selectedIds(rowSelection),
    [rowSelection],
  )

  // Tenant member options for the bulk Assign dropdown. There is no
  // listTenantMembers endpoint yet (BE iter 3+); fall back to the active
  // user only.
  const activeMembership = auth.memberships.find((m) => m.tenantId === tenantId)
  const memberOptions = useMemo(
    () => membershipsToMembers(activeMembership, auth.user ?? undefined),
    [activeMembership, auth.user],
  )

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
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    setRowSelection((prev) =>
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
        <div className="flex items-center gap-2">
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
          <SavedViewMenu
            siteId={siteId ?? undefined}
            route={INBOX_ROUTE}
            currentFilter={currentSavedFilter}
            onApply={onApplySavedView}
          />
          {siteId ? (
            <CsvExportButton
              path={`/api/sites/${siteId}/alerts`}
              params={{
                page: params.page,
                size: params.size,
                severity: params.severity,
                status: params.status,
                pageUrlContains: params.pageUrlContains,
                crawlRunId: params.crawlRunId,
              }}
              filename={`inbox-${siteId}.csv`}
            />
          ) : null}
        </div>
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
          {renderBody()}
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
    const bulkPending =
      bulkIgnoreMut.isPending ||
      bulkUnignoreMut.isPending ||
      bulkSnoozeMut.isPending ||
      bulkAssignMut.isPending
    return (
      <div className="space-y-3">
        <BulkActionToolbar
          count={selectedAlertIds.length}
          ignoredBucket={tab === "snoozed" || tab === "resolved"}
          onClear={() => setRowSelection({})}
          onIgnore={() => bulkIgnoreMut.mutate(selectedAlertIds)}
          onUnignore={() => bulkUnignoreMut.mutate(selectedAlertIds)}
          onSnooze={(hours) =>
            bulkSnoozeMut.mutate({
              ids: selectedAlertIds,
              until: snoozeUntil(hours),
            })
          }
          onAssign={(userId) =>
            bulkAssignMut.mutate({ ids: selectedAlertIds, userId })
          }
          members={memberOptions}
          pending={bulkPending}
        />
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
          onSnooze24h={(a) =>
            snoozeRowMut.mutate({ id: a.id, hours: 24 })
          }
          onSnooze7d={(a) =>
            snoozeRowMut.mutate({ id: a.id, hours: 24 * 7 })
          }
          onAssign={(a) => {
            const me = auth.user?.id ?? null
            assignRowMut.mutate({ id: a.id, userId: me })
          }}
          onAcknowledge={(a) => acknowledgeRowMut.mutate(a.id)}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={onRowSelectionChange}
        />
      </div>
    )
  }
}
