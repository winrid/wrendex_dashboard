// Anonymous-crawl progress card. Plan section 2.0.
//
// Polls GET /api/anonymous-crawls/{token} every 2s while the run isn't
// complete. Shape mirrors CrawlRunningView but the source is the public
// teaser endpoint, not getCrawl - we don't have a CrawlRun read for
// unauthenticated visitors.

import { Loader2Icon } from "lucide-react"
import type { AnonymousCrawlSummary } from "@/api/types"

export type AnonymousCrawlProgressProps = {
  summary: AnonymousCrawlSummary | undefined
}

export function AnonymousCrawlProgress({ summary }: AnonymousCrawlProgressProps) {
  const status = summary?.status ?? "queued"
  const crawled = summary?.pagesCrawled ?? 0
  const discovered = summary?.pagesDiscovered ?? 0

  return (
    <div className="rounded-md border bg-card/50 p-6">
      <div className="flex items-center gap-3">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Running free audit</div>
          <div className="text-xs text-muted-foreground">
            Status: {status}
            {summary
              ? ` - ${crawled.toLocaleString()} of ${discovered.toLocaleString()} pages crawled`
              : null}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        We crawl your site, score it, and surface the issues that matter.
        This usually finishes in under 12 minutes.
      </p>
    </div>
  )
}
