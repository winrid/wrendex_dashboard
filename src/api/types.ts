// Typed API contract bound to the Javalin backend at
// /home/winrid/dev/wrendex/backend (com.bigbug.api.* + com.bigbug.model.*
// + com.bigbug.report.*).
//
// The MODEL types (Site, CrawlRun, Page, Alert, etc.) are GENERATED from
// the Java source under com.bigbug.model.* by
// cz.habarta.typescript-generator (Maven plugin in backend/pom.xml). The
// generated file lives at ./generated/wrendex-models.ts and is checked in;
// run `pnpm codegen` from the dashboard repo to regenerate it after a BE
// model change. The drift check `pnpm codegen:check` re-runs the generator
// and diffs against the checked-in file so a stale wire-shape can't sneak
// past CI. This module re-exports the model types and adds the WRAPPER
// request / response shapes that wrap them (e.g. AlertQueryResult,
// BillingSnapshot, AuthLoginResponse). Wrappers are hand-written because
// most controllers still serialise via `Map<String, Object>` rather than
// concrete DTO classes; once those are refactored we can generate the
// wrappers too. Until then, wrapper definitions COMPOSE the generated
// model types instead of duplicating them.

import type {
  Alert as GenAlert,
  AlertRule as GenAlertRule,
  CrawlRun as GenCrawlRun,
  EmailChannel as GenEmailChannel,
  Page as GenPage,
  RedirectHop as GenRedirectHop,
  SavedView as GenSavedView,
  Site as GenSite,
} from "./generated/wrendex-models"

// ---------------------------------------------------------------------------
// Re-exported generated model + enum types. These are the BE wire-shape
// source of truth; do not redeclare them in this file. If the field set
// looks wrong, fix the Java model and regenerate.
// ---------------------------------------------------------------------------

export type {
  // Models that are returned RAW from the BE (ctx.json(model) or a list of
  // them). These re-exports are the wire shape; consumers should rely on
  // them and not duplicate.
  Alert,
  AlertRule,
  CrawlRun,
  EmailChannel,
  HreflangEntry,
  Link,
  Page,
  RedirectHop,
  SavedView,
  Site,
  // Enums (string-literal unions). The plugin emits these as `type X =
  // "A" | "B"` so they round-trip through JSON without a runtime mapping
  // layer (matches the previous hand-written shape exactly).
  AlertStatus,
  AlertType,
  ChangelogTag,
  Role,
  Severity,
  SiteCadence,
  SubscriptionStatus,
  TlsCertStatus,
} from "./generated/wrendex-models"

// ---------------------------------------------------------------------------
// Aliased re-exports. The Java side names the type one way, the dashboard
// already uses another; we publish both so existing call-sites keep
// compiling.
// ---------------------------------------------------------------------------

import type {
  ShareLinkScope as GenShareLinkScope,
  Severity as GenSeverity,
} from "./generated/wrendex-models"

/** Public alias of the generated ShareLinkScope. Existing code uses
 *  `ShareScope`; the BE enum is `ShareLinkScope`. */
export type ShareScope = GenShareLinkScope

/** Severity floor selector for the PagerDuty channel; same set of values
 *  as the alert Severity enum. */
export type SeverityFloor = GenSeverity

// ---------------------------------------------------------------------------
// Hand-written supplements: wire-shape narrowings the FE relies on but the
// Java model declares as a plain `String`. The BE accepts any string on
// the wire, but only the FE-emitted values round-trip cleanly; keeping
// these as named unions stops typos at compile time.
// ---------------------------------------------------------------------------

/** Mirrors the four EmailChannelKind values the FE emits; the BE field is
 *  a free-form String at the model level. */
export type EmailChannelKind = "MEMBERS" | "CUSTOM" | "BOTH"

/** Plan marker on Tenant + BillingSnapshotResponse. The credit-based billing
 *  model only uses "BASE" today; the legacy values are retained so legacy
 *  rows (pre-migration) deserialize cleanly. */
export type Plan = "BASE" | "STARTER" | "PROFESSIONAL" | "AGENCY"

/** Site verification method. BE field is a free-form String. */
export type SiteVerificationMethod = "DNS_TXT" | "META_TAG"

/** AlertRule.kind narrowed to the four shipped kinds; BE field is String. */
export type AlertRuleKind = "NEW_ERROR" | "SCORE_DROP" | "WEEKLY_DIGEST" | "CUSTOM"

// ---------------------------------------------------------------------------
// Wrapper / response DTOs. The BE controllers build these via
// `Map<String, Object>` rather than a concrete Java class, so the generator
// cannot see them. Each wrapper REFERENCES the generated model type
// (Pick<>, &, or composition) instead of duplicating fields. Follow-up: lift
// the controllers to typed DTOs in com.bigbug.api so these can be generated.
// ---------------------------------------------------------------------------

/** Wrapped pagination shape. The /api/{...}/alerts endpoints return this when
 *  ANY pagination/filter param is supplied; otherwise they return a bare
 *  Alert[]. The client always opts-in to this shape by passing page=0, so
 *  feature code never has to branch on the response type. */
export type AlertQueryResult = {
  items: GenAlert[]
  total: number
  page: number
  size: number
}

/** Type alias kept for consumers that prefer the plan-canonical name. */
export type AlertList = AlertQueryResult

/** Response of GET /api/crawls/{crawlId}/diff?against={prevCrawlId}.
 *
 * The arrays are capped at DIFF_MAX (200) on the BE; the *Count fields are
 * the true totals before capping so the FE can render accurate numbers.
 * `skipped` partitions out alerts whose pageUrl wasn't visited by the current
 * crawl (e.g. when a polite re-crawl only re-tested 30 of 982 pages) so they
 * aren't falsely classified as "resolved".
 */
export type CrawlDiff = {
  new: GenAlert[]
  resolved: GenAlert[]
  persisted: GenAlert[]
  skipped: GenAlert[]
  newCount: number
  resolvedCount: number
  persistedCount: number
  skippedCount: number
  newTruncated: boolean
  resolvedTruncated: boolean
  persistedTruncated: boolean
  skippedTruncated: boolean
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

export type CrawlLogEntry = Pick<
  GenCrawlRun,
  | "id"
  | "startedAt"
  | "finishedAt"
  | "status"
  | "pagesDiscovered"
  | "pagesCrawled"
  | "healthScore"
  | "errorCount"
  | "warningCount"
  | "noticeCount"
> & {
  durationMs?: number | null
}

/** Wire row for the Page Explorer table. PageRow extends Page with four
 *  derived fields the FE table now reads: errorCount / warningCount /
 *  noticeCount (per-page alert counts) and indexable (BE-side robotsMeta
 *  derivation). */
export type PageRow = GenPage & {
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
  hops: GenRedirectHop[]
  loop: boolean
  hasMetaRefresh: boolean
  /** Pages that link to the redirecting URL. */
  originatingPages?: string[] | null
}

export type RedirectsResult = {
  entries: RedirectEntry[]
  totalChains: number
  totalLoops: number
}

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
  originatingPages?: string[] | null
  renderBlocking?: boolean | null
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

/** Shape of /api/sites/{siteId}/health-score. */
export type HealthScorePoint = {
  crawlRunId: string
  startedAt: string
  finishedAt?: string | null
  healthScore: number
  errorCount: number
  warningCount: number
  noticeCount: number
}

// ---------------------------------------------------------------------------
// Request param shapes (FE -> BE). These are not models; they describe the
// parameters the typed client builds into the URL.
// ---------------------------------------------------------------------------

export type AlertListParams = {
  page?: number
  size?: number
  severity?: import("./generated/wrendex-models").Severity
  type?: import("./generated/wrendex-models").AlertType
  pageUrlContains?: string
  pageId?: string
  status?: import("./generated/wrendex-models").AlertStatus
  /** Restrict alerts to a single crawl run. */
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
// Auth wrappers (com.bigbug.api.AuthController). User and Tenant on the
// wire are NOT the same as the persisted models - the controller emits a
// trimmed `{id, email, createdAt}` for User (no passwordHash, no totp*) and
// a trimmed `{id, name, createdAt}` for Tenant (no plan / Stripe ids /
// subscription state). Until the BE adds typed DTO classes for these
// responses, we keep the wire-trim hand-written here.
// ---------------------------------------------------------------------------

/** Trimmed User wire shape returned by AuthController. */
export type User = {
  id: string
  email: string
  createdAt: string
}

/** Trimmed Tenant wire shape returned by AuthController / TenantController.
 *  Plan / Stripe state lives on BillingSnapshot. */
export type Tenant = {
  id: string
  name: string
  createdAt: string
}

export type Membership = {
  tenantId: string
  tenantName: string
  role: import("./generated/wrendex-models").Role
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
  role: import("./generated/wrendex-models").Role
}

export type AuthLoginRequest = {
  email: string
  password: string
}

/** Successful, fully-authenticated login response (no 2FA required, or 2FA
 *  step already completed via login2fa). */
export type AuthLoginResponseFull = {
  sessionToken: string
  user: User
  twoFactorRequired?: false
}

/** Pending-2FA login response. The BE returns a short-lived `pendingToken`
 *  that the FE must echo back with the user's TOTP / backup code via
 *  /api/auth/login/2fa to complete the session. */
export type AuthLoginResponse2fa = {
  sessionToken: string
  twoFactorRequired: true
}

/** Discriminated union over the two possible login responses. */
export type AuthLoginResponse = AuthLoginResponseFull | AuthLoginResponse2fa

export type Login2faRequest = {
  pendingToken: string
  code: string
}

// ---------------------------------------------------------------------------
// Two-factor authentication (P4 iter 2).
// ---------------------------------------------------------------------------

export type TwoFactorStatus = {
  enabled: boolean
  enabledAt?: string | null
  backupCodesRemaining: number
}

export type Setup2faResponse = {
  secret: string
  otpauthUrl: string
}

export type Verify2faResponse = {
  backupCodes: string[]
}

// ---------------------------------------------------------------------------
// Personal API tokens. The persisted model has a tokenHash field; the BE
// strips it from every wire payload, so the client-facing shape stays
// hand-written until that controller is lifted to a typed DTO.
// ---------------------------------------------------------------------------

export type PersonalApiToken = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt?: string | null
  revokedAt?: string | null
  expiresAt?: string | null
}

export type CreateApiTokenInput = {
  name: string
  expiresAt?: string | null
}

/** Response of POST /api/me/api-tokens. The plaintext `token` is returned
 *  ONCE. */
export type CreateApiTokenResponse = PersonalApiToken & {
  token: string
}

export type PasswordResetRequest = {
  email: string
}

export type PasswordResetConfirm = {
  token: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Site verification.
// ---------------------------------------------------------------------------

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
// Anonymous crawls (plan section 2.0). The wire shape is a controller-built
// Map; AnonymousCrawlSummary etc. remain hand-written until a DTO lands.
// ---------------------------------------------------------------------------

export type AnonymousCrawlStartResponse = {
  token: string
  crawlRunId: string
  status: string
}

export type AnonymousCrawlSummary = {
  token: string
  url: string
  status: string
  crawlRunId: string | null
  healthScore: number | null
  pagesCrawled: number
  pagesDiscovered: number
  startedAt: string
  finishedAt: string | null
  issuesSummary: IssuesSummary
  isClaimed: boolean
  claimedByTenantId: string | null
  expiresAt: string | null
  lastScrapedPage: AnonymousCrawlLastScrapedPage | null
}

export type AnonymousCrawlLastScrapedPage = {
  url: string
  title: string | null
  crawledAt: string | null
}

export type AnonymousCrawlClaimResponse = {
  siteId: string
  crawlRunId: string
  claimedAt: string
}

export type AnonymousCrawlFull = {
  token: string
  url: string
  status: string
  crawlRunId: string | null
  siteId: string | null
  issuesSummary: IssuesSummary
  alerts: GenAlert[]
  isClaimed: boolean
  claimedByTenantId: string
  claimedAt: string | null
}

export type EmailedSummaryResponse = {
  queued: boolean
}

/** Body for POST /api/sites. The BE allows every config knob to default; only
 *  url is required from the client. Optional fields, when provided, override
 *  the BE defaults. */
export type CreateSiteInput = Pick<GenSite, "url"> &
  Partial<
    Pick<
      GenSite,
      | "maxPages"
      | "maxConcurrentRequests"
      | "maxRequestsPerSecond"
      | "requestTimeoutSeconds"
      | "userAgent"
      | "jsRendering"
    >
  >

/** Body for PATCH /api/sites/{id}. Every field is optional; the BE preserves
 *  the existing value when a field is omitted. */
export type UpdateSiteInput = Partial<
  Pick<
    GenSite,
    | "maxPages"
    | "maxConcurrentRequests"
    | "maxRequestsPerSecond"
    | "requestTimeoutSeconds"
    | "userAgent"
    | "jsRendering"
  >
>

// ---------------------------------------------------------------------------
// Billing (com.bigbug.api.BillingController). Hand-written because the
// snapshot is composed at request time from Tenant + Stripe state.
// ---------------------------------------------------------------------------

/** Pack SKUs for credit top-ups. Mirrors BillingConfig.PACK_SKU_* on the BE.
 *  These are string-literal aliases of {@code AutoTopUpSettings.packSku} (a
 *  free-form string in the generated wire shape). */
export type CreditPackSku = "PACK_5K" | "PACK_25K" | "PACK_100K"

/** Auto top-up settings re-exported from codegen so callers can keep the
 *  short name. The wire shape lives in wrendex-models.ts. */
export type AutoTopUpSettings = import("./generated/wrendex-models").AutoTopUpSettings

/**
 * Read-only snapshot returned by GET /api/tenants/{tenantId}/billing.
 * Sourced from the codegen'd {@code BillingSnapshotResponse} POJO on the BE
 * so adding fields stays a single-file backend change.
 */
export type BillingSnapshot = import("./generated/wrendex-models").BillingSnapshotResponse

/** Per-crawl credit cost rollup returned by GET /api/crawls/{crawlId}/cost. */
export type CrawlCostResponse = import("./generated/wrendex-models").CrawlCostResponse

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

export type PatchAutoTopUpInput = {
  enabled: boolean
  packSku: CreditPackSku
  thresholdCredits: number
}

export type ManualTopUpInput = {
  packSku: CreditPackSku
}

export type ManualTopUpResponse = {
  paymentIntentId: string
  status: string
}

export type CreditLedgerKind =
  | "DEBIT_HTTP"
  | "DEBIT_BROWSER"
  | "DEBIT_CHANGE_DETECT"
  | "GRANT_CYCLE"
  | "GRANT_TOPUP"
  | "GRANT_MIGRATION"
  | "GRANT_REFUND"

export type CreditLedgerRow = {
  id: string | null
  kind: CreditLedgerKind
  amount: number
  balanceAfter: number
  crawlRunId: string | null
  pageId: string | null
  url: string | null
  source: string | null
  occurredAt: string | null
}

export type CreditLedgerResponse = {
  items: CreditLedgerRow[]
}

// ---------------------------------------------------------------------------
// Alert rules. The persisted AlertRule model is generated; a couple of
// CUSTOM-rule-only request shapes stay hand-written.
// ---------------------------------------------------------------------------

export type UpdateAlertRuleInput = Partial<Pick<GenAlertRule, "enabled" | "params">>

/** Body for POST /api/sites/{siteId}/alert-rules. CUSTOM is the only kind
 *  the create endpoint currently accepts. */
export type CreateAlertRuleInput = {
  kind: AlertRuleKind
  enabled: boolean
  params: CustomAlertRuleParams | Record<string, unknown>
}

/** Operator literal for the threshold-based custom-rule triggers. */
export type AlertRuleTriggerOp = "<" | ">" | "<=" | ">="

/** Cron preset for DIGEST_PERIOD triggers. */
export type AlertRuleDigestCron = "DAILY" | "WEEKLY" | "MONTHLY"

export type AlertRuleTrigger =
  | {
      kind: "ALERT_FIRED"
      firstSeen?: boolean
    }
  | {
      kind: "SCORE_THRESHOLD"
      op: AlertRuleTriggerOp
      value: number
    }
  | {
      kind: "ALERT_COUNT_THRESHOLD"
      severity?: import("./generated/wrendex-models").Severity
      op: AlertRuleTriggerOp
      value: number
    }
  | {
      kind: "DIGEST_PERIOD"
      cron: AlertRuleDigestCron
    }

export type AlertRuleFilters = {
  categories?: string[]
  types?: (import("./generated/wrendex-models").AlertType | string)[]
  severities?: import("./generated/wrendex-models").Severity[]
  pageUrlContains?: string
  minPagesAffected?: number
}

export type CustomAlertRuleParams = {
  trigger: AlertRuleTrigger
  filters?: AlertRuleFilters
  name?: string
  channels?: NotificationChannel[]
}

// ---------------------------------------------------------------------------
// Email channel input.
// ---------------------------------------------------------------------------

export type UpdateEmailChannelInput = Pick<GenEmailChannel, "recipients"> & {
  kind: EmailChannelKind
}

// ---------------------------------------------------------------------------
// Schedule input.
// ---------------------------------------------------------------------------

export type SiteSchedule = Pick<GenSite, "cadence" | "nextRunAt" | "lastScheduledRunAt">

export type UpdateSiteScheduleInput = {
  cadence: import("./generated/wrendex-models").SiteCadence
}

// ---------------------------------------------------------------------------
// Telemetry (request body; not a model).
// ---------------------------------------------------------------------------

export type TelemetryEvent = {
  event: string
  properties?: Record<string, unknown>
  timestamp?: string
  sessionId?: string
  anonymousCrawlToken?: string
  userId?: string
  tenantId?: string
}

// ---------------------------------------------------------------------------
// Account.
// ---------------------------------------------------------------------------

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Stripe SetupIntent.
// ---------------------------------------------------------------------------

export type SetupIntent = {
  clientSecret: string
  customerId: string
}

// ---------------------------------------------------------------------------
// Notification delivery log. Wire shape is built by NotificationLogController
// from EmailDelivery / SlackDelivery / TeamsDelivery / PagerDutyDelivery
// rows, so the wrapper stays hand-written.
// ---------------------------------------------------------------------------

export type NotificationChannel = "EMAIL" | "SLACK" | "TEAMS" | "PAGERDUTY"

export type NotificationStatus = "QUEUED" | "SENT" | "FAILED"

export type NotificationLogEntry = {
  id: string
  tenantId: string
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
  alertType?: import("./generated/wrendex-models").AlertType | string | null
  alertId?: string | null
  attemptCount: number
  lastErrorMessage?: string | null
  queuedAt: string
  sentAt?: string | null
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
  channel?: NotificationChannel | string
  status?: NotificationStatus | string
  since?: string
}

export type ResendNotificationInput = {
  channel: NotificationChannel
}

export type ResendNotificationResponse = {
  newDeliveryId: string
}

// ---------------------------------------------------------------------------
// Teams + PagerDuty channels - secrets redacted on the wire, so the
// client-facing shape is the wrapper, not the persisted model.
// ---------------------------------------------------------------------------

export type TeamsChannel = {
  id: string
  tenantId: string
  webhookUrlConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateTeamsChannelInput = {
  webhookUrl: string
}

export type PagerDutyChannel = {
  id: string
  tenantId: string
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
// Public catalog.
// ---------------------------------------------------------------------------

export type PublicCatalogEntry = {
  type: import("./generated/wrendex-models").AlertType | string
  category: string
  severityDefault: import("./generated/wrendex-models").Severity
  title: string
  description: string
  howToFix: string
  marketingId: string
}

// ---------------------------------------------------------------------------
// Inbox bulk actions.
// ---------------------------------------------------------------------------

export type BulkAlertActionRequest = {
  alertIds: string[]
}

export type BulkSnoozeRequest = BulkAlertActionRequest & {
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
// Slack channel - access token stripped on the wire.
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
  returnUrl: string
}

export type StartSlackInstallResponse = {
  url: string
}

// ---------------------------------------------------------------------------
// Status page.
// ---------------------------------------------------------------------------

export type StatusLevel = "operational" | "degraded" | "down"

export type StatusComponent = {
  id: string
  name: string
  status: StatusLevel
  metric?: string | null
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
  api?: number
  crawler?: number
  scheduler_p95Ms?: number
  [key: string]: number | undefined
}

export type StatusResponse = {
  status: StatusLevel
  updatedAt: string
  components: StatusComponent[]
  incidents?: StatusIncident[]
  sloTargets?: StatusSloTargets
}

// ---------------------------------------------------------------------------
// Tenant branding - wire shape is a Map<String, Object> wrapper.
// ---------------------------------------------------------------------------

export type TenantBranding = {
  tenantId: string
  logoDataUrl?: string | null
  accentColor?: string | null
  fromName?: string | null
  hidePoweredBy?: boolean | null
  customSubdomain?: string | null
  customSubdomainVerifiedAt?: string | null
  lastDnsCheckAt?: string | null
  lastDnsCheckResult?: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateTenantBrandingInput = {
  logoDataUrl?: string | null
  accentColor?: string | null
  fromName?: string | null
  hidePoweredBy?: boolean | null
  customSubdomain?: string | null
}

export type VerifySubdomainResponse = {
  verified: boolean
  customSubdomain?: string | null
  lastDnsCheckResult?: string | null
  lastDnsCheckAt?: string | null
}

// ---------------------------------------------------------------------------
// TLS certificate provisioning - wire shape redacts the persisted PEM /
// encrypted private key, so this is hand-written and references the
// generated TlsCertStatus enum.
// ---------------------------------------------------------------------------

export type TenantTlsCert = {
  subdomain: string
  status: import("./generated/wrendex-models").TlsCertStatus
  issuedAt?: string | null
  expiresAt?: string | null
  renewAfter?: string | null
  lastError?: string | null
}

// ---------------------------------------------------------------------------
// SAML SSO config.
// ---------------------------------------------------------------------------

export type TenantSamlConfig = {
  id: string
  tenantId: string
  idpEntityId: string
  idpSsoUrl: string
  idpCertX509: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  configuredByUserId: string
}

export type UpdateSamlConfigInput = {
  idpEntityId: string
  idpSsoUrl: string
  idpCertX509: string
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Stripe invoice listing.
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void"
  | string

export type Invoice = {
  id: string
  number?: string | null
  amount: number
  currency: string
  status: InvoiceStatus
  hostedInvoiceUrl?: string | null
  invoicePdfUrl?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  paidAt?: string | null
  createdAt: string
}

export type ListInvoicesParams = {
  limit?: number
}

export type ListInvoicesResult = {
  items: Invoice[]
}

// ---------------------------------------------------------------------------
// Team management - all wire shapes are wrappers; persisted models leak
// invite tokens / passwordHash so we keep these hand-written.
// ---------------------------------------------------------------------------

export type TenantInvite = {
  id: string
  tenantId: string
  email: string
  role: import("./generated/wrendex-models").Role
  invitedByUserId: string
  invitedByEmail: string
  createdAt: string
  expiresAt: string
  acceptedAt?: string | null
}

export type TenantMember = {
  userId: string
  email: string
  role: import("./generated/wrendex-models").Role
  joinedAt: string
  lastSeenAt?: string | null
}

export type CreateInviteInput = {
  email: string
  role: import("./generated/wrendex-models").Role
}

export type UpdateMemberRoleInput = {
  role: import("./generated/wrendex-models").Role
}

export type TransferOwnershipInput = {
  newOwnerUserId: string
}

export type InvitePublicView = {
  tenantId: string
  tenantName: string
  email: string
  role: import("./generated/wrendex-models").Role
  invitedByEmail: string
  expiresAt?: string | null
}

export type AcceptInviteResponse = {
  tenantId: string
  role: import("./generated/wrendex-models").Role
}

/** Audit log action codes. Free-form on the wire so new BE-side actions
 *  don't break the FE; the canonical set is enumerated here. */
export type AuditAction =
  | "INVITE_CREATED"
  | "INVITE_REVOKED"
  | "INVITE_ACCEPTED"
  | "INVITE_RESENT"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "OWNERSHIP_TRANSFERRED"
  | "SITE_CREATED"
  | "SITE_DELETED"
  | string

export type AuditLogEntry = {
  id: string
  tenantId: string
  actorUserId?: string | null
  actorEmail?: string | null
  action: AuditAction
  targetType?: string | null
  targetId?: string | null
  details?: Record<string, unknown> | null
  createdAt: string
}

export type AuditLogResult = {
  items: AuditLogEntry[]
  total: number
  page: number
  size: number
}

export type ListAuditLogParams = {
  page?: number
  size?: number
  since?: string
  action?: AuditAction
}

// ---------------------------------------------------------------------------
// Share links - wire shape adds derived fields (`url`, `passwordProtected`)
// that the persisted ShareLink model does not have.
// ---------------------------------------------------------------------------

export type ShareSubResource =
  | "redirects"
  | "duplicates"
  | "structured-data"
  | "links"
  | "pages"
  | "resources"
  | "issues"
  | null

export type ShareLink = {
  id: string
  tenantId: string
  scope: ShareScope
  targetId: string
  subResource?: ShareSubResource
  token: string
  url: string
  label?: string | null
  passwordProtected: boolean
  expiresAt?: string | null
  createdAt: string
  revokedAt?: string | null
  viewCount?: number
  createdByUserId?: string | null
  createdByEmail?: string | null
  planLimit?: number | null
  planUsed?: number | null
}

export type CreateShareLinkInput = {
  scope: ShareScope
  targetId: string
  subResource?: ShareSubResource
  password?: string
  expiresAt?: string | null
  label?: string
}

export type ListShareLinksParams = {
  includeRevoked?: boolean
}

export type ResolveShareInput = {
  password?: string
}

export type SharedLinkResult = {
  share: SharedLinkInfo
  payload: SharedLinkPayload
}

export type SharedLinkInfo = {
  scope: ShareScope
  subResource?: ShareSubResource
  label?: string | null
  expiresAt?: string | null
  tenantName: string
  siteDisplayName?: string | null
  logoDataUrl?: string | null
  accentColor?: string | null
  hidePoweredBy: boolean
}

// ---------------------------------------------------------------------------
// Changelog.
// ---------------------------------------------------------------------------

export type ChangelogEntry = {
  id: string
  slug: string
  title: string
  body: string
  tag: import("./generated/wrendex-models").ChangelogTag
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
  createdByUserId: string
}

export type ChangelogResult = {
  items: ChangelogEntry[]
  total: number
}

export type ListPublishedChangelogParams = {
  limit?: number
  since?: string
}

export type ListAdminChangelogParams = {
  includeDrafts?: boolean
}

export type UnreadChangelog = {
  unreadCount: number
  latestPublishedAt: string | null
}

export type CreateChangelogEntryInput = {
  slug: string
  title: string
  body: string
  tag: import("./generated/wrendex-models").ChangelogTag
  publishedAt?: string | null
}

export type UpdateChangelogEntryInput = {
  slug?: string
  title?: string
  body?: string
  tag?: import("./generated/wrendex-models").ChangelogTag
  publishedAt?: string | null
}

// ---------------------------------------------------------------------------
// Saved views (request inputs; the SavedView model itself is generated).
// ---------------------------------------------------------------------------

export type CreateSavedViewInput = Pick<GenSavedView, "name" | "route" | "filterJson"> & {
  siteId?: string | null
  shared?: boolean
}

export type UpdateSavedViewInput = Partial<Pick<GenSavedView, "name" | "filterJson" | "shared">>

export type ListSavedViewsParams = {
  siteId?: string
  route?: string
}

// ---------------------------------------------------------------------------
// Spot audits.
// ---------------------------------------------------------------------------

export type StartSpotAuditInput = {
  urls: string[]
}

export type StartSpotAuditResponse = GenCrawlRun & {
  origin?: string
  seedUrls?: string[]
}

// ---------------------------------------------------------------------------
// Shared link payload (per-scope). References generated model types.
// ---------------------------------------------------------------------------

export type SharedLinkPayload = {
  site?: GenSite | null
  crawlRun?: GenCrawlRun | null
  healthScore?: HealthScorePoint[] | null
  issuesSummary?: IssuesSummary | null
  page?: GenPage | null
  pageAlerts?: GenAlert[] | null
  pages?: PageResult | null
  links?: LinkResult | null
  redirects?: RedirectsResult | null
  duplicates?: DuplicatesResult | null
  resources?: ResourcesResult | null
  structuredData?: StructuredDataResult | null
  crawlAlerts?: GenAlert[] | null
  passwordRequired?: boolean
}

// ---------------------------------------------------------------------------
// Global search.
// ---------------------------------------------------------------------------

export type SearchResultKind = "site" | "page" | "alert" | "check"

export type SearchResult = {
  kind: SearchResultKind
  id: string
  title: string
  snippet: string
  route: string
}

export type SearchParams = {
  q: string
  tenantId: string
  limit?: number
  activeSiteId?: string
}

export type SearchResponse = {
  items: SearchResult[]
  truncated?: boolean
}

