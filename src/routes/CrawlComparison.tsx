// Crawl comparison view (plan section 4A.4). Lands at
// /t/:tenantId/sites/:siteId/compare?a={crawlIdA}&b={crawlIdB}.
//
// Three-column layout: "before" (a), "after" (b), and "delta" (b - a).
// Sources:
//   - listCrawlsBySite: pull both CrawlRuns to render side-by-side health
//     score, severity counts, and pages crawled.
//   - getIssuesSummary on each crawlId: per-category delta (we diff client-
//     side because the BE doesn't expose a category-level diff endpoint).
//   - getCrawlDiff(b, {against: a}): the New / Resolved / Persisted alert
//     partitions, each rendered through the shared AlertsTable.
//
// CSV export: the BE is shipping ?format=csv on /api/crawls/{b}/diff?against={a}
// in iter 2 round 2. We render the button now so the FE is wired the moment
// the BE lands; if it 404s the user just sees a download error toast.

import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import type {
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type {
  Alert,
  CategorySummary,
  CrawlDiff,
  CrawlRun,
  IssuesSummary,
} from "@/api/types"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { Badge } from "@/components/ui/badge-fallback"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/format"

const EMPTY_TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

function deltaLabel(delta: number): string {
  if (delta === 0) return "0"
  return delta > 0 ? `+${delta}` : `${delta}`
}

function deltaClass(delta: number, betterIsHigher: boolean): string {
  if (delta === 0) return "text-muted-foreground"
  // For health score, higher is better -> +delta is green.
  // For severity counts, lower is better -> -delta is green.
  const positiveIsGood = betterIsHigher ? delta > 0 : delta < 0
  return positiveIsGood
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400"
}

function categoryDelta(
  before: IssuesSummary | undefined,
  after: IssuesSummary | undefined,
): {
  category: string
  errorDelta: number
  warningDelta: number
  noticeDelta: number
}[] {
  const map = new Map<
    string,
    { error: number; warning: number; notice: number }
  >()
  const seed = (s: IssuesSummary | undefined, sign: 1 | -1) => {
    if (!s) return
    for (const c of s.byCategory) {
      const cur = map.get(c.category) ?? { error: 0, warning: 0, notice: 0 }
      cur.error += sign * c.errorCount
      cur.warning += sign * c.warningCount
      cur.notice += sign * c.noticeCount
      map.set(c.category, cur)
    }
  }
  // After contributes positively, before subtracts -> positive value means
  // the category got worse.
  seed(before, -1)
  seed(after, 1)
  const out = Array.from(map.entries()).map(([category, v]) => ({
    category,
    errorDelta: v.error,
    warningDelta: v.warning,
    noticeDelta: v.notice,
  }))
  // Sort by absolute total magnitude desc (worst regressions first).
  out.sort((a, b) => {
    const aMag =
      Math.abs(a.errorDelta) + Math.abs(a.warningDelta) + Math.abs(a.noticeDelta)
    const bMag =
      Math.abs(b.errorDelta) + Math.abs(b.warningDelta) + Math.abs(b.noticeDelta)
    return bMag - aMag
  })
  return out
}

export function CrawlComparison() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const [search] = useSearchParams()
  const a = search.get("a") ?? ""
  const b = search.get("b") ?? ""
  const client = useApiClient()

  const runsQ = useQuery<CrawlRun[]>({
    queryKey: ["site-runs", siteId],
    queryFn: () => client.listCrawlsBySite(siteId),
    enabled: Boolean(siteId),
  })

  const summaryAQ = useQuery<IssuesSummary>({
    queryKey: ["issues-summary", a],
    queryFn: () => client.getIssuesSummary(a),
    enabled: Boolean(a),
  })
  const summaryBQ = useQuery<IssuesSummary>({
    queryKey: ["issues-summary", b],
    queryFn: () => client.getIssuesSummary(b),
    enabled: Boolean(b),
  })

  const diffQ = useQuery<CrawlDiff>({
    queryKey: ["crawl-diff", b, a],
    queryFn: () => client.getCrawlDiff(b, { against: a }),
    enabled: Boolean(a) && Boolean(b),
  })

  const runA = runsQ.data?.find((r) => r.id === a) ?? null
  const runB = runsQ.data?.find((r) => r.id === b) ?? null

  const categoryDeltas = useMemo(
    () => categoryDelta(summaryAQ.data, summaryBQ.data),
    [summaryAQ.data, summaryBQ.data],
  )

  if (!a || !b) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        Select two crawls to compare. Open the crawl history and use
        &quot;Compare to...&quot;.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/t/${tenantId}/sites/${siteId}`} className="hover:underline">
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
          <span>Compare</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compare crawls
            </h1>
            <p className="text-sm text-muted-foreground">
              Side-by-side health, category, and per-alert deltas.
            </p>
          </div>
          <CsvExportButton
            path={`/api/crawls/${b}/diff`}
            params={{ against: a }}
            filename={`crawl-diff-${a}-vs-${b}.csv`}
          />
        </div>
      </div>

      <ComparisonHeader runA={runA} runB={runB} />

      <Card data-testid="category-delta-card">
        <CardHeader>
          <CardTitle>Per-category delta</CardTitle>
          <CardDescription>
            Issue counts in each category, after minus before.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryAQ.isLoading || summaryBQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : categoryDeltas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No category differences between these crawls.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {categoryDeltas.map((row) => (
                <li
                  key={row.category}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{row.category}</span>
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <span className={cn(deltaClass(row.errorDelta, false))}>
                      <span className="inline-block size-2 rounded-full bg-red-500 mr-1" />
                      {deltaLabel(row.errorDelta)} errors
                    </span>
                    <span className={cn(deltaClass(row.warningDelta, false))}>
                      <span className="inline-block size-2 rounded-full bg-amber-500 mr-1" />
                      {deltaLabel(row.warningDelta)} warnings
                    </span>
                    <span className={cn(deltaClass(row.noticeDelta, false))}>
                      <span className="inline-block size-2 rounded-full bg-blue-500 mr-1" />
                      {deltaLabel(row.noticeDelta)} notices
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DiffAlertsTabs
        diff={diffQ.data}
        isLoading={diffQ.isLoading}
        isError={diffQ.isError}
      />
    </div>
  )
}

function ComparisonHeader({
  runA,
  runB,
}: {
  runA: CrawlRun | null
  runB: CrawlRun | null
}) {
  const scoreDelta =
    runA && runB ? runB.healthScore - runA.healthScore : 0
  const errorDelta =
    runA && runB ? runB.errorCount - runA.errorCount : 0
  const warningDelta =
    runA && runB ? runB.warningCount - runA.warningCount : 0
  const noticeDelta =
    runA && runB ? runB.noticeCount - runA.noticeCount : 0
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="comparison-header">
      <RunSummaryCard label="Before" run={runA} />
      <RunSummaryCard label="After" run={runB} />
      <Card data-testid="comparison-delta">
        <CardHeader>
          <CardTitle>Delta</CardTitle>
          <CardDescription>After minus before.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <DeltaRow
            label="Health score"
            value={scoreDelta}
            betterIsHigher
          />
          <DeltaRow label="Errors" value={errorDelta} betterIsHigher={false} />
          <DeltaRow
            label="Warnings"
            value={warningDelta}
            betterIsHigher={false}
          />
          <DeltaRow
            label="Notices"
            value={noticeDelta}
            betterIsHigher={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function RunSummaryCard({
  label,
  run,
}: {
  label: string
  run: CrawlRun | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>
          {run ? relativeTime(run.startedAt) : "Loading..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Health score</span>
          <span className="text-2xl font-semibold tabular-nums">
            {run ? run.healthScore : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pages crawled</span>
          <span className="tabular-nums">
            {run ? run.pagesCrawled.toLocaleString() : "-"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">
            {run ? `${run.errorCount} err` : "-"}
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {run ? `${run.warningCount} warn` : "-"}
          </Badge>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
            {run ? `${run.noticeCount} notice` : "-"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function DeltaRow({
  label,
  value,
  betterIsHigher,
}: {
  label: string
  value: number
  betterIsHigher: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-medium", deltaClass(value, betterIsHigher))}>
        {deltaLabel(value)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New / Resolved / Persisted alerts via the shared AlertsTable.
// ---------------------------------------------------------------------------

type DiffTab = "new" | "resolved" | "persisted"

function DiffAlertsTabs({
  diff,
  isLoading,
  isError,
}: {
  diff: CrawlDiff | undefined
  isLoading: boolean
  isError: boolean
}) {
  const [tab, setTab] = useState<DiffTab>("new")

  const counts = {
    new: diff?.new.length ?? 0,
    resolved: diff?.resolved.length ?? 0,
    persisted: diff?.persisted.length ?? 0,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert changes</CardTitle>
        <CardDescription>
          New, resolved, and persisted alerts between these crawls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as DiffTab)}>
          <TabsList>
            <TabsTrigger value="new">
              New
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.new}
              </span>
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.resolved}
              </span>
            </TabsTrigger>
            <TabsTrigger value="persisted">
              Persisted
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.persisted}
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="new"
            className="mt-4"
            data-testid="diff-tab-new"
          >
            <DiffSlice
              alerts={diff?.new ?? []}
              isLoading={isLoading}
              isError={isError}
              emptyHint="No new alerts in the after crawl."
              truncated={diff?.newTruncated ?? false}
            />
          </TabsContent>
          <TabsContent
            value="resolved"
            className="mt-4"
            data-testid="diff-tab-resolved"
          >
            <DiffSlice
              alerts={diff?.resolved ?? []}
              isLoading={isLoading}
              isError={isError}
              emptyHint="No alerts were resolved between these crawls."
              truncated={diff?.resolvedTruncated ?? false}
            />
          </TabsContent>
          <TabsContent
            value="persisted"
            className="mt-4"
            data-testid="diff-tab-persisted"
          >
            <DiffSlice
              alerts={diff?.persisted ?? []}
              isLoading={isLoading}
              isError={isError}
              emptyHint="No persisted alerts in the after crawl."
              truncated={diff?.persistedTruncated ?? false}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function DiffSlice({
  alerts,
  isLoading,
  isError,
  emptyHint,
  truncated,
}: {
  alerts: Alert[]
  isLoading: boolean
  isError: boolean
  emptyHint: string
  truncated: boolean
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [toolbar, setToolbar] = useState<AlertsTableToolbarState>(EMPTY_TOOLBAR)

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

  if (isError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Could not load alert diff.
      </p>
    )
  }

  if (!isLoading && alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>
  }

  return (
    <div className="space-y-2">
      <AlertsTable
        data={alerts}
        total={alerts.length}
        isLoading={isLoading}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        toolbar={toolbar}
        onToolbarChange={setToolbar}
        hideStatusFilter
      />
      {truncated ? (
        <p className="text-xs text-muted-foreground">
          Capped at the BE diff limit (200). Some alerts were omitted.
        </p>
      ) : null}
    </div>
  )
}

// Force-import the CategorySummary type so unused-import lints stay quiet
// without risking a type-only import being elided.
export type { CategorySummary }
