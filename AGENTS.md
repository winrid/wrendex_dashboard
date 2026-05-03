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
  previous.
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
- `/t/:tenantId/settings` - Settings (iter 6 FE-7 + iter 2 r1/r2 cleanup).
  Tabs: Account (profile, real change-password form, sessions stub), Tenant
  (workspace name + email channel + Slack stub + MS Teams + PagerDuty
  channel editors; channel availability gated on plan tier), Sites (list +
  per-site settings link).
- `/t/:tenantId/sites/:siteId/compare` - CrawlComparison (sec 4A.4). Reads
  ?a={crawlIdA}&b={crawlIdB}; renders a 3-up before / after / delta header,
  per-category delta diff (computed client-side from getIssuesSummary on
  both crawls), and the New / Resolved / Persisted partitions from
  getCrawlDiff(b, {against: a}) via shared AlertsTable.
- `/t/:tenantId/notifications/log` - NotificationLog (sec 4A.5). Reads
  listNotificationLog (BE iter 2 round 2). Channel + status multi-select +
  since-window filter, per-row Resend button. Renders an empty "shipping
  shortly" state when the BE 404s.
- `/t/:tenantId/catalog` - Catalog explorer (sec 6). Lazy-fetches
  `getPublicCatalog()` and merges the BE entries onto the static FE catalog
  in `src/api/checkCatalog.ts`. Search bar filters across title /
  description / type / marketingId; left sidebar narrows by category;
  per-row firing-count is fetched lazily via `listSiteAlerts(siteId,
  {type, page:0, size:1})` so we read `total` without paying for the alert
  payload. Row click navigates to the per-AlertType drill-in scoped to the
  active site's latest crawl. Console.warns when FE/BE catalogs drift.
- `/status` - public status page (sec 16). Mounts above the AppShell, no
  tenant scope, no auth. Polls `getStatus()` every 30s and renders four
  component cards (API / Crawler / Scheduler / Mongo) with operational /
  degraded / down badges + metric line. Falls back to a "coming soon"
  placeholder when the BE 404s.
- `/changelog` - public Wrendex changelog (sec 13). Mounts above
  RequireAuth. Bound to `listPublishedChangelog({limit:50})`. Renders one
  entry per row with a tag badge (NEW / IMPROVED / FIX / BREAKING), the
  formatted publish date, the title, and the body (plain text with
  whitespace preserved; no markdown dep). The signed-in bell on the
  AppShell handles unread-badge clearing, so this page is read-only.
- `/admin/changelog` - internal staff-only editor (sec 13). Authenticated
  but NOT tenant-scoped (the changelog is per-instance). DataTable bound to
  `listAdminChangelog({includeDrafts:true})` with slug / title / tag /
  publishedAt / updatedAt columns + per-row Edit + Delete. New entry
  dialog drives `createChangelogEntry`; 409 surfaces inline against the
  slug field. The BE returns 403 for non-staff callers; the route treats
  403 the same as 404 and renders "You don't have access".
- `/accept-invite` - public landing for tenant invitations (sec 14.2).
  Reads `?token=...`; on mount calls `getPublicInvite(token)` (skipAuth)
  and dispatches into one of: not-found (404), expired (410), already-
  accepted (409), signed-out (sign-in / sign-up CTAs that round-trip the
  token), signed-in-mismatch (sign-out CTA), signed-in-match (Accept
  button calling `acceptInvite(token)`). Mounts above RequireAuth.
- `/shared/:token` - public read-only share view (P3 iter 2). Mounts above
  RequireAuth. Calls `resolveSharedLink(token, {password?})` (skipAuth) and
  dispatches on `share.scope` (SITE / CRAWL_REPORT / PAGE_DETAIL) into the
  matching read-only renderer. Surfaces a small banner ("Read-only share
  from <tenantName>. Expires <relative>.") + the Wrendex logo. No sidebar,
  no tenant switcher. The route mounts the renderers under
  `<ReadOnlyProvider value={true}>`; nested action buttons (Run audit /
  Pause / Settings link / Ignore / Unignore / ShareButton itself) check
  `useReadOnly()` from `src/components/share/ReadOnlyContext.tsx` and hide
  themselves so the recipient cannot mutate state. The `Sharing` tab on
  `/t/:tenantId/settings` (4th tab) lists every share link via
  `listShareLinks` with create / copy / revoke + a "Show revoked" toggle.
  `<ShareButton scope=... targetId=... subResource?=...>` from
  `src/components/share/ShareButton.tsx` is mounted next to the existing
  CSV button on every shareable report (SiteDetail header, health-history,
  pages / links / redirects / duplicates / resources / structured-data
  reports, page detail). `/sites` (the site list) and the structure tree
  view are intentionally not shareable in v1.

- `/t/:tenantId/team` - Team page (sec 14.2). Tabs: Members, Invites,
  Audit log. Members tab is bound to `listTenantMembers` with per-row
  Change role / Remove / Make owner actions (transfer ownership flow);
  the sole-OWNER guard disables actions that would leave the tenant
  ownerless. Invites tab is bound to `listTenantInvites` with Resend
  (soft-fails on 404 since `resendInvite` is BE-optional) + Revoke.
  Audit log tab is bound to `listAuditLog` with action + since-window
  filters. Invite-member dialog (`src/components/team/InviteMemberDialog`)
  is reused across Members and Invites tabs and surfaces inline errors
  for 409 (duplicate pending) and a seat-cap upsell for 403/409 with a
  seat-hint message body.

## What's new bell + modal (sec 13)

The AppShell topbar mounts `<NotificationBell>` between `<ThemeToggle>` and
`<UserMenu>`. The bell polls `getUnreadChangelog()` every 60s; when
`unreadCount > 0` it renders a small accent-coloured badge over the icon
(capped at "9+"). Click opens `<WhatsNewModal>` (in
`src/components/changelog/WhatsNewModal.tsx`); on first render the modal
fires `markChangelogSeen()` once so the next bell poll clears the badge,
and renders entries from `listPublishedChangelog({limit:20})`. The footer
links to `/changelog` for the full public list. The `<ChangelogEntryRow>`
helper is exported from the same file and reused by the public route.

## Inbox bulk-action surface (sec 3, FE-D)

`AlertsTable` exposes `enableRowSelection`, `rowSelection`, and
`onRowSelectionChange` props that wire a leading checkbox column into the
TanStack Table state. The selection is keyed on `Alert.id` (via
`getRowId`), so toggles persist across server-paginated page changes. When
1+ rows are selected, `Inbox.tsx` renders `BulkActionToolbar` above the
table with Ignore / Snooze (24h / 7d) / Assign / Unignore actions; each
button calls into the typed-client `bulk*` methods (PATCH /api/bulk/alerts/*).
A per-row kebab dropdown surfaces the same set of single-row actions
(snoozeAlert / assignAlert / ignoreAlert). The Snoozed tab binds to
`?status=SNOOZED`; the Inbox falls back to an empty result when the BE
4xxs the SNOOZED enum.

Bulk endpoints live under `/api/bulk/alerts/*` (PATCH ignore / unignore /
snooze / assign). Single-alert routes live under `/api/alerts/{id}/*` and
all use PATCH (snooze, unsnooze, assign).

## Slack OAuth install flow (sec 8.2, FE-D)

Settings -> Tenant -> Slack channel card. Reads `getSlackChannel(tenantId)`;
404 means not connected and renders an "Install to Slack" button that
calls `startSlackInstall(tenantId, {returnUrl})` and assigns
`window.location.href` to the BE-returned URL. Slack redirects back to
`POST /api/slack/oauth/callback` (BE-handled), which 302s the browser to
the supplied returnUrl; the page re-renders with the connected card
(team name + default channel + Disconnect / Reinstall). Disconnect calls
`deleteSlackChannel(tenantId)`.

## CSV export pattern (sec 4.9)

Every report grid surfaces an "Export CSV" button that calls into
`src/lib/download.ts`. The shared `<CsvExportButton>` component constructs
the URL via `csvUrl(path, params)`, then `downloadCsv(url, filename)`
authenticated-fetches the blob. The path supplied is the same one the
typed client already hits for the JSON form; `?format=csv` is appended by
the helper. `src/lib/download.ts` is the only authorised raw-fetch surface
in feature code.

## PDF export pattern (sec 12.2)

Every report toolbar that supports PDF export sits an `<PdfExportButton>`
next to the existing `<CsvExportButton>` (see `src/components/pdf/`). The
component takes `path` (BE PDF endpoint, e.g.
`/api/crawls/{crawlId}/pages/pdf`), `filename`, and `tenantId` (so the
plan-gate 403 toast can deep-link to `/t/:tenantId/billing`). It pipes
the response through `downloadPdf` in `src/lib/download.ts`. The PDF
endpoints are PROFESSIONAL or AGENCY plan only; the BE returns 403 for
STARTER tenants and the button surfaces an upgrade prompt with a Billing
link. PDF endpoints are dedicated (no JSON form to content-negotiate
against), so URL construction lives in the consumer (next to the
report's CSV path) rather than in the typed client.

## Custom subdomain + SAML SSO (P4 iter 4)

- **Custom subdomain (Settings -> Tenant -> Custom subdomain).** AGENCY-only.
  Adds a `customSubdomain` field to `UpdateTenantBrandingInput`; non-AGENCY
  tenants see the form disabled with the same Agency plan only badge as
  the branding card. `verifySubdomain(tenantId)` POSTs to
  `/api/tenants/{tenantId}/branding/verify-subdomain` and re-resolves the
  customer's CNAME; the response merges back onto the cached
  `TenantBranding` row so the verification pill flips immediately. Pill
  states: "Not verified" (verifiedAt null) -> "Verified" (verifiedAt set
  AND lastDnsCheckResult=="ok") -> "Issue: <result>" (otherwise). Scope is
  intentionally CNAME-pointer only; TLS cert provisioning + reverse-proxy
  routing for the subdomain is Phase 5+ infra work.

- **SAML SSO config (Settings -> Tenant -> SAML SSO).** AGENCY-only on the
  BE; PUT also requires OWNER. The card surfaces three states:
  unconfigured (404 from getSamlConfig -> "SSO is not configured." +
  Configure SAML CTA), configured (200 -> summary + Edit / Disconnect),
  and plan-gated (badge + disabled). The Configure SAML dialog is a
  single form with two visual sections: Step 1 surfaces the SP metadata
  URL (`/api/saml/sp/metadata?tenantId=<active>`) with a copy button so
  the customer's IdP admin can register Wrendex as a Service Provider;
  Step 2 collects the three IdP-side fields (entityId, ssoUrl, X.509 PEM
  cert). 400 on submit pins the BE message to the cert textarea inline.
  Disconnect routes through a confirmation dialog and DELETEs the config.

- **Sign in with SSO (Login).** A "Sign in with SSO" button below the
  password form opens a small dialog asking for the workspace id or URL.
  Submit hard-navigates the browser to
  `GET /api/saml/sp/{tenantId}/login?returnTo=<origin>/`. The IdP redirect
  chain returns to the dashboard root with `#sessionToken=...` in the URL
  fragment; `AuthProvider`'s bootstrap effect plucks the token, persists
  it via `writeStoredToken`, strips the fragment with
  `history.replaceState`, then runs the normal `/api/me` hydration so
  `RequireAuth` routes the user into the resolved tenant. New helpers in
  `src/lib/sso.ts`: `ssoLoginUrl(tenantId, returnTo)` and
  `spMetadataUrl(tenantId)`. New typed-client methods: `verifySubdomain`,
  `getSamlConfig`, `updateSamlConfig`, `deleteSamlConfig`. New types:
  `TenantSamlConfig`, `UpdateSamlConfigInput`, `VerifySubdomainResponse`;
  `TenantBranding` gains `customSubdomain`, `customSubdomainVerifiedAt`,
  `lastDnsCheckAt`, `lastDnsCheckResult`.

- **SSO error codes the dashboard handles.** When the SAML flow fails the
  BE 302s the browser back to `/login?error=<code>`. `Login.tsx` keeps a
  `SSO_ERROR_MESSAGES` map keyed by code and surfaces the matching message
  as both an inline destructive Alert (data-testid `sso-error-banner`) and
  a sonner toast on mount, then strips the param via
  `history.replaceState` so a refresh doesn't re-toast. The codes the FE
  knows about (next eng: search test fixtures for these strings):
  - `saml-signature-invalid` - signing certificate mismatch / forged response.
  - `saml-issuer-unknown` - IdP entity ID does not match tenant config.
  - `saml-replay` - SAMLResponse already consumed (replay protection hit).
  - `saml-expired` - assertion expired before reaching the SP /acs.
  - `saml-missing-email` - IdP did not map an email attribute.
  - `saml-not-implemented` - legacy from the P4 stub; defensive only,
    the BE no longer emits it as of P5 iter 2.
  Unknown codes are intentionally ignored (no banner) so a stray query
  param can't fake an error state. Add a new entry to
  `SSO_ERROR_MESSAGES` in `Login.tsx` when a new BE error code lands.

## White-label branding flow (sec 12.3)

Per-tenant branding (logo, accent colour, "from name", hide
"Powered by Wrendex" toggle) is AGENCY-plan only and lives in
Settings -> Tenant -> Branding card (`BrandingCard` in
`src/routes/Settings.tsx`). The card is bound to
`getBranding(tenantId)` / `updateBranding(tenantId, ...)`; non-AGENCY
tenants see the form disabled with an "Agency plan only" badge, and a
403 from the PUT surfaces an upgrade-prompt toast with a Billing link.

`AuthProvider` loads the active tenant's branding alongside `/api/me`
and applies the accent to `document.documentElement` as a CSS variable
(`--brand-accent`); `AppShell` swaps its built-in W-mark for
`branding.logoDataUrl` when present. The `/shared/:token` route reads
the same fields off `SharedLinkInfo` (the BE-C agent extends the
resolve payload with `logoDataUrl`, `accentColor`, `hidePoweredBy`);
when the BE has not shipped them yet the FE falls back to default
branding for shared views.

## Channels matrix

Per-tenant alert channels, ordered by ship date:

  - Email channel - shipped iter 1; MEMBERS / CUSTOM / BOTH selector +
    chip recipients.
  - Slack channel - BE wired (iter 1) + FE install flow shipped (see the
    "Slack OAuth install flow" section above).
  - MS Teams channel - BE iter 2 round 2; FE form gated to
    PROFESSIONAL+ plans. Webhook URL only; "Send test alert" stub.
  - PagerDuty channel - BE iter 2 round 2; FE form gated to AGENCY plans.
    Integration key + severity floor; "Send test alert" stub.

## Stripe + auth flows

- **Stripe Elements signup card capture (sec 1.2 step 3).** The typed client
  `createSetupIntent` hits POST /api/tenants/{tenantId}/billing/setup-intent.
  The Signup route mounts `<Elements>` against the returned `client_secret`
  when a `claimToken` is present; on confirm we persist the resulting
  payment method id under `wrendex.pendingPaymentMethodId` and call
  `createCheckoutSession({priceTier: "PROFESSIONAL", trialDays: 14})` to
  start the trial. Falls back to legacy redirect-to-Checkout when
  `VITE_STRIPE_PUBLISHABLE_KEY` is unset (dev / test).
- **Change password (sec 14.1).** POST /api/auth/password/change. Settings
  -> Account ships a real RHF + zod form; 401 surfaces inline against the
  current-password field, 400 against the new-password field, 204 toasts
  success.

## Two-factor auth + personal API tokens (P4 iter 2)

- **2FA login flow.** `AuthLoginResponse` is a discriminated union: a full
  session (`{sessionToken, user}`) OR a pending-2FA shape
  (`{sessionToken, twoFactorRequired: true}`). `useAuth().login` returns
  `Me | {twoFactorRequired: true; pendingToken: string}`; the `Login`
  route detects the pending branch and never persists the pendingToken to
  localStorage. The user supplies a 6-digit TOTP code (or an 8-character
  backup code via the "Use a backup code instead" link); `useAuth().login2fa`
  POSTs `{pendingToken, code}` to `/api/auth/login/2fa` and persists the
  resulting real session.
- **2FA setup wizard.** Settings -> Account -> Two-factor authentication.
  Bound to `get2faStatus / setup2fa / verify2fa / disable2fa`. The setup
  wizard renders the otpauthUrl as a QR code via the `qrcode` package
  (rendered to a data URL and shown via `<img>`); the secret is also shown
  as text for manual entry. Successful verify surfaces the 10 single-use
  backup codes once; the user must save them before closing the dialog.
  Disable requires either a current TOTP or backup code.
- **Personal API tokens.** Settings -> Account -> Personal API tokens.
  DataTable bound to `listApiTokens`; create / revoke via `createApiToken`
  / `revokeApiToken`. The plaintext token is returned exactly once in
  `CreateApiTokenResponse.token` and surfaced inside a "save this now"
  panel; subsequent reads only show the prefix. A Bearer header that
  starts with `wrn_` identifies a personal API token (vs. a regular session
  token); the BE auth middleware uses the prefix to pick the validation
  path.

## Saved views pattern (P4 iter 1)

Any DataTable surface can opt into named filter+sort+pagination segments
via `<SavedViewMenu>` from `src/components/saved-views/SavedViewMenu.tsx`.
The consumer hands the menu three pieces:

- `route` - a stable React Router URL pattern (e.g.
  `/sites/:siteId/crawls/:crawlId/pages`), NOT the resolved URL. The same
  segment can re-apply across different sites/crawls.
- `currentFilter` - any JSON-serialisable snapshot of the surface's state.
  The menu treats it as opaque; the consumer owns the shape.
- `onApply(filter)` - called with the parsed snapshot when the user picks
  a segment. The consumer is responsible for slotting it back into local
  state and validating it (use a typeguard - ill-formed JSON is possible
  if a schema rev lands later).

The persisted row (`SavedView`) lives behind the typed-client methods
`listSavedViews / createSavedView / updateSavedView / deleteSavedView`.
Page Explorer + Inbox ship in v1; other DataTable surfaces can opt in
incrementally.

The AppShell sidebar mounts a "Saved views" group below the static nav
that lists the active tenant's segments scoped to the current site (or
tenant-wide when no site context). Click stashes the parsed filter via
`stashPendingSavedView` from
`src/components/saved-views/handoff.ts`, resolves any `:crawlId` in the
route by reading `listCrawlsBySite` (latest completed run wins), and
navigates to the resolved URL. The destination route reads the handoff
on mount via `consumePendingSavedView(route)` and applies it once.

## Custom alert-rule composer (P4 iter 3)

`/t/:tenantId/sites/:siteId/settings` -> Alert rules card. Below the three
canned rules (NEW_ERROR / SCORE_DROP / WEEKLY_DIGEST), a "+ Custom rule"
button opens a 4-step composer dialog (Trigger / Filters / Channels /
Name+Review). Submit calls `createCustomAlertRule(siteId, {enabled: true,
params})` which posts to `POST /api/sites/{siteId}/alert-rules` with
`kind: "CUSTOM"`. The trigger union covers ALERT_FIRED, SCORE_THRESHOLD,
ALERT_COUNT_THRESHOLD, and DIGEST_PERIOD; filters are optional (categories
from `checkCatalog.getAllCategories()`, types autocomplete from
`getAllChecks()`, severities, pageUrlContains, minPagesAffected); channels
default to "all configured" when left empty. CUSTOM rules render with a
Delete button that confirms via a dialog and calls `deleteAlertRule(siteId,
ruleId)`; canned rules return 409/403 from the BE so the FE hides Delete
on them entirely. New typed-client methods: `createAlertRule`,
`createCustomAlertRule`, `deleteAlertRule`. New types in `src/api/types.ts`:
`CustomAlertRuleParams`, `AlertRuleTrigger` (discriminated union),
`AlertRuleFilters`, `CreateAlertRuleInput`.

## cmd-K global search (P4 iter 3)

`CommandPalette` (`src/components/layout/CommandPalette.tsx`) extends the
nav-only Navigate group with a global-search surface. Typing into the input
debounces 200ms then calls `client.search({q, tenantId, limit: 20})` (BE
`GET /api/search`). Results are grouped by kind into Sites / Pages / Alerts
/ Checks groups; each item renders title + snippet + an icon and clicking
navigates to `result.route`. The Navigate group is always rendered at the
bottom; when the query is empty only Navigate is shown (the original
behaviour). New typed-client method: `search`. New types: `SearchResult`,
`SearchResultKind`, `SearchParams`, `SearchResponse`.

## Spot-audit launcher (P4 iter 1)

`/t/:tenantId/sites/:siteId/spot-audit` is a single-form route that POSTs
`startSpotAudit(siteId, {urls})` after splitting a textarea / uploaded
.txt file on newlines. Validation:

- Cap at 1000 URLs (matches the BE cap).
- Each URL must be HTTP / HTTPS (hard error).
- URLs that don't share the site's hostname are warned, not blocked
  (the BE 400s on hostname mismatch; the FE surfaces that response).

On 202 the route navigates to
`/t/:tenantId/sites/:siteId/crawls/:crawlRunId`; the existing crawl-
history listing surfaces the new run once the worker picks it up. A
"Spot audit" button on the SiteDetail header (next to "Run audit now")
opens the form.

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

## Phase 4 deferrals

One Phase 4 surface still ships with an intentional gap. The FE shell exists
(so the marketing + sales motion can demo it) but the infra work that would
make it fully usable lands in Phase 5+. Treat the item below as known-half-
shipped; do not add escape-hatch UX without coordinating with the BE.

- **Custom subdomain UI configures CNAME pointers only.** The Settings ->
  Tenant -> Custom subdomain card stores the customer's chosen subdomain
  and verifies the CNAME points at wrendex.com via
  `verifySubdomain(tenantId)`. The TLS provisioning subsection (P5 iter 3)
  bolts ACME-backed cert lifecycle onto the same card; reverse-proxy routing
  for the configured subdomain is still Phase 5+ infra work.

## TLS provisioning lifecycle (P5 iter 3)

The Settings -> Tenant -> Custom subdomain card carries a "TLS certificate"
subsection below the DNS verification pill. Bound to `getTlsCert(tenantId)`
with three typed-client methods: `getTlsCert`, `provisionTls`, `revokeTls`.
New types: `TenantTlsCert`, `TlsCertStatus`. The state machine the FE
surfaces:

  - 404 from getTlsCert -> "No TLS certificate yet." + Provision TLS button
    (gated on `customSubdomainVerifiedAt` being set).
  - status=PROVISIONING -> "Provisioning... (this can take 1-2 minutes)"
    plus an animated poll-active indicator. The query refetches every 10s
    while status is PROVISIONING or RENEWING; auto-stops on ACTIVE / FAILED.
  - status=ACTIVE -> "Active. Issued: <relative>. Renews: <relative>."
    plus a Revoke button that opens an AlertDialog confirmation; confirm
    calls `revokeTls(tenantId)` (OWNER-only on the BE).
  - status=RENEWING -> "Renewing in the background. Current cert remains
    active until renewal completes." (No user action; the BE renewal sweep
    drives the transition back to ACTIVE.)
  - status=FAILED -> "Provisioning failed: <lastError>" + Retry button that
    re-calls `provisionTls(tenantId)`.

`provisionTls` 409s when the subdomain is not yet CNAME-verified or an
order is already in flight; 400 if the subdomain is unset; 403 for non-
AGENCY tenants. The card surfaces those as toasts and leaves the cert
state untouched. The inline help text under the section heading reads:
"TLS provisioning uses Let's Encrypt. Allow ~60-90 seconds after the DNS
CNAME points at us before clicking Provision."

## Code-splitting

Every route is lazy-loaded via `React.lazy()` in `src/router.tsx` (P5 iter 1
FE-A). The main entry chunk only carries `AppShell`, `RequireAuth`,
`AuthProvider`, the typed client, and shared shell deps; per-route code +
heavy dependencies (recharts, qrcode, framer-motion deep usage) follow their
consumers into separate chunks. New routes added later should follow the
same lazy-import pattern: define a `lazy(() => import("@/routes/X").then(m =>
({default: m.X})))` next to the existing entries and reference it from the
route table. Public routes use a shared `<PublicSuspenseLayout>` wrapper for
their `<Suspense>` fallback; authenticated routes share a single `<Suspense>`
inside `<AppShell>` around the nested `<Outlet />`. The fallback is
`<RouteFallback />` from `src/components/layout/RouteFallback.tsx`.
