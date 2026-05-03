// Page detail (plan section 5). Lands at /t/:tenantId/sites/:siteId/pages
// with the URL provided via ?url=<encoded>. The optional ?crawlId= search
// param pins the crawl - when absent we resolve the latest completed crawl
// for the site so deep links from the AlertDetailDrawer "Open in page
// detail" button keep working without callers having to know the crawl id.
//
// Tabs: Overview / Performance / Links / Resources / Structured data /
// Hreflang / Alerts. The Alerts tab reuses the AlertsTable + drawer
// components from FE-5; row click reopens the same drawer that drives the
// inbox.

import { useEffect, useMemo, useState } from "react"
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ExternalLinkIcon, FileTextIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type {
  Alert,
  AlertListParams,
  AlertQueryResult,
  CrawlRun,
  Page,
  ResourceEntry,
} from "@/api/types"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "@/components/alerts-table/AlertsTable"
import { AlertDetailDrawer } from "@/components/alerts-table/AlertDetailDrawer"
import { ShareButton } from "@/components/share/ShareButton"
import { useReadOnly } from "@/components/share/ReadOnlyContext"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/format"

const DEFAULT_TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

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

function pickLatestCompleted(runs: CrawlRun[] | undefined): CrawlRun | null {
  if (!runs || runs.length === 0) return null
  const sorted = runs
    .filter((r) => r.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
  return sorted[0] ?? null
}

function isIndexable(robotsMeta: string | null | undefined): boolean {
  if (!robotsMeta) return true
  return !/noindex/i.test(robotsMeta)
}

export function PageDetail() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const url = searchParams.get("url") ?? ""
  const crawlIdFromQuery = searchParams.get("crawlId")
  const tabParam = searchParams.get("tab") ?? "overview"
  const client = useApiClient()
  const queryClient = useQueryClient()

  const runsQ = useQuery({
    queryKey: ["site-runs", siteId],
    queryFn: () => client.listCrawlsBySite(siteId),
    enabled: Boolean(siteId) && !crawlIdFromQuery,
  })

  const resolvedCrawlId =
    crawlIdFromQuery ?? pickLatestCompleted(runsQ.data)?.id ?? null

  const pageQ = useQuery<Page>({
    queryKey: ["page-by-url", resolvedCrawlId, url],
    queryFn: () => client.getPageByUrl(resolvedCrawlId!, url),
    enabled: Boolean(resolvedCrawlId && url),
  })

  if (!url) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Page detail</h1>
        <p className="text-sm text-muted-foreground">
          Provide a ?url= query parameter to open a page.
        </p>
      </div>
    )
  }

  if (!resolvedCrawlId) {
    if (runsQ.isLoading) {
      return (
        <div className="text-sm text-muted-foreground">Loading crawl...</div>
      )
    }
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        No completed crawl yet for this site.
      </div>
    )
  }

  if (pageQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading page...</div>
  }
  if (pageQ.isError || !pageQ.data) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm">
        <div className="font-medium">Could not load page.</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {url}
        </div>
      </div>
    )
  }
  const page = pageQ.data

  return (
    <div className="space-y-6">
      <Header
        page={page}
        tenantId={tenantId}
        siteId={siteId}
      />

      <Tabs
        value={tabParam}
        onValueChange={(next) => {
          // Mirror the active tab into ?tab= so deep links and refreshes
          // preserve the user's current pane.
          setSearchParams(
            (prev) => {
              const params = new URLSearchParams(prev)
              if (next === "overview") {
                params.delete("tab")
              } else {
                params.set("tab", next)
              }
              return params
            },
            { replace: true },
          )
        }}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="structured">Structured data</TabsTrigger>
          <TabsTrigger value="hreflang">Hreflang</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab page={page} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformanceTab page={page} />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <LinksTab page={page} tenantId={tenantId} siteId={siteId} />
        </TabsContent>
        <TabsContent value="resources" className="mt-4">
          <ResourcesTab
            page={page}
            crawlId={resolvedCrawlId}
          />
        </TabsContent>
        <TabsContent value="structured" className="mt-4">
          <StructuredDataTab
            page={page}
            tenantId={tenantId}
            siteId={siteId}
            crawlId={resolvedCrawlId}
          />
        </TabsContent>
        <TabsContent value="hreflang" className="mt-4">
          <HreflangTab page={page} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertsTab
            pageId={page.id}
            tenantId={tenantId}
            siteId={siteId}
            invalidateKey={() =>
              queryClient.invalidateQueries({
                queryKey: ["page-alerts", page.id],
              })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header strip
// ---------------------------------------------------------------------------

function Header({
  page,
  tenantId,
  siteId,
}: {
  page: Page
  tenantId: string
  siteId: string
}) {
  const indexable = isIndexable(page.robotsMeta)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/t/${tenantId}/sites/${siteId}`} className="hover:underline">
          Site
        </Link>
        <span>/</span>
        <Link
          to={`/t/${tenantId}/sites/${siteId}/crawls/${page.crawlRunId}/pages`}
          className="hover:underline"
        >
          Pages
        </Link>
        <span>/</span>
        <span>Detail</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-all">
            {page.title || page.url}
          </h1>
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 break-all font-mono text-xs text-muted-foreground hover:underline"
          >
            {page.url}
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(statusBadgeClass(page.statusCode))}>
            HTTP {page.statusCode}
          </Badge>
          {indexable ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Indexable
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Not indexable
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Raw HTML viewer is on the way.")
            }
          >
            <FileTextIcon />
            <span>View raw HTML</span>
          </Button>
          <ShareButton scope="PAGE_DETAIL" targetId={page.id} label="Share page" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ page }: { page: Page }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <KvCard label="Title" value={page.title} />
      <KvCard label="Meta description" value={page.metaDescription} />
      <KvCard label="H1" value={page.h1} />
      <KvCard label="Canonical" value={page.canonicalUrl} mono />
      <KvCard label="Robots" value={page.robotsMeta} mono />
      <KvCard label="Lang" value={page.lang} />
      <KvCard label="Viewport" value={page.viewportContent} />
      <KvCard
        label="Word count"
        value={String(page.wordCount)}
      />
      <KvCard label="Content hash" value={page.contentHash} mono />
      <KvCard label="Content type" value={page.contentType} />
      <KvCard label="Content encoding" value={page.contentEncoding} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

function PerformanceTab({ page }: { page: Page }) {
  const compressed = Boolean(page.contentEncoding)
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Stat label="Response" value={`${page.responseTimeMs} ms`} />
      <Stat label="TTFB" value={`${page.ttfbMs} ms`} />
      <Stat
        label="Content length"
        value={formatBytes(page.contentLengthBytes)}
      />
      <Stat
        label="Content encoding"
        value={page.contentEncoding ?? "(none)"}
      />
      <Stat
        label="Compressed"
        value={compressed ? "Yes" : "No"}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

function LinksTab({
  page,
  tenantId,
  siteId,
}: {
  page: Page
  tenantId: string
  siteId: string
}) {
  const links = page.outgoingLinks ?? []
  const explorerHref = `/t/${tenantId}/sites/${siteId}/crawls/${page.crawlRunId}/links`
  if (links.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          No outgoing links recorded for this page.
        </div>
        <div className="text-sm">
          <Link to={explorerHref} className="text-primary hover:underline">
            Open the full Link Explorer for this crawl
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card">
        <ul className="divide-y">
          {links.map((link, idx) => (
            <li
              key={`${link.resolvedUrl}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={link.resolvedUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate font-mono text-xs text-primary hover:underline"
                  title={link.resolvedUrl}
                >
                  {link.resolvedUrl}
                </a>
                {link.anchorText ? (
                  <div className="truncate text-xs text-muted-foreground">
                    "{link.anchorText}"
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {link.rel ? (
                  <Badge variant="outline" className="text-[10px]">
                    rel={link.rel}
                  </Badge>
                ) : null}
                {link.nofollow ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    nofollow
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-sm">
        <Link to={explorerHref} className="text-primary hover:underline">
          Open the full Link Explorer for this crawl
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

function ResourcesTab({
  page,
  crawlId,
}: {
  page: Page
  crawlId: string
}) {
  const client = useApiClient()
  const resourcesQ = useQuery({
    queryKey: ["resources", crawlId],
    queryFn: () => client.getResources(crawlId),
    enabled: Boolean(crawlId),
  })

  const all = resourcesQ.data?.resources ?? []
  // We surface only the resources that name the current page in their
  // originatingPages sample. That sample is intentionally small (BE iter 2),
  // so this view is best-effort: for resources we know about but do not have
  // the page in the sample we still render them under "All resources" to
  // keep the user from seeing a misleading empty state.
  const onThisPage = all.filter((r) =>
    (r.originatingPages ?? []).includes(page.url),
  )

  if (resourcesQ.isLoading) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        Loading resources...
      </div>
    )
  }

  if (onThisPage.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        No resources are attributed to this page in the current sample.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {onThisPage.map((r) => (
          <li
            key={r.url}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span
                className="block truncate font-mono text-xs"
                title={r.url}
              >
                {r.url}
              </span>
              <SiblingHint entry={r} pageUrl={page.url} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {r.type}
              </Badge>
              {r.renderBlocking ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Render-blocking
                </Badge>
              ) : null}
              {r.duplicateTracker ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Duplicate
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SiblingHint({
  entry,
  pageUrl,
}: {
  entry: ResourceEntry
  pageUrl: string
}) {
  const otherPagesInSample = (entry.originatingPages ?? []).filter(
    (u) => u !== pageUrl,
  ).length
  const totalOthers = Math.max(entry.sourcePageCount - 1, otherPagesInSample)
  if (totalOthers <= 0) return null
  return (
    <div className="text-[11px] text-muted-foreground">
      {totalOthers} other {totalOthers === 1 ? "page" : "pages"} also load this
    </div>
  )
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function StructuredDataTab({
  page,
  tenantId,
  siteId,
  crawlId,
}: {
  page: Page
  tenantId: string
  siteId: string
  crawlId: string | null
}) {
  const scripts = page.jsonLdScripts ?? []
  const reportLink = crawlId ? (
    <div className="text-xs">
      <Link
        to={`/t/${tenantId}/sites/${siteId}/crawls/${crawlId}/structured-data`}
        className="text-primary hover:underline"
      >
        Open the full Structured Data report for this crawl
      </Link>
    </div>
  ) : null

  if (scripts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          No JSON-LD blocks found on this page.
        </div>
        {reportLink}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {scripts.map((script, idx) => (
        <div key={idx} className="rounded-md border bg-card">
          <div className="border-b px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            JSON-LD #{idx + 1}
          </div>
          <pre className="max-h-96 overflow-auto p-3 font-mono text-xs leading-relaxed">
            {numberLines(script)}
          </pre>
        </div>
      ))}
      {reportLink}
    </div>
  )
}

function numberLines(text: string): string {
  return text
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3, " ")}  ${line}`)
    .join("\n")
}

// ---------------------------------------------------------------------------
// Hreflang
// ---------------------------------------------------------------------------

function HreflangTab({ page }: { page: Page }) {
  const entries = page.hreflangEntries ?? []
  if (entries.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        No hreflang entries on this page.
      </div>
    )
  }
  return (
    <div className="rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">hreflang</th>
            <th className="px-3 py-2">href</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e, idx) => (
            <tr key={`${e.hreflang}-${idx}`}>
              <td className="px-3 py-2 font-mono text-xs">{e.hreflang}</td>
              <td className="px-3 py-2 font-mono text-xs break-all">{e.href}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function AlertsTab({
  pageId,
  tenantId,
  siteId,
  invalidateKey,
}: {
  pageId: string
  tenantId: string
  siteId: string
  invalidateKey: () => void
}) {
  const client = useApiClient()
  const readOnly = useReadOnly()
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
      status: toolbar.status,
      sort: sorting[0]?.id,
      dir: sorting[0]?.desc ? "desc" : sorting[0] ? "asc" : undefined,
    }),
    [pagination, sevSingle, toolbar.pageUrlContains, toolbar.status, sorting],
  )

  const alertsQ = useQuery<AlertQueryResult>({
    queryKey: ["page-alerts", pageId, params],
    queryFn: () => client.listPageAlerts(pageId, params),
    enabled: Boolean(pageId),
  })

  const ignoreMut = useMutation({
    mutationFn: (alertId: string) => client.ignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert ignored")
      invalidateKey()
    },
    onError: () => toast.error("Could not ignore alert"),
  })
  const unignoreMut = useMutation({
    mutationFn: (alertId: string) => client.unignoreAlert(alertId),
    onSuccess: () => {
      toast.success("Alert restored")
      invalidateKey()
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

  // Reset pagination on toolbar / search changes for a more predictable UX.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [toolbar.pageUrlContains, toolbar.severities, toolbar.status])

  return (
    <>
      <AlertsTable
        data={alertsQ.data?.items ?? []}
        total={alertsQ.data?.total ?? 0}
        isLoading={alertsQ.isLoading}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        toolbar={toolbar}
        onToolbarChange={setToolbar}
        hideCategoryFilter
        onIgnore={readOnly ? undefined : (a) => ignoreMut.mutate(a.id)}
        onUnignore={readOnly ? undefined : (a) => unignoreMut.mutate(a.id)}
        onRowClick={(a) => setOpenAlert(a)}
      />
      <AlertDetailDrawer
        alert={openAlert}
        open={openAlert !== null}
        onOpenChange={(o) => {
          if (!o) setOpenAlert(null)
        }}
        tenantId={tenantId}
        siteId={siteId}
        onIgnore={
          readOnly
            ? undefined
            : (a) => {
                ignoreMut.mutate(a.id)
                setOpenAlert(null)
              }
        }
        onUnignore={
          readOnly
            ? undefined
            : (a) => {
                unignoreMut.mutate(a.id)
                setOpenAlert(null)
              }
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

function KvCard({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words text-sm",
          mono && "font-mono text-xs",
          !value && "text-muted-foreground",
        )}
      >
        {value && value.trim().length > 0 ? value : "(empty)"}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
