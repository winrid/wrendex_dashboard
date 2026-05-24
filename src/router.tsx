import { lazy, Suspense } from "react"
import { createBrowserRouter, Outlet } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/auth/RequireAuth"
import { RouteFallback } from "@/components/layout/RouteFallback"

// Route-level code-splitting (P5 iter 1 FE-A). Every route element is loaded
// lazily so the main entry chunk only carries AppShell + RequireAuth +
// AuthProvider + the typed client. Recharts, framer-motion, cmdk, qrcode etc.
// follow their consumer routes into separate chunks. See AGENTS.md
// "Code-splitting".
//
// Each route file uses a named export, so we adapt to React.lazy()'s default-
// export contract via `.then(m => ({ default: m.X }))`. New routes added later
// should follow the same pattern.

const Sites = lazy(() =>
  import("@/routes/Sites").then((m) => ({ default: m.Sites })),
)
const SiteDetail = lazy(() =>
  import("@/routes/SiteDetail").then((m) => ({ default: m.SiteDetail })),
)
const SpotAudit = lazy(() =>
  import("@/routes/SpotAudit").then((m) => ({ default: m.SpotAudit })),
)
const CrawlHistory = lazy(() =>
  import("@/routes/CrawlHistory").then((m) => ({ default: m.CrawlHistory })),
)
const CrawlComparison = lazy(() =>
  import("@/routes/CrawlComparison").then((m) => ({
    default: m.CrawlComparison,
  })),
)
const NotificationLog = lazy(() =>
  import("@/routes/NotificationLog").then((m) => ({
    default: m.NotificationLog,
  })),
)
const HealthHistory = lazy(() =>
  import("@/routes/HealthHistory").then((m) => ({ default: m.HealthHistory })),
)
const LinkExplorer = lazy(() =>
  import("@/routes/LinkExplorer").then((m) => ({ default: m.LinkExplorer })),
)
const CrawlDetailComingSoon = lazy(() =>
  import("@/routes/CrawlDetailComingSoon").then((m) => ({
    default: m.CrawlDetailComingSoon,
  })),
)
const IssueCategoryDetail = lazy(() =>
  import("@/routes/IssueCategoryDetail").then((m) => ({
    default: m.IssueCategoryDetail,
  })),
)
const IssueTypeDetail = lazy(() =>
  import("@/routes/IssueTypeDetail").then((m) => ({
    default: m.IssueTypeDetail,
  })),
)
const PageExplorer = lazy(() =>
  import("@/routes/PageExplorer").then((m) => ({ default: m.PageExplorer })),
)
const PageDetail = lazy(() =>
  import("@/routes/PageDetail").then((m) => ({ default: m.PageDetail })),
)
const RedirectsReport = lazy(() =>
  import("@/routes/RedirectsReport").then((m) => ({
    default: m.RedirectsReport,
  })),
)
const ResourcesReport = lazy(() =>
  import("@/routes/ResourcesReport").then((m) => ({
    default: m.ResourcesReport,
  })),
)
const StructureMap = lazy(() =>
  import("@/routes/StructureMap").then((m) => ({ default: m.StructureMap })),
)
const DuplicatesReport = lazy(() =>
  import("@/routes/DuplicatesReport").then((m) => ({
    default: m.DuplicatesReport,
  })),
)
const StructuredDataReport = lazy(() =>
  import("@/routes/StructuredDataReport").then((m) => ({
    default: m.StructuredDataReport,
  })),
)
const SiteInbox = lazy(() =>
  import("@/routes/SiteInbox").then((m) => ({ default: m.SiteInbox })),
)
const Inbox = lazy(() =>
  import("@/routes/Inbox").then((m) => ({ default: m.Inbox })),
)
const Reports = lazy(() =>
  import("@/routes/Reports").then((m) => ({ default: m.Reports })),
)
const Catalog = lazy(() =>
  import("@/routes/Catalog").then((m) => ({ default: m.Catalog })),
)
const Schedule = lazy(() =>
  import("@/routes/Schedule").then((m) => ({ default: m.Schedule })),
)
const Team = lazy(() =>
  import("@/routes/Team").then((m) => ({ default: m.Team })),
)
const Billing = lazy(() =>
  import("@/routes/Billing").then((m) => ({ default: m.Billing })),
)
const CreditUsage = lazy(() =>
  import("@/routes/CreditUsage").then((m) => ({ default: m.CreditUsage })),
)
const Settings = lazy(() =>
  import("@/routes/Settings").then((m) => ({ default: m.Settings })),
)
const SiteSettings = lazy(() =>
  import("@/routes/SiteSettings").then((m) => ({ default: m.SiteSettings })),
)
const Login = lazy(() =>
  import("@/routes/Login").then((m) => ({ default: m.Login })),
)
const Signup = lazy(() =>
  import("@/routes/Signup").then((m) => ({ default: m.Signup })),
)
const ForgotPassword = lazy(() =>
  import("@/routes/ForgotPassword").then((m) => ({
    default: m.ForgotPassword,
  })),
)
const ResetPassword = lazy(() =>
  import("@/routes/ResetPassword").then((m) => ({ default: m.ResetPassword })),
)
const RootRedirect = lazy(() =>
  import("@/routes/RootRedirect").then((m) => ({ default: m.RootRedirect })),
)
const Audit = lazy(() =>
  import("@/routes/Audit").then((m) => ({ default: m.Audit })),
)
const AnonymousCrawlTeaser = lazy(() =>
  import("@/routes/AnonymousCrawlTeaser").then((m) => ({
    default: m.AnonymousCrawlTeaser,
  })),
)
const AnonymousCrawlClaiming = lazy(() =>
  import("@/routes/AnonymousCrawlClaiming").then((m) => ({
    default: m.AnonymousCrawlClaiming,
  })),
)
const Status = lazy(() =>
  import("@/routes/Status").then((m) => ({ default: m.Status })),
)
const Changelog = lazy(() =>
  import("@/routes/Changelog").then((m) => ({ default: m.Changelog })),
)
const AdminChangelog = lazy(() =>
  import("@/routes/AdminChangelog").then((m) => ({
    default: m.AdminChangelog,
  })),
)
const AcceptInvite = lazy(() =>
  import("@/routes/AcceptInvite").then((m) => ({ default: m.AcceptInvite })),
)
const SharedView = lazy(() =>
  import("@/routes/SharedView").then((m) => ({ default: m.SharedView })),
)
const NotFound = lazy(() =>
  import("@/routes/NotFound").then((m) => ({ default: m.NotFound })),
)

// Public-route layout: every public element is a lazy chunk, so wrap them in a
// shared <Suspense> via an Outlet shell. Authenticated routes get their own
// <Suspense> inside <AppShell> around the nested <Outlet> (kept eager so the
// sidebar / topbar remain on screen during the per-route chunk fetch).
function PublicSuspenseLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  )
}

// Public routes mount above RequireAuth so unauthenticated users can reach
// them without being bounced to /login. Everything else lives inside the
// guard, including the index redirect that resolves the active tenant from
// /api/me (replaces the iter-1 placeholder "default" tenant).
export const router = createBrowserRouter([
  {
    element: <PublicSuspenseLayout />,
    children: [
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
      // Catch-all for any unmatched top-level URL. Mounted under the public
      // layout so anonymous visitors hitting a stale link get a real 404 page
      // with a "Back home" CTA instead of React Router's default error text.
      { path: "*", element: <NotFound /> },
    ],
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
      { path: "sites/:siteId/spot-audit", element: <SpotAudit /> },
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
      { path: "usage", element: <CreditUsage /> },
      { path: "settings", element: <Settings /> },
      // Catch-all under AppShell: any unmatched /t/:tenantId/... URL renders
      // 404 inside the shell so the sidebar, search bar, and tenant nav stay
      // visible. NotFound reads useParams to surface a "Back to your sites"
      // link pinned to the current tenant.
      { path: "*", element: <NotFound /> },
    ],
  },
])
