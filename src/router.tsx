import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/auth/RequireAuth"
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
import { Login } from "@/routes/Login"
import { Signup } from "@/routes/Signup"
import { ForgotPassword } from "@/routes/ForgotPassword"
import { ResetPassword } from "@/routes/ResetPassword"
import { RootRedirect } from "@/routes/RootRedirect"

// Public routes mount above RequireAuth so unauthenticated users can reach
// them without being bounced to /login. Everything else lives inside the
// guard, including the index redirect that resolves the active tenant from
// /api/me (replaces the iter-1 placeholder "default" tenant).
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RootRedirect />
      </RequireAuth>
    ),
  },
  {
    path: "/t/:tenantId",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Sites /> },
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
