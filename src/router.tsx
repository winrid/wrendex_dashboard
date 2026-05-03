import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/auth/RequireAuth"
import { Sites } from "@/routes/Sites"
import { SiteDetail } from "@/routes/SiteDetail"
import { CrawlHistory } from "@/routes/CrawlHistory"
import { CrawlComparison } from "@/routes/CrawlComparison"
import { NotificationLog } from "@/routes/NotificationLog"
import { HealthHistory } from "@/routes/HealthHistory"
import { LinkExplorer } from "@/routes/LinkExplorer"
import { CrawlDetailComingSoon } from "@/routes/CrawlDetailComingSoon"
import { IssueCategoryDetail } from "@/routes/IssueCategoryDetail"
import { IssueTypeDetail } from "@/routes/IssueTypeDetail"
import { PageExplorer } from "@/routes/PageExplorer"
import { PageDetail } from "@/routes/PageDetail"
import { RedirectsReport } from "@/routes/RedirectsReport"
import { ResourcesReport } from "@/routes/ResourcesReport"
import { StructureMap } from "@/routes/StructureMap"
import { DuplicatesReport } from "@/routes/DuplicatesReport"
import { StructuredDataReport } from "@/routes/StructuredDataReport"
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
import { Status } from "@/routes/Status"
import { Changelog } from "@/routes/Changelog"
import { AdminChangelog } from "@/routes/AdminChangelog"
import { AcceptInvite } from "@/routes/AcceptInvite"
import { SharedView } from "@/routes/SharedView"

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
  // Public status page (plan section 16). No tenant scope; mounted above
  // RequireAuth so the marketing trust strip can deep-link unauthenticated
  // visitors here.
  { path: "/status", element: <Status /> },
  // Public changelog page (plan section 13). PUBLIC. The bell on the
  // AppShell handles unread badge clearing for signed-in users; this page
  // is intentionally read-only.
  { path: "/changelog", element: <Changelog /> },
  // Internal admin-only changelog editor (plan section 13). AUTHENTICATED
  // but not tenant-scoped because the changelog is per-instance, not per
  // tenant. The BE returns 403 from listAdminChangelog when the caller is
  // not staff; the FE renders "You don't have access" in that branch.
  {
    path: "/admin/changelog",
    element: (
      <RequireAuth>
        <AdminChangelog />
      </RequireAuth>
    ),
  },
  // Accept-invite landing page (plan section 14.2). PUBLIC; the recipient
  // clicks the email link and lands here with ?token=... before they have
  // signed in.
  { path: "/accept-invite", element: <AcceptInvite /> },
  // Public shared-view route (plan section P3 iter 2). PUBLIC; the recipient
  // hits /shared/:token and the page resolves the share via the public POST
  // /api/shared/{token}. Mounted above RequireAuth so anonymous viewers can
  // load the view without bouncing through /login.
  { path: "/shared/:token", element: <SharedView /> },
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
      { path: "sites/:siteId/compare", element: <CrawlComparison /> },
      { path: "sites/:siteId/pages", element: <PageDetail /> },
      { path: "sites/:siteId/health-history", element: <HealthHistory /> },
      { path: "sites/:siteId/crawls", element: <CrawlHistory /> },
      {
        path: "sites/:siteId/crawls/:crawlId/links",
        element: <LinkExplorer />,
      },
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
        path: "sites/:siteId/crawls/:crawlId/structure",
        element: <StructureMap />,
      },
      {
        path: "sites/:siteId/crawls/:crawlId/duplicates",
        element: <DuplicatesReport />,
      },
      {
        path: "sites/:siteId/crawls/:crawlId/structured-data",
        element: <StructuredDataReport />,
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
      { path: "notifications/log", element: <NotificationLog /> },
      { path: "reports", element: <Reports /> },
      { path: "catalog", element: <Catalog /> },
      { path: "schedule", element: <Schedule /> },
      { path: "team", element: <Team /> },
      { path: "billing", element: <Billing /> },
      { path: "settings", element: <Settings /> },
    ],
  },
])
