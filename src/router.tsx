import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { Sites } from "@/routes/Sites"
import { SiteDetail } from "@/routes/SiteDetail"
import { SiteInbox } from "@/routes/SiteInbox"
import { Inbox } from "@/routes/Inbox"
import { Reports } from "@/routes/Reports"
import { Catalog } from "@/routes/Catalog"
import { Schedule } from "@/routes/Schedule"
import { Team } from "@/routes/Team"
import { Billing } from "@/routes/Billing"
import { Settings } from "@/routes/Settings"

// Placeholder until 0.3a auth lands and we resolve the active tenant from /api/me.
const DEFAULT_TENANT = "default"

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to={`/t/${DEFAULT_TENANT}/sites`} replace /> },
  {
    path: "/t/:tenantId",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="sites" replace /> },
      { path: "sites", element: <Sites /> },
      { path: "sites/:siteId", element: <SiteDetail /> },
      { path: "sites/:siteId/inbox", element: <SiteInbox /> },
      { path: "inbox", element: <Inbox /> },
      { path: "reports", element: <Reports /> },
      { path: "catalog", element: <Catalog /> },
      { path: "schedule", element: <Schedule /> },
      { path: "team", element: <Team /> },
      { path: "billing", element: <Billing /> },
      { path: "settings", element: <Settings /> },
    ],
  },
])
