import { useParams } from "react-router-dom"
import { StubPage } from "./StubPage"

export function SiteInbox() {
  const { siteId } = useParams<{ siteId: string }>()
  return (
    <StubPage
      title="Inbox"
      description={`Alert inbox for site ${siteId} (stub).`}
    />
  )
}
