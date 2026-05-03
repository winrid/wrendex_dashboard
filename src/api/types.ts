// Typed API contract bound to the Javalin backend at
// /home/winrid/dev/wrendex/backend (com.bigbug.api.* + com.bigbug.model.*
// + com.bigbug.report.*). ObjectId is serialised as a hex string by
// App.java's Jackson SimpleModule; Instant is serialised as ISO 8601.
// Hand-written rather than generated so the dashboard has a single
// authoritative module to import from. Keep field names in sync with the
// Java source - no aliasing.

// ---------------------------------------------------------------------------
// Enums (mirror the Java enums verbatim - string literal unions so they
// round-trip through JSON without any runtime mapping layer).
// ---------------------------------------------------------------------------

export type Severity = "ERROR" | "WARNING" | "NOTICE"

export type AlertStatus = "OPEN" | "RESOLVED" | "IGNORED"

/** Mirrors com.bigbug.model.AlertType. Generated literally from the Java
 *  enum file - keep in sync if a new alert type lands. */
export type AlertType =
  // Title
  | "TITLE_MISSING"
  | "TITLE_TOO_LONG"
  | "TITLE_TOO_SHORT"
  | "TITLE_MULTIPLE"
  // Meta Description
  | "META_DESCRIPTION_MISSING"
  | "META_DESCRIPTION_TOO_LONG"
  | "META_DESCRIPTION_TOO_SHORT"
  | "META_DESCRIPTION_MULTIPLE"
  // Headings
  | "H1_MISSING"
  | "H1_MULTIPLE"
  // HTTP Status
  | "HTTP_404"
  | "HTTP_403"
  | "HTTP_409"
  | "HTTP_4XX"
  | "HTTP_500"
  | "HTTP_5XX"
  // Indexability
  | "NOINDEX_PAGE"
  | "NOFOLLOW_PAGE"
  | "NOINDEX_FOLLOW"
  | "NOINDEX_NOFOLLOW"
  | "NOINDEX_CONFLICT"
  | "NOFOLLOW_CONFLICT"
  // Markup
  | "INVALID_LANG"
  | "MISSING_VIEWPORT"
  // Content
  | "LOW_WORD_COUNT"
  // Performance
  | "SLOW_PAGE"
  | "OVERSIZED_HTML"
  | "NO_COMPRESSION"
  | "SLOW_TTFB"
  // Internal Links
  | "NO_OUTGOING_LINKS"
  | "DOUBLE_SLASH_URL"
  | "TOO_MANY_URL_PARAMS"
  // Images
  | "MISSING_ALT_TEXT"
  | "BROKEN_IMAGE"
  | "OVERSIZED_IMAGE"
  | "IMAGE_REDIRECT"
  | "MISSING_IMAGE_DIMENSIONS"
  // Social
  | "MISSING_OG_TAGS"
  | "OG_CANONICAL_MISMATCH"
  | "MISSING_TWITTER_CARD"
  // Redirects
  | "REDIRECT_302"
  | "REDIRECT_3XX"
  | "BROKEN_REDIRECT"
  | "REDIRECT_CHAIN"
  | "REDIRECT_CHAIN_TOO_LONG"
  | "REDIRECT_LOOP"
  | "HTTPS_TO_HTTP_REDIRECT"
  | "HTTP_TO_HTTPS_REDIRECT"
  | "META_REFRESH_REDIRECT"
  | "TIMEOUT"
  // Security
  | "HTTPS_LINKS_TO_HTTP"
  | "HTTP_LINKS_TO_HTTPS"
  | "HTTPS_CSS_TO_HTTP"
  | "HTTPS_JS_TO_HTTP"
  | "HTTPS_IMG_TO_HTTP"
  // Hreflang
  | "INVALID_HREFLANG"
  | "HREFLANG_LANG_MISMATCH"
  | "HREFLANG_MISSING_SELF_REF"
  | "HREFLANG_MISSING_X_DEFAULT"
  // Canonical
  | "CANONICAL_POINTS_TO_4XX"
  | "CANONICAL_POINTS_TO_5XX"
  | "CANONICAL_POINTS_TO_REDIRECT"
  | "CANONICAL_NO_INCOMING_LINKS"
  | "CANONICAL_HTTP_TO_HTTPS"
  | "CANONICAL_HTTPS_TO_HTTP"
  | "NON_CANONICAL_AS_CANONICAL"
  // Internal Links (post-crawl)
  | "LINKS_TO_REDIRECT_INDEXABLE"
  | "LINKS_TO_REDIRECT_NON_INDEXABLE"
  | "LINKS_TO_BROKEN_NON_INDEXABLE"
  | "NOFOLLOW_ONLY_INCOMING"
  | "MIXED_FOLLOW_INCOMING"
  | "NOFOLLOW_OUTGOING_INTERNAL"
  | "SINGLE_DOFOLLOW_INCOMING"
  | "REDIRECT_NO_INCOMING"
  // Hreflang (post-crawl)
  | "HREFLANG_POINTS_TO_BROKEN"
  | "HREFLANG_POINTS_TO_REDIRECT"
  | "HREFLANG_MISSING_RECIPROCAL"
  | "HREFLANG_POINTS_TO_NON_CANONICAL"
  // Hreflang (per-page)
  | "HREFLANG_MULTI_LANG_SINGLE_PAGE"
  | "HREFLANG_MULTI_PAGE_SINGLE_LANG"
  // Duplicates (post-crawl)
  | "IDENTICAL_CONTENT"
  // Canonical (post-crawl)
  | "DUPLICATES_NO_CANONICAL"
  // CSS
  | "BROKEN_CSS"
  | "OVERSIZED_CSS"
  | "REDIRECTED_CSS"
  // JS
  | "BROKEN_JS"
  | "OVERSIZED_JS"
  | "REDIRECTED_JS"
  // External Links
  | "EXTERNAL_LINK_3XX"
  | "EXTERNAL_LINK_4XX"
  | "EXTERNAL_LINK_BLOCKED"
  | "EXTERNAL_LINK_5XX"
  | "EXTERNAL_LINK_TIMEOUT"
  | "EXTERNAL_LINK_5XX_REDIRECT"
  // Render-blocking
  | "RENDER_BLOCKING_CSS"
  | "RENDER_BLOCKING_JS"
  // Robots.txt
  | "ROBOTS_TXT_INACCESSIBLE"
  // Cross-crawl changes
  | "TITLE_CHANGED"
  | "META_DESCRIPTION_CHANGED"
  | "H1_CHANGED"
  | "WORD_COUNT_CHANGED"
  | "REDIRECT_TARGET_CHANGED"
  | "BECAME_NON_INDEXABLE"
  // Sitemap
  | "SITEMAP_3XX_REDIRECT"
  | "SITEMAP_4XX"
  | "SITEMAP_403_FORBIDDEN"
  | "SITEMAP_5XX"
  | "SITEMAP_NOINDEX"
  | "SITEMAP_NON_CANONICAL"
  | "SITEMAP_TIMEOUT"
  | "INVALID_SITEMAP_FORMAT"
  | "MISSING_FROM_SITEMAP"
  | "DUPLICATE_IN_SITEMAPS"
  // Structured Data (Schema.org)
  | "JSON_LD_PARSE_ERROR"
  | "JSON_LD_MISSING_TYPE"
  | "JSON_LD_INVALID_TYPE"
  | "JSON_LD_INVALID_PROPERTY"
  | "JSON_LD_UNEXPECTED_PROPERTY_TYPE"
  | "JSON_LD_UNEXPECTED_PROPERTY"
  | "JSON_LD_INVALID_VALUE"
  | "JSON_LD_DUPLICATE_PROPERTY"
  | "JSON_LD_DEPRECATED_TYPE"
  | "JSON_LD_DEPRECATED_PROPERTY"
  // Structured Data (Google Rich Results)
  | "JSON_LD_GOOGLE_MISSING_REQUIRED"
  | "JSON_LD_GOOGLE_MISSING_ONE_OF_REQUIRED"
  | "JSON_LD_GOOGLE_PROPERTY_MISSING_TYPE"
  | "JSON_LD_GOOGLE_MISSING_IMAGE"
  | "JSON_LD_GOOGLE_INVALID_DATE"
  | "JSON_LD_GOOGLE_UNRECOGNIZED_PROPERTY"
  | "JSON_LD_GOOGLE_UNRESOLVED_ID"
  | "JSON_LD_GOOGLE_EMPTY_FIELD"
  | "JSON_LD_GOOGLE_INVALID_VALUE"
  // Post-crawl
  | "DUPLICATE_TITLE"
  | "DUPLICATE_META_DESCRIPTION"
  | "DUPLICATE_H1"
  | "ORPHAN_PAGE"
  | "LINKS_TO_BROKEN"
  // AMP
  | "AMP_VALIDATION_ERRORS"
  | "AMP_CANONICAL_MISMATCH"
  | "AMP_EXCESSIVE_CSS"
  // Duplicate Code
  | "DUPLICATE_JS_CODE"
  | "DUPLICATE_CSS_CODE"

// ---------------------------------------------------------------------------
// Models (com.bigbug.model.*)
// ---------------------------------------------------------------------------

export type Tenant = {
  id: string
  name: string
  createdAt: string
}

/** Mirrors com.bigbug.model.SiteCadence. null on the wire is treated as
 *  PAUSED by the backend (see Site.resolvedCadence). */
export type SiteCadence = "PAUSED" | "DAILY" | "HOURLY" | "CONTINUOUS"

export type Site = {
  id: string
  tenantId: string
  url: string
  createdAt: string
  lastCrawlAt?: string | null
  maxPages?: number | null
  maxConcurrentRequests?: number | null
  maxRequestsPerSecond?: number | null
  requestTimeoutSeconds?: number | null
  userAgent?: string | null
  jsRendering?: boolean | null
  /** Verification fields (plan section 0.3a / 1.2 step 6). */
  verificationMethod?: SiteVerificationMethod | null
  verificationToken?: string | null
  verifiedAt?: string | null
  lastVerificationCheckAt?: string | null
  /** Schedule fields (plan section 4A). null means PAUSED. */
  cadence?: SiteCadence | null
  nextRunAt?: string | null
  lastScheduledRunAt?: string | null
}

export type CrawlRun = {
  id: string
  siteId: string
  startedAt: string
  finishedAt?: string | null
  status: string
  pagesDiscovered: number
  pagesCrawled: number
  healthScore: number
  errorCount: number
  warningCount: number
  noticeCount: number
}

export type RedirectHop = {
  url: string
  statusCode: number
  location: string
}

export type HreflangEntry = {
  hreflang: string
  href: string
}

export type Link = {
  href: string
  resolvedUrl: string
  anchorText: string
  nofollow: boolean
  rel?: string | null
  context?: string | null
  loading?: string | null
  width?: string | null
  height?: string | null
  media?: string | null
  async: boolean
  defer: boolean
}

/** Page (key fields only - matches what the dashboard renders today).
 *  Many transient/internal fields on the Java model are intentionally
 *  omitted; add them here if the UI starts depending on them. */
export type Page = {
  id: string
  siteId: string
  crawlRunId: string
  url: string
  statusCode: number
  contentType?: string | null
  responseTimeMs: number
  ttfbMs: number
  contentLengthBytes: number
  title?: string | null
  metaDescription?: string | null
  h1?: string | null
  canonicalUrl?: string | null
  robotsMeta?: string | null
  lang?: string | null
  titleCount: number
  metaDescriptionCount: number
  h1Count: number
  viewportContent?: string | null
  wordCount: number
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  ogUrl?: string | null
  twitterCard?: string | null
  xRobotsTag?: string | null
  fromPageId?: string | null
  outgoingLinks?: Link[] | null
  redirectChain?: RedirectHop[] | null
  timedOut: boolean
  redirectLoop: boolean
  contentEncoding?: string | null
  hreflangEntries?: HreflangEntry[] | null
  metaRefreshUrl?: string | null
  contentHash?: string | null
  jsonLdScripts?: string[] | null
  crawledAt: string
  ampPage: boolean
}

export type Alert = {
  id: string
  pageId?: string | null
  siteId: string
  crawlRunId: string
  pageUrl: string
  type: AlertType
  severity: Severity
  message: string
  detail?: string | null
  createdAt: string
  status: AlertStatus
  lastSeenAt?: string | null
  resolvedAt?: string | null
  expiresAt?: string | null
  affectedUrls?: string[] | null
}

// ---------------------------------------------------------------------------
// Report DTOs (com.bigbug.report.*)
// ---------------------------------------------------------------------------

/** Wrapped pagination shape. The /api/{...}/alerts endpoints return this when
 *  ANY pagination/filter param is supplied; otherwise they return a bare
 *  Alert[]. The client always opts-in to this shape by passing page=0, so
 *  feature code never has to branch on the response type. */
export type AlertQueryResult = {
  items: Alert[]
  total: number
  page: number
  size: number
}

/** Type alias kept for consumers that prefer the plan-canonical name; same
 *  shape as AlertQueryResult. */
export type AlertList = AlertQueryResult

/** Response of GET /api/crawls/{crawlId}/diff?against={prevCrawlId}. Backed
 *  by CrawlController.getCrawlDiff (iter 4 BE-4). The three lists are each
 *  hard-capped at the BE's DIFF_MAX (currently 200); the *Truncated booleans
 *  flip when the underlying set was larger. The partition rules:
 *
 *   - new: alerts present in `crawlId` whose first stamping post-dates the
 *     previous crawl's startedAt.
 *   - resolved: alerts present in the previous crawl that the current crawl
 *     did not refresh (no row stamped with the current crawlRunId).
 *   - persisted: alerts present in BOTH crawls, intersection by
 *     (siteId, pageUrl, type).
 */
export type CrawlDiff = {
  new: Alert[]
  resolved: Alert[]
  persisted: Alert[]
  newTruncated: boolean
  resolvedTruncated: boolean
  persistedTruncated: boolean
}

export type CategorySummary = {
  category: string
  errorCount: number
  warningCount: number
  noticeCount: number
  byType: Record<string, number>
}

export type IssuesSummary = {
  totalIssues: number
  bySeverity: Record<string, number>
  byCategory: CategorySummary[]
}

export type CrawlLogEntry = {
  id: string
  startedAt: string
  finishedAt?: string | null
  durationMs?: number | null
  status: string
  pagesDiscovered: number
  pagesCrawled: number
  healthScore: number
  errorCount: number
  warningCount: number
  noticeCount: number
}

/** Wire row for the Page Explorer table (BE iter 2 round 1). PageRow on the
 *  BE side wraps Page via Jackson @JsonUnwrapped so every Page field is
 *  flattened at the top level of each entry; PageRow extends Page with four
 *  derived fields the FE table now reads: errorCount / warningCount /
 *  noticeCount (per-page alert counts) and indexable (BE-side robotsMeta
 *  derivation). FE code that consumed the legacy Page shape keeps working
 *  because every Page field is still present. */
export type PageRow = Page & {
  errorCount: number
  warningCount: number
  noticeCount: number
  indexable: boolean
}

export type PageResult = {
  pages: PageRow[]
  total: number
  page: number
  size: number
}

export type LinkEntry = {
  sourceUrl: string
  targetUrl: string
  anchorText: string
  nofollow: boolean
  context?: string | null
  external: boolean
  targetStatusCode: number
}

export type LinkResult = {
  links: LinkEntry[]
  total: number
  page: number
  size: number
}

export type DirectoryNode = {
  path: string
  pageCount: number
  avgResponseTimeMs: number
  avgWordCount: number
  statusCodeCounts: Record<string, number>
}

export type RedirectEntry = {
  sourceUrl: string
  finalUrl: string
  statusCode: number
  chainLength: number
  hops: RedirectHop[]
  loop: boolean
  hasMetaRefresh: boolean
  /** Pages that link to the redirecting URL (iter 2). */
  originatingPages?: string[] | null
}

export type RedirectsResult = {
  entries: RedirectEntry[]
  totalChains: number
  totalLoops: number
}

/** Mirrors com.bigbug.report.DuplicateGroup. The BE emits one of:
 *  - field="content" + hash=<contentHash> + value=null  (body duplicates)
 *  - field="title"|"metaDescription"|"h1" + hash=null + value=<the dup string>
 *  Both `hash` and `value` are nullable on the wire; only one is set per
 *  group. */
export type DuplicateGroup = {
  hash: string | null
  urls: string[]
  field: string
  value: string | null
}

export type DuplicatesResult = {
  groups: DuplicateGroup[]
  totalDuplicateGroups: number
}

export type ResourceEntry = {
  url: string
  type: string
  sourcePageCount: number
  /** Sample of the URLs of the pages that include this resource (iter 2). */
  originatingPages?: string[] | null
  /** True when the resource blocks rendering (iter 2). */
  renderBlocking?: boolean | null
  /** Hash bucket the duplicate-resource detector groups this resource under
   *  (iter 2). null when the resource is not part of a dup group. */
  duplicateTracker?: string | null
}

export type ResourcesResult = {
  resources: ResourceEntry[]
  totalCss: number
  totalJs: number
  totalImages: number
}

export type SocialEntry = {
  url: string
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  ogUrl?: string | null
  twitterCard?: string | null
  hasOg: boolean
  hasTwitter: boolean
}

export type SocialResult = {
  entries: SocialEntry[]
  totalPages: number
  pagesWithOg: number
  pagesWithTwitter: number
  pagesWithNeither: number
}

export type StructuredDataEntry = {
  url: string
  scriptCount: number
  types: string[]
}

export type StructuredDataResult = {
  entries: StructuredDataEntry[]
  totalPagesWithStructuredData: number
  totalScripts: number
  typeCounts: Record<string, number>
}

/** Shape of /api/sites/{siteId}/health-score (ReportController.getHealthScore).
 *  As of iter 2 commit 8e66c9d the endpoint also serializes errorCount /
 *  warningCount / noticeCount per entry so the trend sparkline can plot them
 *  alongside the score without a second round-trip. */
export type HealthScorePoint = {
  crawlRunId: string
  startedAt: string
  /** Wall-clock time the crawl finished. Null while the crawl is still
   *  running; populated post-completion (BE Phase 1 fix). */
  finishedAt?: string | null
  healthScore: number
  errorCount: number
  warningCount: number
  noticeCount: number
}

// ---------------------------------------------------------------------------
// Common request shapes
// ---------------------------------------------------------------------------

export type AlertListParams = {
  page?: number
  size?: number
  severity?: Severity
  type?: AlertType
  pageUrlContains?: string
  pageId?: string
  status?: AlertStatus
  /** Restrict alerts to a single crawl run. Honoured by the
   *  /api/sites/{siteId}/alerts endpoint (Phase 1 fix). */
  crawlRunId?: string
  sort?: string
  dir?: "asc" | "desc"
}

export type PageExploreParams = {
  page?: number
  size?: number
  sort?: string
  dir?: "asc" | "desc"
  statusCode?: number
}

export type LinkExploreParams = {
  page?: number
  size?: number
  sort?: string
  dir?: "asc" | "desc"
  type?: "internal" | "external" | string
}

export type CreateTenantInput = {
  name: string
}

// ---------------------------------------------------------------------------
// Auth (plan section 0.3a). Mirrors the wire shapes documented by the
// backend AuthController; see backend commit a2a85d21.
// ---------------------------------------------------------------------------

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER"

export type User = {
  id: string
  email: string
  createdAt: string
}

export type Membership = {
  tenantId: string
  tenantName: string
  role: Role
}

export type Me = {
  user: User
  memberships: Membership[]
  activeTenantId: string | null
}

export type AuthSignupRequest = {
  email: string
  password: string
  tenantName: string
}

export type AuthSignupResponse = {
  sessionToken: string
  user: User
  tenant: Tenant
  role: Role
}

export type AuthLoginRequest = {
  email: string
  password: string
}

export type AuthLoginResponse = {
  sessionToken: string
  user: User
}

export type PasswordResetRequest = {
  email: string
}

export type PasswordResetConfirm = {
  token: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Site verification (plan section 0.3a). Methods returned by the backend
// match the wire literals exactly.
// ---------------------------------------------------------------------------

export type SiteVerificationMethod = "DNS_TXT" | "META_TAG"

export type SiteVerificationRequest = {
  method: SiteVerificationMethod
}

export type SiteVerificationResponse = {
  method: SiteVerificationMethod
  token: string
  instructions: string
}

export type SiteVerificationConfirmation = {
  verified: boolean
  lastCheckedAt: string
}

// ---------------------------------------------------------------------------
// Anonymous crawls (plan section 2.0). Public teaser bucket that backs the
// marketing-hero free-audit funnel. The wire shapes mirror
// AnonymousCrawlController on the backend (commit 5bb1a2b). Everything is
// strings on the wire (ObjectIds are hex-encoded; Instants are ISO 8601).
// ---------------------------------------------------------------------------

/** Response for POST /api/anonymous-crawls. The crawl is queued; the FE
 *  navigates to the teaser route and polls until the run completes. */
export type AnonymousCrawlStartResponse = {
  token: string
  crawlRunId: string
  status: string
}

/** Response for GET /api/anonymous-crawls/{token}. issuesSummary.byCategory
 *  is capped at 3 entries on the wire so we never leak the full report
 *  before the user signs up + claims. */
export type AnonymousCrawlSummary = {
  token: string
  url: string
  status: string
  crawlRunId: string | null
  healthScore: number | null
  /** BE coerces these to 0 when null (Phase 1 fix). */
  pagesCrawled: number
  pagesDiscovered: number
  /** Wall-clock starts/ends for the crawl. startedAt is always populated
   *  once the run is queued; finishedAt is null while the crawl is still
   *  running. Used by the teaser to surface the "Scanned in N seconds"
   *  proof-of-work stat (Phase 1 fix). */
  startedAt: string
  finishedAt: string | null
  issuesSummary: IssuesSummary
  isClaimed: boolean
  claimedByTenantId: string | null
  expiresAt: string | null
}

/** Response for POST /api/anonymous-crawls/{token}/claim. */
export type AnonymousCrawlClaimResponse = {
  siteId: string
  crawlRunId: string
  claimedAt: string
}

/** Response for GET /api/anonymous-crawls/{token}/full. Owner-only;
 *  uncapped issuesSummary and the alerts list. */
export type AnonymousCrawlFull = {
  token: string
  url: string
  status: string
  crawlRunId: string | null
  siteId: string | null
  issuesSummary: IssuesSummary
  alerts: Alert[]
  isClaimed: boolean
  claimedByTenantId: string
  claimedAt: string | null
}

/** Stub response for the email-summary CTA. The BE method is not wired
 *  yet (see client.ts requestEmailedSummary); this shape pins what the
 *  eventual endpoint will return. */
export type EmailedSummaryResponse = {
  queued: boolean
}

export type CreateSiteInput = {
  url: string
  maxPages?: number | null
  maxConcurrentRequests?: number | null
  maxRequestsPerSecond?: number | null
  requestTimeoutSeconds?: number | null
  userAgent?: string | null
  jsRendering?: boolean | null
}

export type UpdateSiteInput = {
  maxPages?: number | null
  maxConcurrentRequests?: number | null
  maxRequestsPerSecond?: number | null
  requestTimeoutSeconds?: number | null
  userAgent?: string | null
  jsRendering?: boolean | null
}

// ---------------------------------------------------------------------------
// Billing (plan section 11; iter 5 BE 097adde). Mirrors BillingController's
// snapshot wire-shape and the checkout / portal session POST bodies.
// ---------------------------------------------------------------------------

export type Plan = "STARTER" | "PROFESSIONAL" | "AGENCY"

/** Mirrors com.bigbug.model.SubscriptionStatus. NONE means the tenant has
 *  never started a Stripe subscription. */
export type SubscriptionStatus =
  | "NONE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "INCOMPLETE"

/** Read-only snapshot returned by GET /api/tenants/{tenantId}/billing. */
export type BillingSnapshot = {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  trialStartedAt: string | null
  trialEndsAt: string | null
  hasPaymentMethod: boolean
}

export type CreateCheckoutSessionInput = {
  priceTier: Plan
  returnUrl: string
  trialDays?: number
}

export type CreateCheckoutSessionResponse = {
  url: string
  sessionId: string
}

export type CreatePortalSessionInput = {
  returnUrl: string
}

export type CreatePortalSessionResponse = {
  url: string
}

// ---------------------------------------------------------------------------
// Alert rules (plan section 8.1; iter 6 BE). Three canned rules per site.
// The BE auto-seeds them on first GET so the FE can render a stable list.
// ---------------------------------------------------------------------------

export type AlertRuleKind = "NEW_ERROR" | "SCORE_DROP" | "WEEKLY_DIGEST"

/** Mirrors com.bigbug.model.AlertRule. params is a free-form bag of per-kind
 *  config (e.g. {threshold: 10} for SCORE_DROP). */
export type AlertRule = {
  id: string
  siteId: string
  kind: AlertRuleKind | string
  enabled: boolean
  params: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type UpdateAlertRuleInput = {
  enabled?: boolean
  params?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Email channel (plan section 8.2; iter 6 BE). Per-tenant config for outbound
// alert emails. BE auto-seeds a MEMBERS-default row on first GET.
// ---------------------------------------------------------------------------

export type EmailChannelKind = "MEMBERS" | "CUSTOM" | "BOTH"

export type EmailChannel = {
  id: string
  tenantId: string
  kind: EmailChannelKind
  recipients: string[]
  createdAt: string
  updatedAt: string
}

export type UpdateEmailChannelInput = {
  kind: EmailChannelKind
  recipients: string[]
}

// ---------------------------------------------------------------------------
// Schedule (plan section 7; iter 4 BE-4 db0983c). The PUT body only carries
// cadence; the BE computes nextRunAt from SchedulerWorker.cadenceInterval.
// ---------------------------------------------------------------------------

export type SiteSchedule = {
  cadence: SiteCadence
  nextRunAt: string | null
  lastScheduledRunAt: string | null
}

export type UpdateSiteScheduleInput = {
  cadence: SiteCadence
}

// ---------------------------------------------------------------------------
// Telemetry (plan section 16; iter 6 BE). PUBLIC sink (no auth header).
// One row per event, capped at 100/batch by the BE.
// ---------------------------------------------------------------------------

export type TelemetryEvent = {
  /** Event name (e.g. "hero_paste_url", "signup_completed"). */
  event: string
  /** Free-form bag of typed properties. JSON-serialisable values only. */
  properties?: Record<string, unknown>
  /** Optional client timestamp; the BE falls back to receivedAt if absent. */
  timestamp?: string
  /** Per-browser session ID; persisted in localStorage. */
  sessionId?: string
  /** Tags an event with the source anonymous-crawl token (funnel
   *  attribution). */
  anonymousCrawlToken?: string
  userId?: string
  tenantId?: string
}

// ---------------------------------------------------------------------------
// Account (plan section 14.1). Password change endpoint is not yet wired on
// the BE; the typed client method throws a NotImplemented error.
// ---------------------------------------------------------------------------

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Stripe SetupIntent (plan section 1.2 step 3). Phase 1.5 deferral - the BE
// endpoint is not wired yet, so the typed client method returns null and
// console.warns. Type left in place so the FE can wire it up unchanged once
// the BE ships.
// ---------------------------------------------------------------------------

export type SetupIntent = {
  clientSecret: string
  customerId: string
}

// ---------------------------------------------------------------------------
// Notification delivery log (plan section 4A.5). The BE ships a per-tenant
// log of every alert notification dispatch (channel, recipient, status,
// retry counts, last error). Shipping in iter 2 round 2; the FE renders an
// empty state when the endpoint 404s so we degrade gracefully while it
// lands.
// ---------------------------------------------------------------------------

export type NotificationChannel = "EMAIL" | "SLACK" | "TEAMS" | "PAGERDUTY"

export type NotificationStatus = "QUEUED" | "SENT" | "FAILED"

export type NotificationLogEntry = {
  id: string
  tenantId: string
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
  alertType?: AlertType | string | null
  alertId?: string | null
  attemptCount: number
  lastErrorMessage?: string | null
  /** ISO 8601 timestamp the delivery row was queued (BE field name). */
  queuedAt: string
  sentAt?: string | null
  /** Originating site for the alert (when applicable). */
  siteId?: string | null
}

export type NotificationLogResult = {
  items: NotificationLogEntry[]
  total: number
  page: number
  size: number
}

export type ListNotificationLogParams = {
  page?: number
  size?: number
  /** Single channel filter. The BE accepts a single value per param; the FE
   *  surfaces a single-select dropdown to match. Multi-channel filtering is
   *  intentionally not supported - revisit when product needs it (would
   *  require parallel queries + client-side merge). */
  channel?: NotificationChannel | string
  status?: NotificationStatus | string
  /** ISO 8601 lower bound for `queuedAt`. */
  since?: string
}

export type ResendNotificationInput = {
  channel: NotificationChannel
}

export type ResendNotificationResponse = {
  /** Id of the freshly enqueued delivery row (BE field name). */
  newDeliveryId: string
}

// ---------------------------------------------------------------------------
// MS Teams + PagerDuty channels (plan section 8.2). Mirror the SlackChannel /
// EmailChannel shape. Endpoints land in the parallel BE iter 2 round 2; if
// the GET 404s the FE treats the channel as not connected.
// ---------------------------------------------------------------------------

export type TeamsChannel = {
  id: string
  tenantId: string
  /** True once a webhook URL has been stored. The BE never returns the
   *  webhook URL itself (it is a secret); use this flag to drive the
   *  "Configured (hidden)" placeholder in the form. */
  webhookUrlConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateTeamsChannelInput = {
  webhookUrl: string
}

export type SeverityFloor = "ERROR" | "WARNING" | "NOTICE"

export type PagerDutyChannel = {
  id: string
  tenantId: string
  /** True once an integration key has been stored. The BE never returns the
   *  integration key itself (it is a secret); use this flag to drive the
   *  "Configured (hidden)" placeholder in the form. */
  integrationKeyConfigured: boolean
  severityFloor: SeverityFloor
  createdAt: string
  updatedAt: string
}

export type UpdatePagerDutyChannelInput = {
  integrationKey: string
  severityFloor: SeverityFloor
}

// ---------------------------------------------------------------------------
// Public catalog (plan section 6 / sec 0.3e iter 2). PUBLIC, no auth header.
// Backed by GET /api/catalog (CatalogController). Mirrors the static
// CheckCatalogEntry shape in src/api/checkCatalog.ts so the FE can swap the
// hand-written list for the BE response.
// ---------------------------------------------------------------------------

export type PublicCatalogEntry = {
  type: AlertType | string
  category: string
  severityDefault: Severity
  title: string
  description: string
  howToFix: string
  marketingId: string
}

// ---------------------------------------------------------------------------
// Inbox bulk actions (plan section 3). BE iter 3 ships the matching endpoints;
// the FE falls back to per-row mutations if the bulk endpoints 404.
// ---------------------------------------------------------------------------

export type BulkAlertActionRequest = {
  alertIds: string[]
}

export type BulkSnoozeRequest = BulkAlertActionRequest & {
  /** ISO 8601 UTC timestamp; alerts un-snooze when now() > until. */
  until: string
}

export type BulkAssignRequest = BulkAlertActionRequest & {
  userId: string | null
}

export type BulkActionResponse = {
  updatedCount: number
}

export type SnoozeAlertInput = {
  until: string
}

export type AssignAlertInput = {
  userId: string | null
}

// ---------------------------------------------------------------------------
// Slack channel (plan section 8.2). BE iter 1 wired the controllers;
// FE OAuth install flow lands here. The redacted shape never includes the
// access token (BE strips it from every payload).
// ---------------------------------------------------------------------------

export type SlackChannel = {
  id: string
  tenantId: string
  slackTeamId: string | null
  slackTeamName: string | null
  defaultChannelId: string | null
  defaultChannelName: string | null
  kind?: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type StartSlackInstallInput = {
  /** Where the BE should 302 the user once OAuth completes. Usually the
   *  current Settings tab URL so the page can re-render with the connected
   *  card. */
  returnUrl: string
}

export type StartSlackInstallResponse = {
  url: string
}

// ---------------------------------------------------------------------------
// Status page (plan section 16). PUBLIC. Backed by GET /api/status (BE iter 3).
// Each component reports operational / degraded / down + the relevant metric.
// ---------------------------------------------------------------------------

export type StatusLevel = "operational" | "degraded" | "down"

export type StatusComponent = {
  /** Stable id used as a React key + for telemetry. */
  id: string
  /** Display name (e.g. "API", "Crawler"). */
  name: string
  status: StatusLevel
  /** Free-form metric line ("99.97% uptime", "45ms latency"). */
  metric?: string | null
  /** Optional last-updated ISO timestamp. */
  updatedAt?: string | null
}

export type StatusIncident = {
  id: string
  componentId?: string | null
  status?: StatusLevel | string | null
  title?: string | null
  body?: string | null
  startedAt?: string | null
  resolvedAt?: string | null
}

export type StatusSloTargets = {
  /** API uptime ratio (0..1). */
  api?: number
  /** Crawler uptime ratio (0..1). */
  crawler?: number
  /** Scheduler tick latency p95 in ms. */
  scheduler_p95Ms?: number
  [key: string]: number | undefined
}

export type StatusResponse = {
  /** Overall rollup; usually max(component.status) by severity. */
  status: StatusLevel
  /** As-of timestamp for the snapshot. */
  updatedAt: string
  components: StatusComponent[]
  /** Active or recently resolved incidents; usually empty. */
  incidents?: StatusIncident[]
  /** Per-service SLO targets surfaced for the trust strip. */
  sloTargets?: StatusSloTargets
}
