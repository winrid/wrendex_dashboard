// /t/:tenantId/sites/:siteId/inbox is a deep-link convenience: it lands the
// user on the tenant inbox with the siteId pre-filter applied. The route
// existed as a stub for a while; the real Inbox already accepts ?siteId=
// in its search params, so we just redirect once on mount.

import { Navigate, useParams } from "react-router-dom"

export function SiteInbox() {
  const { tenantId, siteId } = useParams<{ tenantId: string; siteId: string }>()
  if (!tenantId || !siteId) {
    return <Navigate to="/" replace />
  }
  return (
    <Navigate
      to={`/t/${tenantId}/inbox?siteId=${encodeURIComponent(siteId)}`}
      replace
    />
  )
}
