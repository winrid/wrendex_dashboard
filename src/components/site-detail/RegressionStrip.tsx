// Regression strip (plan section 2.5). Renders three stat tiles - new /
// resolved / persisted - over the cross-crawl diff that ships from
// CrawlController.getCrawlDiff (iter 4 BE-4 commit db0983c). The strip is
// hidden whenever there is no PRIOR completed crawl to diff against; the
// caller is responsible for sorting the run list by startedAt desc and
// passing the second entry as `previousCrawlId`.
//
// Each tile links into the inbox with the crawl run plus an alert-status
// pre-filter that mirrors the diff partition (status=OPEN for new + persisted,
// status=RESOLVED for the resolved partition). The plan asks for the strip
// to deep-link into "the inbox filtered to the right partition"; the
// inbox accepts ?status=... and ?crawlRunId=... search params.

import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import type { CrawlDiff } from "@/api/types"

export type RegressionStripProps = {
  tenantId: string
  siteId: string
  crawlId: string
  previousCrawlId: string | null
}

export function RegressionStrip({
  tenantId,
  siteId,
  crawlId,
  previousCrawlId,
}: RegressionStripProps) {
  const client = useApiClient()
  const diffQ = useQuery<CrawlDiff>({
    queryKey: ["crawl-diff", crawlId, previousCrawlId],
    queryFn: () =>
      client.getCrawlDiff(crawlId, { against: previousCrawlId! }),
    enabled: Boolean(crawlId && previousCrawlId),
  })

  if (!previousCrawlId) return null
  if (diffQ.isLoading) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Comparing to previous crawl...
      </div>
    )
  }
  if (diffQ.isError || !diffQ.data) {
    return null
  }
  const diff = diffQ.data

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Tile
        tone="error"
        label="New errors"
        count={diff.new.length}
        truncated={diff.newTruncated}
        to={inboxLink(tenantId, siteId, crawlId, "OPEN")}
      />
      <Tile
        tone="success"
        label="Resolved"
        count={diff.resolved.length}
        truncated={diff.resolvedTruncated}
        to={inboxLink(tenantId, siteId, previousCrawlId, "RESOLVED")}
      />
      <Tile
        tone="muted"
        label="Persisted"
        count={diff.persisted.length}
        truncated={diff.persistedTruncated}
        to={inboxLink(tenantId, siteId, crawlId, "OPEN")}
      />
    </div>
  )
}

function inboxLink(
  tenantId: string,
  siteId: string,
  crawlRunId: string,
  status: "OPEN" | "RESOLVED",
): string {
  const params = new URLSearchParams({
    status,
    crawlRunId,
    siteId,
  })
  return `/t/${tenantId}/inbox?${params.toString()}`
}

function Tile({
  tone,
  label,
  count,
  truncated,
  to,
}: {
  tone: "error" | "success" | "muted"
  label: string
  count: number
  truncated: boolean
  to: string
}) {
  const className =
    tone === "error"
      ? "border-red-500/30 bg-red-500/5"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border bg-card"
  const accent =
    tone === "error"
      ? "text-red-700 dark:text-red-300"
      : tone === "success"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-foreground"
  return (
    <Link
      to={to}
      className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-muted/50 ${className}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums ${accent}`}>
          {count}
        </span>
        {truncated ? (
          <span className="text-xs text-muted-foreground">+more</span>
        ) : null}
      </div>
    </Link>
  )
}
