# Dashboard Engineering Conventions

Read this before changing the dashboard. The plan is at
`../backend/DASHBOARD_PLAN.txt`; that is the source of truth for what
to build. This file is the source of truth for HOW to build it.

## Stack

React 19, Vite 8, TypeScript 6, Tailwind CSS v4, shadcn/ui (Radix
primitives copied into the repo), TanStack Table / Virtual / Query,
React Hook Form + Zod, Recharts, lucide-react, sonner, cmdk,
framer-motion, React Router 6. See plan section 0.1.

## Hard rules (no exceptions)

1. **Type-safe API client only.** No raw `fetch`, no `axios`, no hand-
   written URL strings pointing at `/api/...`. Every backend call goes
   through the typed client. Methods live in `src/api/client.ts`, types
   in `src/api/types.ts`; nothing outside `src/api/` may construct a URL
   string for the backend. Reviewer agents reject PRs that bypass it.
   If an endpoint is missing, add the method + types in `src/api/`;
   do NOT escape-hatch around it.

2. **Tenant-scoped routes only.** All authenticated routes nest under
   `/t/:tenantId/...`. New routes that don't follow this pattern are
   rejected. The placeholder `default` tenant resolves while 0.3a auth
   is pending.

3. **Use `DataTable` for every report grid.** Do not hand-roll tables.
   `src/components/data-table/DataTable.tsx` exposes controlled props
   for sorting, pagination, columnFilters, columnPinning, and a
   `rowCount` prop for server pagination.

4. **Accept shadcn defaults.** Spacing scale, typography ramp, focus
   rings, motion timings: do NOT tweak. Customise only the token block
   in `globals.css`, the `DataTable` wrapper, the health-score ring,
   and the crawl-progress component.

5. **No emojis in source / commits unless explicitly asked.**

6. **No em dashes anywhere.** Use a regular hyphen, comma, or rephrase.

7. **No `Co-Authored-By Claude` or AI attribution in commit messages.**

8. **No bash scripts.** If you need scripting, use Python or Node.js.

9. **Never pipe test or build output to grep.** Tee to a file in `/tmp`
   and read the file.

## Repo layout

```
src/
  api/                typed client (client.ts) + types (types.ts) +
                      useApiClient hook; the only place URL strings live
  auth/               AuthProvider + RequireAuth route guard
  components/
    alerts-table/     shared AlertsTable + AlertDetailDrawer
    data-table/       shared TanStack Table wrapper
    layout/           AppShell, CommandPalette, ThemeToggle, nav-items
    ui/               shadcn primitives (copied in, edit in place)
  hooks/
  lib/
  routes/             one file per route; thin, no business logic
  styles/globals.css  tokens for light + dark
```

`src/api/checkCatalog.ts` is the single source of truth for human-readable
check copy: title, description, how-to-fix, default severity, category, and
the marketing-site dotted ID. The inbox detail drawer, the per-category
drill-in, the per-AlertType drill-in, and (eventually) email and Slack
notification templates all read from it. Categories mirror
`IssuesSummaryBuilder.categoryOf` on the backend verbatim. When a new
`AlertType` lands in `src/api/types.ts`, add a matching catalog entry in the
same PR; the `checkCatalog` integrity test fails until you do.

All authenticated state flows through `useAuth()` from
`src/auth/AuthProvider.tsx`. Routes that need the session use
`<RequireAuth>` (already applied to `/t/:tenantId/...`). The bearer token
lives in localStorage (`wrendex.sessionToken`) and is auto-injected into
every API call via the client's `getAuthHeader` hook.

## Adding a new route

1. Add the route to `src/router.tsx` under `/t/:tenantId/...`.
2. Read `tenantId` and any other params with `useParams`.
3. If the route lists data, use `DataTable` with controlled state.
4. Server calls go through `useApiClient()` from `src/api/`.

### Anonymous-claim flow (plan section 2.0)

Three public routes mount above `RequireAuth` and back the marketing-hero
free-audit funnel: `/audit` is the URL-paste landing (accepts `?url=...`
from the marketing site and posts `startAnonymousCrawl`); `/a/:token` is
the public teaser results page that polls `getAnonymousCrawl` every 2s,
then renders the HealthRing + stats strip + 3 visible categories + a
locked CTA card; `/a/:token/claiming` is the brief loading view shown
post-signup while `AuthProvider.signupWithOptionalClaim` calls
`claimAnonymousCrawl` and reparents the existing crawl into the user's
new tenant. The Signup route reads `?claimToken=...&suggestedTenant=...`
to drive that branch and routes into `/t/{tenantId}/sites/{siteId}` on
success or `/t/{tenantId}/sites` with a toast on failure. The
`startAnonymousCrawl` and `getAnonymousCrawl` client methods use
`skipAuth: true` so the public bucket never sees a Bearer header.

## Adding a new shadcn component

`pnpm dlx shadcn@latest add <name>`. Then edit the generated file in
`src/components/ui/<name>.tsx` if you need to. Do NOT depend on
external component libraries.

## Routes shipped to date (non-exhaustive)

- `/t/:tenantId/sites/:siteId` - SiteDetail (overview, ring, sparkline,
  regression strip, issue queue).
- `/t/:tenantId/sites/:siteId/pages` - PageDetail. Reads `?url=...` and an
  optional `?crawlId=...`; resolves the latest completed crawl when the
  crawl id is omitted. Tabs: Overview / Performance / Links / Resources /
  Structured data / Hreflang / Alerts.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/pages` - PageExplorer
  (R.02). Server-paginated grid over `explorePages`; size capped at 200.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/redirects` - RedirectsReport
  (R.05). Reads `getRedirects`; originating-pages popover.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/resources` - ResourcesReport
  (R.08). Reads `getResources`; tabs for Images / Scripts / Stylesheets.
- `/t/:tenantId/sites/:siteId/health-history` - HealthHistory (R.01).
  ComposedChart of `getHealthScore` + a per-crawl DataTable with delta vs
  previous. Overlays deploy pins from `listReleaseAnnotations`; the call
  is wrapped in try/catch so a 404/5xx renders the page without pins.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/links` - LinkExplorer (R.03).
  Server-paginated grid over `exploreLinks`; type filter is server-side,
  rel + URL search are client-side filters on the loaded page; row click
  opens a popover with full anchor text + rel string + canonical target.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/structure` - StructureMap
  (R.04). Reads `getStructure`; renders a hand-rolled directory tree
  built client-side from the BE's flat DirectoryNode list, plus an
  Orphan-pages section sourced from `listCrawlAlerts(type=ORPHAN_PAGE)`.
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/duplicates` - DuplicatesReport
  (R.06). Reads `getDuplicates`; three shadcn Tabs (Title / Description /
  Body) filter the loaded `DuplicateGroup[]` by `field` client-side.
  H1 duplicates from BE are intentionally not surfaced (out of plan
  scope for this iteration).
- `/t/:tenantId/sites/:siteId/crawls/:crawlId/structured-data` -
  StructuredDataReport (R.07). Reads `getStructuredData` plus a single
  batched `listCrawlAlerts(crawlId, size=500)` to merge JSON_LD_* and
  JSON_LD_GOOGLE_* alerts onto the per-page entries. Raw JSON-LD is
  fetched lazily via `getPageByUrl` on expand. Filter bar: All / With
  errors / Google-eligible only.
- `/t/:tenantId/sites/:siteId/settings` - SiteSettings (iter 6 FE-7).
  Schedule editor (cadence Select; disabled if unverified, with a link
  to the existing VerificationDialog), 3 canned alert rules with
  per-rule Switch + SCORE_DROP threshold input, and a danger-zone
  delete-this-site flow gated on typing the site URL.
- `/t/:tenantId/billing` - Billing (iter 6 FE-7). Renders the
  BillingSnapshot, three plan-tier cards, a Stripe Customer Portal
  button (disabled until `hasPaymentMethod`), and an Invoices "coming
  soon" stub. Subscribe buttons call `createCheckoutSession` with
  `priceTier=STARTER|PROFESSIONAL|AGENCY` and redirect to the returned
  URL.
- `/t/:tenantId/settings` - Settings (iter 6 FE-7). Tabs: Account
  (profile, change-password form stub, sessions stub), Tenant (workspace
  name + email channel editor with kind=MEMBERS|CUSTOM|BOTH and chip
  recipients), Sites (list + per-site settings link).

## Phase 1.5 deferrals

- **Stripe Elements signup card capture (sec 1.2 step 3)** is
  scaffolded. The typed client method `createSetupIntent` returns
  `null + console.warn` until the BE endpoint ships; the Signup route
  surfaces the "Skip card capture for now" path in that case. When the
  BE wires SetupIntent + customer creation ahead of signup, swap the
  scaffolding for a real `<Elements>` provider bound to the returned
  `client_secret`. Persist the resulting payment method id under the
  localStorage key `wrendex.pendingPaymentMethodId` so the post-signup
  branch can call `createCheckoutSession({priceTier: "PROFESSIONAL",
  trialDays: 14})` to start the trial.
- **Change password (sec 14.1)** is gated by an `ApiError(501)` stub in
  `client.ts`; the form catches it and toasts a "wires up later"
  message. Replace the stub with a real request once the BE ships
  `/api/auth/change-password`.

## Funnel telemetry contract (sec 2.0 + 16)

- Sink: `client.sendTelemetry(events)` -> `POST /api/telemetry/events`
  (PUBLIC, no auth header). Best-effort; errors caught + swallowed.
- Per-browser session id: stored in localStorage under
  `wrendex.sessionId`, generated on first call, cleared on logout via
  `clearTelemetrySessionId`. The typed client folds it onto every event.
- Five events instrumented from the dashboard:
  1. `hero_paste_url` - Audit submit, props `{url}`.
  2. `crawl_finished_anonymous` - AnonymousCrawlTeaser when the polled
     status flips to "completed", props
     `{token, healthScore, totalIssues}` and `anonymousCrawlToken`.
  3. `signup_started` - Signup mount when `claimToken` is present, props
     `{claimToken}`.
  4. `signup_completed` - Signup success, props
     `{hasClaimToken, hasCardCaptured}`.
  5. `trial_active` - first /t/:tenantId/billing visit while
     `subscriptionStatus === "TRIALING"`, props `{tenantId, plan}`.
