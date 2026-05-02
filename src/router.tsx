import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/auth/RequireAuth"
import { Sites } from "@/routes/Sites"
import { SiteDetail } from "@/routes/SiteDetail"
import { CrawlHistory } from "@/routes/CrawlHistory"
import { CrawlDetailComingSoon } from "@/routes/CrawlDetailComingSoon"
import { IssueCategoryDetail } from "@/routes/IssueCategoryDetail"
import { IssueTypeDetail } from "@/routes/IssueTypeDetail"
import { PageExplorer } from "@/routes/PageExplorer"
import { PageDetail } from "@/routes/PageDetail"
import { RedirectsReport } from "@/routes/RedirectsReport"
import { ResourcesReport } from "@/routes/ResourcesReport"
import { SiteInbox } from "@/routes/SiteInbox"
import { Inbox } from "@/routes/Inbox"
import { Reports } from "@/routes/Reports"
import { Catalog } from "@/routes/Catalog"
import { Schedule } from "@/routes/Schedule"
import { Team } from "@/routes/Team"
import { Billing } from "@/routes/Billing"
import { Settings } from "@/routes/Settings"
import { SiteSettings } from "@/routes/SiteSettings"
import { Login } from "@/routes/Login"
import { Signup } from "@/routes/Signup"
import { ForgotPassword } from "@/routes/ForgotPassword"
import { ResetPassword } from "@/routes/ResetPassword"
import { RootRedirect } from "@/routes/RootRedirect"
import { Audit } from "@/routes/Audit"
import { AnonymousCrawlTeaser } from "@/routes/AnonymousCrawlTeaser"
import { AnonymousCrawlClaiming } from "@/routes/AnonymousCrawlClaiming"

// Public routes mount above RequireAuth so unauthenticated users can reach
// them without being bounced to /login. Everything else lives inside the
// guard, including the index redirect that resolves the active tenant from
// /api/me (replaces the iter-1 placeholder "default" tenant).
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  // Anonymous-crawl funnel (plan section 2.0 + 1.1 PATH A). Public; the
  // /audit landing accepts ?url=... and posts startAnonymousCrawl. The
  // teaser lives at /a/:token; /a/:token/claiming is the brief loading
  // view shown after Signup auto-claims into the new tenant.
  { path: "/audit", element: <Audit /> },
  { path: "/a/:token", element: <AnonymousCrawlTeaser /> },
  { path: "/a/:token/claiming", element: <AnonymousCrawlClaiming /> },
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
      { path: "sites/:siteId/settings", element: <SiteSettings /> },
      { path: "sites/:siteId/pages", element: <PageDetail /> },
      { path: "sites/:siteId/crawls", element: <CrawlHistory /> },
      {
        path: "sites/:siteId/crawls/:crawlId",
        element: <CrawlDetailComingSoon />,
      },
      {
        path: "sites/:siteId/crawls/:crawlId/pages",
        element: <PageExplorer />,
      },
      {
        path: "sites/:siteId/crawls/:crawlId/redirects",
        element: <RedirectsReport />,
      },
      {
        path: "sites/:siteId/crawls/:crawlId/resources",
        element: <ResourcesReport />,
      },
      {
        path: "crawls/:crawlId/issues/category/:categoryId",
        element: <IssueCategoryDetail />,
      },
      {
        path: "crawls/:crawlId/issues/type/:alertType",
        element: <IssueTypeDetail />,
      },
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
