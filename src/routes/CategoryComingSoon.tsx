// Stub for /t/:tenantId/crawls/:crawlId/issues/category/:categoryId. The
// category drill-in lands in a later iter; we render a placeholder so the
// links from the issue queue don't 404.

import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function CategoryComingSoon() {
  const { tenantId = "default", categoryId = "" } = useParams<{
    tenantId: string
    categoryId: string
  }>()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        Category: {decodeURIComponent(categoryId)}
      </h1>
      <p className="text-sm text-muted-foreground">
        Coming soon. The per-category alert table lands in a later iteration.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites`}>Back to sites</Link>
        </Button>
      </div>
    </div>
  )
}
