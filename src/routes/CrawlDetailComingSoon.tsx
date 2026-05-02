// Stub for /t/:tenantId/sites/:siteId/crawls/:crawlId. The CrawlRun detail
// view lands in a later iter; we render a friendly placeholder so links
// from the sparkline / crawl-history table don't 404.

import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function CrawlDetailComingSoon() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Crawl detail</h1>
      <p className="text-sm text-muted-foreground">
        Coming soon. The per-crawl drill-in (pages, alerts, structure) lands
        in a later iteration.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites/${siteId}/crawls`}>
            Back to crawl history
          </Link>
        </Button>
      </div>
    </div>
  )
}
