// Index redirect. Lives behind <RequireAuth>, so by the time we render here
// useAuth() is hydrated. Sends the user to their active tenant's sites
// page; if /api/me returned no memberships at all (shouldn't happen
// post-signup) we send them to /signup so they can create a workspace.

import { Navigate } from "react-router-dom"
import { useAuth } from "@/auth/AuthProvider"

export function RootRedirect() {
  const { activeTenantId } = useAuth()
  if (!activeTenantId) {
    return <Navigate to="/signup" replace />
  }
  return <Navigate to={`/t/${activeTenantId}/sites`} replace />
}
