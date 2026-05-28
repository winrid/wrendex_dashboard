// Anonymous-crawl progress card. Plan section 2.0.
//
// Polls GET /api/anonymous-crawls/{token} every 2s while the run isn't
// complete. Shape mirrors CrawlRunningView but the source is the public
// teaser endpoint, not getCrawl - we don't have a CrawlRun read for
// unauthenticated visitors.

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import type { AnonymousCrawlSummary } from "@/api/types"

export type AnonymousCrawlProgressProps = {
  summary: AnonymousCrawlSummary | undefined
}

// Threshold before we trust the observed crawl rate enough to surface an ETA.
// Below this, rate is too volatile (first page lands fast, then a long stall
// while subsequent pages queue) and produces wildly swinging estimates.
const ETA_MIN_ELAPSED_MS = 5_000
const ETA_MIN_PAGES_CRAWLED = 3

function formatEta(seconds: number): string {
  if (seconds < 45) return "Less than a minute remaining"
  const minutes = Math.round(seconds / 60)
  if (minutes <= 1) return "About 1 minute remaining"
  return `About ${minutes} minutes remaining`
}

function computeEtaSeconds(
  summary: AnonymousCrawlSummary,
  nowMs: number,
): number | null {
  const startedMs = new Date(summary.startedAt).getTime()
  if (!Number.isFinite(startedMs)) return null
  const elapsedMs = nowMs - startedMs
  if (elapsedMs < ETA_MIN_ELAPSED_MS) return null
  if (summary.pagesCrawled < ETA_MIN_PAGES_CRAWLED) return null
  const remaining = summary.pagesDiscovered - summary.pagesCrawled
  if (remaining <= 0) return null
  const ratePerMs = summary.pagesCrawled / elapsedMs
  if (ratePerMs <= 0) return null
  return Math.round(remaining / ratePerMs / 1000)
}

export function AnonymousCrawlProgress({ summary }: AnonymousCrawlProgressProps) {
  const status = summary?.status ?? "queued"
  const crawled = summary?.pagesCrawled ?? 0
  const discovered = summary?.pagesDiscovered ?? 0
  const progress = summary?.postProcessingProgress ?? null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [])

  const etaSeconds = summary ? computeEtaSeconds(summary, now) : null
  const inPostProcessing = status === "post-processing"

  // Status line: page progress while dispatching, phase label once
  // post-processing kicks in. The BE only populates postProcessingProgress
  // during phase 1+ so its presence is the cleanest signal.
  const statusLine = progress
    ? `${progress.label}${
        progress.total > 0
          ? ` (${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()})`
          : progress.completed > 0
            ? ` (${progress.completed.toLocaleString()})`
            : ""
      }`
    : summary
      ? `Status: ${status} - ${crawled.toLocaleString()} of ${discovered.toLocaleString()} pages crawled`
      : `Status: ${status}`

  const barFraction =
    progress && progress.total > 0
      ? Math.max(0, Math.min(1, progress.completed / progress.total))
      : null

  return (
    <div className="rounded-md border bg-card/50 p-6">
      <div className="flex items-center gap-3">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-sm font-medium">
            {inPostProcessing ? "Analyzing crawled pages" : "Running free audit"}
          </div>
          <div className="truncate text-xs text-muted-foreground">{statusLine}</div>
        </div>
      </div>
      {barFraction != null ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(barFraction * 100).toFixed(1)}%` }}
          />
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        We crawl your site, score it, and surface the issues that matter.{" "}
        {inPostProcessing
          ? "Cross-referencing results - usually under a few minutes."
          : etaSeconds != null
            ? formatEta(etaSeconds)
            : "This usually finishes in a few minutes."}
      </p>
    </div>
  )
}
