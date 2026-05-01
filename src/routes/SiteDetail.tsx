import { Link, useParams } from "react-router-dom"
import { StubPage } from "./StubPage"
import { Button } from "@/components/ui/button"

export function SiteDetail() {
  const { tenantId = "default", siteId } = useParams<{ tenantId: string; siteId: string }>()
  return (
    <StubPage
      title={`Site ${siteId}`}
      description="Site overview placeholder; the health-score ring and report grid land in a later iteration."
    >
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites/${siteId}/inbox`}>Open Inbox</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites`}>Back to all sites</Link>
        </Button>
      </div>
    </StubPage>
  )
}
