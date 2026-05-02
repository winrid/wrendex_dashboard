// Polled view shown after the user clicks "Run audit now". We hold the
// active crawl's id in URL search state (?running=<crawlId>) so a reload
// keeps polling instead of dropping the user back to the overview. The
// poll uses TanStack Query's refetchInterval so we cooperate with the
// query cache (no manual setInterval / cleanup).

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import { Loader2Icon } from "lucide-react"

export type CrawlRunningViewProps = {
  crawlRunId: string
  /** Called when the run reaches a terminal status. */
  onComplete: () => void
}

const TERMINAL = new Set(["completed", "failed", "cancelled", "error"])

export function CrawlRunningView({
  crawlRunId,
  onComplete,
}: CrawlRunningViewProps) {
  const client = useApiClient()
  const q = useQuery({
    queryKey: ["crawl", crawlRunId],
    queryFn: () => client.getCrawl(crawlRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && TERMINAL.has(status)) return false
      return 2_000
    },
  })

  const status = q.data?.status
  useEffect(() => {
    if (status && TERMINAL.has(status)) {
      // Defer to next tick so the user briefly sees the "completed" state.
      const t = window.setTimeout(onComplete, 400)
      return () => window.clearTimeout(t)
    }
  }, [status, onComplete])

  return (
    <div className="rounded-md border bg-card p-6">
      <div className="flex items-center gap-3">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        <div>
          <div className="text-sm font-medium">Running audit</div>
          <div className="text-xs text-muted-foreground">
            Status: {status ?? "queued"}
            {q.data
              ? ` - ${q.data.pagesCrawled.toLocaleString()} of ${q.data.pagesDiscovered.toLocaleString()} pages crawled`
              : null}
          </div>
        </div>
      </div>
    </div>
  )
}
