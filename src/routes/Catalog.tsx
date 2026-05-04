// Catalog explorer (plan section 6 / sec 0.3e iter 2). Lands at
// /t/:tenantId/catalog. Lists every check the dashboard understands, grouped
// by category, with per-check title / severity / marketingId / "how to fix".
//
// Sources:
//   1. The BE /api/catalog endpoint (typed-client getPublicCatalog), hydrated
//      lazily into the in-memory check-catalog cache. Falls back to the
//      static src/api/checkCatalog.ts entries if the BE 404s.
//   2. listSitesByTenant -> a small site picker that lets the user see how
//      many alerts of each type are firing on the active site. Counts are
//      pulled lazily per-row via listSiteAlerts(siteId, {type, page:0, size:1})
//      so we read total without fetching every alert.
//
// Click a check -> navigates to the per-AlertType drill-in scoped to the
// site's latest crawl when a site is selected; otherwise we surface a hint
// pointing at the picker.

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import {
  getAllCategories,
  getAllChecks,
  hydrateCatalogFromBackend,
  type CheckCatalogEntry,
} from "@/api/checkCatalog"
import type {
  AlertType,
  CrawlRun,
  Site,
} from "@/api/types"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { siteDisplayName } from "@/lib/format"
import { cn } from "@/lib/utils"

type CategoryKey = "ALL" | string

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

export function Catalog() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const client = useApiClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("ALL")
  const [siteId, setSiteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Forces a re-render once the BE catalog hydrates and ENTRIES update.
  const [hydratedAt, setHydratedAt] = useState(0)

  // "Show only firing" toggle. The URL is the source of truth so a shared
  // /catalog?firing=0 link disables the filter; absence of the param means
  // "default", which is ON when a site is selected (firing-count badges
  // are meaningful) and OFF otherwise.
  const firingParam = searchParams.get("firing")
  const showOnlyFiring = firingParam === null
    ? Boolean(siteId)
    : firingParam !== "0"
  const setShowOnlyFiring = (next: boolean) => {
    setSearchParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        if (next) {
          // Only write the explicit ON value when the default would be OFF
          // (no site selected). Otherwise stick with the URL-clean default.
          if (siteId) out.delete("firing")
          else out.set("firing", "1")
        } else {
          // Default-ON case: write firing=0 to flip it off. When the default
          // is already OFF (no site), drop the param to keep the URL clean.
          if (siteId) out.set("firing", "0")
          else out.delete("firing")
        }
        return out
      },
      { replace: true },
    )
  }

  // Hydrate the in-memory catalog from the BE on mount. Errors are swallowed
  // by the hydrate helper - the static FE list keeps the page alive.
  useEffect(() => {
    void hydrateCatalogFromBackend(client).then(() => setHydratedAt(Date.now()))
  }, [client])

  // Sites for the picker. The catalog itself does not need a site, but the
  // per-row "firing on this site" count + the click-through deep link both
  // do.
  const sitesQ = useQuery<Site[]>({
    queryKey: ["sites", tenantId],
    queryFn: () => client.listSitesByTenant(tenantId),
    enabled: Boolean(tenantId),
  })

  useEffect(() => {
    if (siteId) return
    const first = sitesQ.data?.[0]
    if (first) setSiteId(first.id)
  }, [sitesQ.data, siteId])

  const all = useMemo<readonly CheckCatalogEntry[]>(
    () => getAllChecks(),
    // hydratedAt invalidation lets us pick up the BE-merged list once it
    // resolves (the backing array reference changes inside the cache).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydratedAt],
  )
  const cats = useMemo<string[]>(
    () => getAllCategories(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydratedAt],
  )

  // Latest completed crawl for the active site - we use it as the deep-link
  // target for the per-AlertType drill-in. We resolve lazily; if the lookup
  // fails the row click falls back to the inbox.
  const crawlsQ = useQuery<CrawlRun[]>({
    queryKey: ["crawls", siteId],
    queryFn: () => client.listCrawlsBySite(siteId!),
    enabled: Boolean(siteId),
  })

  const latestCrawlId = useMemo(() => {
    const list = crawlsQ.data ?? []
    const completed = list.find((c) => c.status === "completed" || c.finishedAt)
    return completed?.id ?? list[0]?.id ?? null
  }, [crawlsQ.data])

  const filteredEntries = useMemo<readonly CheckCatalogEntry[]>(() => {
    const q = query.trim().toLowerCase()
    return all.filter((e) => {
      if (activeCategory !== "ALL" && e.category !== activeCategory) return false
      if (!q) return true
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.marketingId.toLowerCase().includes(q)
      )
    })
  }, [all, query, activeCategory])

  // Per-type firing-count fetch. We batch one call per visible entry; the
  // picker is bounded to one site at a time and the page count is hard-capped
  // by the BE at size=200 - a fetch with size=1 returns the wrapped result
  // with .total set, so the row gets an accurate count without paying for the
  // alert payload. We only enable the queries when a site is selected.
  const visibleTypes = useMemo<AlertType[]>(
    () => filteredEntries.map((e) => e.type as AlertType),
    [filteredEntries],
  )

  const countQueries = useQueries({
    queries: visibleTypes.map((type) => ({
      queryKey: ["catalog-count", siteId, type],
      queryFn: () =>
        client.listSiteAlerts(siteId!, {
          type,
          page: 0,
          size: 1,
          status: "OPEN" as const,
        }),
      enabled: Boolean(siteId),
      staleTime: 60_000,
      retry: false,
    })),
  })

  const totals = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    countQueries.forEach((q, i) => {
      const t = visibleTypes[i]
      if (!t) return
      if (q.data) out[t] = q.data.total
    })
    return out
  }, [countQueries, visibleTypes])

  // Track whether each row's count query has resolved yet. We never hide a
  // row whose count is still loading -- avoids flicker as queries land in
  // sequence.
  const settled = useMemo<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    countQueries.forEach((q, i) => {
      const t = visibleTypes[i]
      if (!t) return
      if (q.isSuccess || q.isError) out[t] = true
    })
    return out
  }, [countQueries, visibleTypes])

  // What we actually render. When the toggle is ON we hide rows whose count
  // query has settled with 0; rows still loading stay visible. When OFF we
  // render filteredEntries unchanged.
  const displayEntries = useMemo<readonly CheckCatalogEntry[]>(() => {
    if (!showOnlyFiring || !siteId) return filteredEntries
    return filteredEntries.filter((entry) => {
      if (!settled[entry.type]) return true
      return (totals[entry.type] ?? 0) > 0
    })
  }, [filteredEntries, showOnlyFiring, siteId, settled, totals])

  const sites = sitesQ.data ?? []
  const showSitePicker = sites.length > 0

  const onRowClick = (entry: CheckCatalogEntry) => {
    if (siteId && latestCrawlId) {
      navigate(
        `/t/${tenantId}/crawls/${latestCrawlId}/issues/type/${encodeURIComponent(
          entry.type,
        )}`,
      )
      return
    }
    setExpanded((e) => ({ ...e, [entry.type]: !e[entry.type] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check catalog
          </h1>
          <p className="text-sm text-muted-foreground">
            {all.length} checks across {cats.length} categories. Search or
            pick a category to drill in.
          </p>
        </div>
        {showSitePicker ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Site</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={siteId ?? ""}
              onChange={(e) => setSiteId(e.target.value || null)}
              aria-label="Site"
            >
              <option value="">No site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {siteDisplayName(s.url)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search checks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
          aria-label="Search catalog"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={showOnlyFiring}
            onCheckedChange={setShowOnlyFiring}
            disabled={!siteId}
            aria-label="Show only firing"
            data-testid="catalog-firing-toggle"
          />
          <span
            className={cn(
              "select-none",
              !siteId ? "text-muted-foreground" : undefined,
            )}
          >
            Show only firing
          </span>
        </label>
      </div>

      {!siteId ? (
        <div
          className="rounded-md border bg-card p-3 text-xs text-muted-foreground"
          data-testid="catalog-pick-site-hint"
        >
          Select a site to see firing alerts and jump into the per-check
          drill-in.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        <aside
          className="space-y-1 rounded-md border bg-card p-2"
          data-testid="catalog-category-sidebar"
        >
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={cn(
              "w-full rounded px-2 py-1 text-left text-sm",
              activeCategory === "ALL"
                ? "bg-muted font-medium"
                : "hover:bg-muted/60",
            )}
          >
            All categories
          </button>
          {cats.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "w-full rounded px-2 py-1 text-left text-sm",
                activeCategory === cat
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/60",
              )}
              data-testid={`catalog-cat-${cat}`}
            >
              {cat}
            </button>
          ))}
        </aside>

        <div data-testid="catalog-entries">
          {displayEntries.length === 0 ? (
            <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
              {showOnlyFiring && siteId && filteredEntries.length > 0
                ? "No firing alerts on this site for the current filters."
                : "No checks match your search."}
            </div>
          ) : (
            <ul className="divide-y rounded-md border bg-card">
              {displayEntries.map((entry) => {
                const isOpen = expanded[entry.type] === true
                const firing = totals[entry.type]
                return (
                  <li
                    key={entry.type}
                    className="p-3"
                    data-testid={`catalog-entry-${entry.type}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onRowClick(entry)}
                        className="text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              severityBadgeClass(entry.severityDefault),
                            )}
                          >
                            {entry.severityDefault}
                          </Badge>
                          <span className="font-medium">{entry.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.marketingId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.category}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">
                          {entry.description}
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        {siteId && firing != null ? (
                          <span
                            className="rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                            data-testid={`catalog-firing-${entry.type}`}
                          >
                            {firing} firing
                          </span>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpanded((e) => ({
                              ...e,
                              [entry.type]: !isOpen,
                            }))
                          }
                          aria-expanded={isOpen}
                        >
                          {isOpen ? "Hide" : "How to fix"}
                        </Button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-2 rounded border bg-muted/40 p-2 text-sm">
                        <p className="font-medium">How to fix</p>
                        <p className="mt-1 leading-relaxed">{entry.howToFix}</p>
                        {siteId && latestCrawlId ? (
                          <p className="mt-2 text-xs">
                            <Link
                              className="underline hover:text-foreground"
                              to={`/t/${tenantId}/crawls/${latestCrawlId}/issues/type/${encodeURIComponent(
                                entry.type,
                              )}`}
                            >
                              Open firing alerts on{" "}
                              {sites.find((s) => s.id === siteId)?.url
                                ? siteDisplayName(
                                    sites.find((s) => s.id === siteId)!.url,
                                  )
                                : "site"}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// Re-export for callers that want to share-import the helper. Not currently
// used outside this file but keeps the public surface stable.
export { hydrateCatalogFromBackend }