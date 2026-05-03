// Site overview page (plan section 2.1-2.4). Pulls the site, the latest
// crawl, the health-score timeseries, and the issues summary in parallel
// and lays them out as a header strip + ring + sparkline + issue queue.
// Section 2.5 (regression strip) is intentionally skipped; the diff
// endpoint lands in a parallel iter 4 BE commit.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { isApiError } from "@/api/client"
import type { CrawlRun } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"
import { ExternalLinkIcon, PlayIcon, PauseIcon, ZapIcon } from "lucide-react"
import { HealthRing } from "@/components/health-ring/HealthRing"
import { HealthSparkline } from "@/components/site-detail/HealthSparkline"
import { IssueQueue } from "@/components/site-detail/IssueQueue"
import { RegressionStrip } from "@/components/site-detail/RegressionStrip"
import { CrawlRunningView } from "@/components/site-detail/CrawlRunningView"
import { VerificationDialog } from "@/components/site-verification/VerificationDialog"
import { ShareButton } from "@/components/share/ShareButton"
import { useReadOnly } from "@/components/share/ReadOnlyContext"
import {
  formatCadence,
  relativeTime,
  siteDisplayName,
} from "@/lib/format"

function pickLatestCompleted(runs: CrawlRun[] | undefined): CrawlRun | null {
  if (!runs || runs.length === 0) return null
  const completed = runs
    .filter((r) => r.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
  return completed[0] ?? null
}

/** Picks the SECOND most-recent completed crawl in the run list. The
 *  regression strip diffs the latest completed run against this one; when
 *  no second entry exists the strip is hidden. */
function pickPreviousCompleted(runs: CrawlRun[] | undefined): CrawlRun | null {
  if (!runs || runs.length === 0) return null
  const completed = runs
    .filter((r) => r.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
  return completed[1] ?? null
}

function pickLatestRun(runs: CrawlRun[] | undefined): CrawlRun | null {
  if (!runs || runs.length === 0) return null
  return [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )[0]!
}

export function SiteDetail() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const client = useApiClient()
  const queryClient = useQueryClient()
  const readOnly = useReadOnly()
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [runningCrawlId, setRunningCrawlId] = useState<string | null>(null)

  const siteQ = useQuery({
    queryKey: ["site", tenantId, siteId],
    queryFn: () => client.getSite(tenantId, siteId),
    enabled: Boolean(tenantId && siteId),
  })

  const runsQ = useQuery({
    queryKey: ["site-runs", siteId],
    queryFn: () => client.listCrawlsBySite(siteId),
    enabled: Boolean(siteId),
  })

  const healthQ = useQuery({
    queryKey: ["site-health", siteId],
    queryFn: () => client.getHealthScore(siteId),
    enabled: Boolean(siteId),
  })

  const latestCompleted = useMemo(
    () => pickLatestCompleted(runsQ.data),
    [runsQ.data],
  )
  const previousCompleted = useMemo(
    () => pickPreviousCompleted(runsQ.data),
    [runsQ.data],
  )
  const latestRun = useMemo(() => pickLatestRun(runsQ.data), [runsQ.data])
  const latestCrawlId = latestCompleted?.id ?? null

  const issuesQ = useQuery({
    queryKey: ["crawl-issues", latestCrawlId],
    queryFn: () => client.getIssuesSummary(latestCrawlId!),
    enabled: Boolean(latestCrawlId),
  })

  const startMut = useMutation({
    mutationFn: () => client.startCrawlAsync(siteId),
    onSuccess: (run) => {
      setRunningCrawlId(run.id)
    },
    onError: (err) => {
      // 409: a run is already active for the site - the body is the live run.
      if (isApiError(err) && err.status === 409 && err.body && typeof err.body === "object") {
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

  const onCrawlComplete = () => {
    setRunningCrawlId(null)
    void queryClient.invalidateQueries({ queryKey: ["site-runs", siteId] })
    void queryClient.invalidateQueries({ queryKey: ["site-health", siteId] })
    void queryClient.invalidateQueries({ queryKey: ["site", tenantId, siteId] })
    toast.success("Crawl complete")
  }

  const sortedHealth = useMemo<{
    latest: import("@/api/types").HealthScorePoint | null
    previous: import("@/api/types").HealthScorePoint | null
  }>(() => {
    const points = healthQ.data
    if (!points || points.length === 0) return { latest: null, previous: null }
    const sorted = [...points].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
    const latest = sorted[sorted.length - 1] ?? null
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2]! : null
    return { latest, previous }
  }, [healthQ.data])

  if (siteQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading site...</div>
  }
  if (siteQ.isError || !siteQ.data) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Could not load site.
      </div>
    )
  }
  const site = siteQ.data
  const verified = Boolean(site.verifiedAt)
  const cadenceLabel = formatCadence(site.cadence ?? null)
  const lastCrawlAt =
    latestRun?.startedAt ?? site.lastCrawlAt ?? null
  const ringScore = sortedHealth.latest?.healthScore ?? 0
  const ringDelta =
    sortedHealth.latest && sortedHealth.previous
      ? sortedHealth.latest.healthScore - sortedHealth.previous.healthScore
      : null
  const ringSample = latestCompleted?.pagesCrawled ?? 0

  return (
    <div className="space-y-6">
      {/* 2.1 Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {siteDisplayName(site.url)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {site.url}
              <ExternalLinkIcon className="size-3" />
            </a>
            <span>
              Last crawled <span className="font-medium text-foreground/80">{relativeTime(lastCrawlAt)}</span>
            </span>
            <Badge variant="outline">{cadenceLabel}</Badge>
            {verified ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Verified
              </Badge>
            ) : readOnly ? (
              <Badge variant="outline">Unverified</Badge>
            ) : (
              <button
                type="button"
                onClick={() => setVerifyOpen(true)}
                className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
              >
                Unverified
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
              <Button
                size="sm"
                onClick={() => startMut.mutate()}
                disabled={startMut.isPending || runningCrawlId != null}
              >
                <PlayIcon />
                <span>Run audit now</span>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/t/${tenantId}/sites/${siteId}/spot-audit`}>
                  <ZapIcon />
                  <span>Spot audit</span>
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toast.info("Pause monitoring lands with the schedule editor")
                }
              >
                <PauseIcon />
                <span>Pause monitoring</span>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`/t/${tenantId}/sites/${siteId}/crawls`}>
                  Crawl history
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`/t/${tenantId}/sites/${siteId}/health-history`}>
                  Health history
                </Link>
              </Button>
              {latestCrawlId ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/t/${tenantId}/sites/${siteId}/crawls/${latestCrawlId}/structure`}
                    >
                      Site structure
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/t/${tenantId}/sites/${siteId}/crawls/${latestCrawlId}/duplicates`}
                    >
                      Duplicates
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/t/${tenantId}/sites/${siteId}/crawls/${latestCrawlId}/structured-data`}
                    >
                      Structured data
                    </Link>
                  </Button>
                </>
              ) : null}
              <ShareButton scope="SITE" targetId={siteId} />
              <Button asChild variant="outline" size="sm">
                <Link to={`/t/${tenantId}/sites/${siteId}/settings`}>
                  Settings
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {runningCrawlId ? (
        <CrawlRunningView
          crawlRunId={runningCrawlId}
          onComplete={onCrawlComplete}
        />
      ) : null}

      {/* 2.2 + 2.3 Ring + Sparkline */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="rounded-md border bg-card p-4">
          {healthQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sortedHealth.latest ? (
            <HealthRing
              score={ringScore}
              delta={ringDelta}
              sample={ringSample}
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground">
              No score yet
            </div>
          )}
        </div>
        <div className="rounded-md border bg-card p-4">
          <HealthSparkline
            points={healthQ.data ?? []}
            tenantId={tenantId}
            siteId={siteId}
          />
        </div>
      </div>

      {/* 2.5 Regression strip - hidden when there is no prior crawl. */}
      {latestCrawlId && previousCompleted ? (
        <RegressionStrip
          tenantId={tenantId}
          siteId={siteId}
          crawlId={latestCrawlId}
          previousCrawlId={previousCompleted.id}
        />
      ) : null}

      {/* 2.4 Issue queue */}
      {latestCrawlId && issuesQ.data ? (
        <IssueQueue
          tenantId={tenantId}
          crawlId={latestCrawlId}
          summary={issuesQ.data}
          healthScore={ringScore}
        />
      ) : latestCrawlId && issuesQ.isLoading ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Loading issues...
        </div>
      ) : (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No completed crawl yet. Run an audit to see issues here.
        </div>
      )}

      <VerificationDialog
        siteId={siteId}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onVerified={() => {
          void queryClient.invalidateQueries({
            queryKey: ["site", tenantId, siteId],
          })
          void queryClient.invalidateQueries({ queryKey: ["sites", tenantId] })
        }}
      />
    </div>
  )
}

