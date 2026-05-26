// Typed API contract bound to the Javalin backend at
// /home/winrid/dev/wrendex/backend (com.bigbug.api.* + com.bigbug.model.*
// + com.bigbug.api.dto.*).
//
// The wire-shape types - both persisted models AND controller response
// DTOs - are GENERATED from the Java source under
// com.bigbug.model.** + com.bigbug.api.dto.** by
// cz.habarta.typescript-generator (Maven plugin in backend/pom.xml). The
// generated file lives at ./generated/wrendex-models.ts and is checked in;
// run `pnpm codegen` from the dashboard repo to regenerate it after a BE
// model or DTO change. The drift check `pnpm codegen:check` re-runs the
// generator and diffs against the checked-in file so a stale wire-shape
// can't sneak past CI.
//
// This module re-exports the generated types under the dashboard's
// historical names (e.g. `UserDto` -> `User`, `TenantDto` -> `Tenant`),
// adds request / param / input shapes the FE constructs, and defines a
// few FE-side narrowing unions over free-form-string BE fields. The
// discipline rule for adding a new endpoint is documented in
// `backend/src/main/java/com/bigbug/api/CLAUDE.md`.

import type {
  AlertRule as GenAlertRule,
  CrawlRun as GenCrawlRun,
  EmailChannel as GenEmailChannel,
  SavedView as GenSavedView,
  Site as GenSite,
} from "./generated/wrendex-models"

// ---------------------------------------------------------------------------
// Generated model + enum re-exports. The plugin emits enums as `type X =
// "A" | "B"` so they round-trip through JSON without a runtime mapping
// layer.
// ---------------------------------------------------------------------------

export type {
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

/** Pinned share subresource keys. The BE accepts any subresource string but
 *  the FE only renders these. */
export type ShareSubResource =
  | "redirects"
  | "duplicates"
  | "structured-data"
  | "links"
  | "pages"
  | "resources"
  | "issues"
  | null

/** Status page level narrowed. */
export type StatusLevel = "operational" | "degraded" | "down"

/** Stripe invoice status narrowed. */
export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void"
  | string

/** Pack SKUs for credit top-ups. Mirrors BillingConfig.PACK_SKU_* on the BE. */
export type CreditPackSku = "PACK_5K" | "PACK_25K" | "PACK_100K"

// ---------------------------------------------------------------------------
// Notification channel + status. Hand-written unions because the BE stores
// the channel as a String column for forward-compat with new channels.
// ---------------------------------------------------------------------------

export type NotificationChannel = "EMAIL" | "SLACK" | "TEAMS" | "PAGERDUTY"

export type NotificationStatus = "QUEUED" | "SENT" | "FAILED"

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

/** Global search result kind. */
export type SearchResultKind = "site" | "page" | "alert" | "check"

// ---------------------------------------------------------------------------
// Wire-shape DTOs sourced from codegen. These all live under
// `com.bigbug.api.dto.**` on the BE; the FE re-exports with dashboard-
// historical names where they differ from the Java class.
// ---------------------------------------------------------------------------

// Reports + crawl
export type {
  AlertQueryResult,
  AlertQueryResult as AlertList,
  CategorySummary,
  IssuesSummary,
  CrawlLogEntry,
  PageRow,
  PageResult,
  LinkEntry,
  LinkResult,
  DirectoryNode,
  RedirectEntry,
  RedirectsResult,
  DuplicateGroup,
  DuplicatesResult,
  ResourceEntry,
  ResourcesResult,
  SocialEntry,
  SocialResult,
  StructuredDataEntry,
  StructuredDataResult,
  HealthScorePoint,
  CrawlDiffResponse as CrawlDiff,
  SiteScheduleResponse as SiteSchedule,
} from "./generated/wrendex-models"

// Auth + account
export type {
  UserDto as User,
  MembershipDto as Membership,
  MeResponse as Me,
  AuthSignupResponse,
  AuthLoginResponse,
  HealthResponse,
  TwoFactorStatusResponse as TwoFactorStatus,
  Setup2faResponse,
  Verify2faResponse,
  PersonalApiTokenDto as PersonalApiToken,
  CreateApiTokenResponse,
} from "./generated/wrendex-models"

// Tenant
export type {
  TenantDto as Tenant,
  TenantInviteDto as TenantInvite,
  TenantInvitePeekResponse as InvitePublicView,
  TenantInviteAcceptResponse as AcceptInviteResponse,
  TenantMemberDto as TenantMember,
  TransferOwnershipResponse,
  TenantBrandingDto as TenantBranding,
  VerifySubdomainResponse,
  TenantTlsCertDto as TenantTlsCert,
  ProvisionTlsResponse,
  TenantSamlConfigDto as TenantSamlConfig,
} from "./generated/wrendex-models"

// Anonymous crawls
export type {
  AnonymousCrawlStartResponse,
  AnonymousCrawlSummary,
  AnonymousCrawlLastScrapedPage,
  AnonymousCrawlClaimResponse,
  AnonymousCrawlFull,
} from "./generated/wrendex-models"

// Billing
export type {
  CheckoutSessionResponse as CreateCheckoutSessionResponse,
  PortalSessionResponse as CreatePortalSessionResponse,
  ManualTopUpResponse,
  CreditLedgerEntryDto as CreditLedgerRow,
  CreditLedgerResponse,
  SetupIntentResponse as SetupIntent,
  InvoiceDto as Invoice,
  ListInvoicesResponse as ListInvoicesResult,
} from "./generated/wrendex-models"

/** Auto top-up settings re-exported from codegen so callers can keep the
 *  short name. The wire shape lives in wrendex-models.ts. */
export type AutoTopUpSettings = import("./generated/wrendex-models").AutoTopUpSettings

/** Read-only snapshot returned by GET /api/tenants/{tenantId}/billing.
 *  Sourced from the codegen'd BillingSnapshotResponse POJO. */
export type BillingSnapshot = import("./generated/wrendex-models").BillingSnapshotResponse

/** Per-crawl credit cost rollup returned by GET /api/crawls/{crawlId}/cost. */
export type CrawlCostResponse = import("./generated/wrendex-models").CrawlCostResponse

/** Re-export the codegen Kind enum under the dashboard's historical name. */
export type CreditLedgerKind = import("./generated/wrendex-models").Kind

// Channels + notifications
export type {
  SlackChannelDto as SlackChannel,
  SlackInstallStartResponse as StartSlackInstallResponse,
  TeamsChannelDto as TeamsChannel,
  PagerDutyChannelDto as PagerDutyChannel,
  EmailChannelDto,
  NotificationLogEntry,
  NotificationLogResult,
  NotificationResendResponse as ResendNotificationResponse,
} from "./generated/wrendex-models"

// Audit log
export type {
  AuditLogEntryDto as AuditLogEntry,
  AuditLogResult,
} from "./generated/wrendex-models"

// Search + status + catalog + bulk
export type {
  SearchResultDto as SearchResult,
  SearchResponse,
  StatusComponent,
  StatusIncident,
  StatusResponse,
  StatusSloTargets,
  CheckCatalogEntry as PublicCatalogEntry,
  BulkActionResponse,
} from "./generated/wrendex-models"

// Site verification (DTOs live under tenant/ on the BE)
export type {
  SiteVerificationResponse,
  SiteVerificationConfirmation,
} from "./generated/wrendex-models"

// Share links
export type {
  ShareLinkDto as ShareLink,
  SharedLinkInfo,
  ResolveShareResponse as SharedLinkResult,
  SiteSharePayload,
  PageDetailSharePayload,
  CrawlReportIssuesPayload,
} from "./generated/wrendex-models"

// Changelog
export type {
  ChangelogEntryDto as ChangelogEntry,
  ChangelogListResponse as ChangelogResult,
  ChangelogUnreadResponse as UnreadChangelog,
} from "./generated/wrendex-models"

// Telemetry (response only; the request shape stays below in the inputs section)
export type {
  TelemetryIngestResponse,
} from "./generated/wrendex-models"

// ---------------------------------------------------------------------------
// Shared-link payload "kitchen sink" type.
//
// The wire is genuinely heterogeneous (different fields per scope /
// subResource) but the BE returns each variant un-wrapped at the payload
// root, AND the SharedView FE renderer reads variant-specific fields with
// optional chaining. We expose every possible field as optional so the FE
// compiles uniformly; runtime-level which-fields-are-present depends on
// `share.scope` + `share.subResource`. See the BE-side javadoc on
// `com.bigbug.api.dto.share.ResolveShareResponse` for the variants.
// ---------------------------------------------------------------------------

import type {
  Site as GenSharedSite,
  CrawlRun as GenSharedCrawlRun,
  Alert as GenSharedAlert,
  PageResult as GenSharedPageResult,
  LinkResult as GenSharedLinkResult,
  RedirectsResult as GenSharedRedirectsResult,
  DuplicatesResult as GenSharedDuplicatesResult,
  ResourcesResult as GenSharedResourcesResult,
  StructuredDataResult as GenSharedStructuredDataResult,
  SocialResult as GenSharedSocialResult,
  PageRow as GenSharedPageRow,
  HealthScorePoint as GenSharedHealthScorePoint,
  IssuesSummary as GenSharedIssuesSummary,
} from "./generated/wrendex-models"

export type SharedLinkPayload = {
  site?: GenSharedSite | null
  crawlRun?: GenSharedCrawlRun | null
  latestCrawl?: GenSharedCrawlRun | null
  healthScore?: GenSharedHealthScorePoint[] | null
  issuesSummary?: GenSharedIssuesSummary | null
  page?: GenSharedPageRow | null
  pageAlerts?: GenSharedAlert[] | null
  pages?: GenSharedPageResult | null
  links?: GenSharedLinkResult | null
  redirects?: GenSharedRedirectsResult | null
  duplicates?: GenSharedDuplicatesResult | null
  resources?: GenSharedResourcesResult | null
  structuredData?: GenSharedStructuredDataResult | null
  social?: GenSharedSocialResult | null
  crawlAlerts?: GenSharedAlert[] | null
  passwordRequired?: boolean
}

// ---------------------------------------------------------------------------
// Request shapes (FE -> BE). These describe the parameters the typed client
// builds into the URL or request body. The BE reads them via JsonNode /
// queryParam, so they have no Java DTO to mirror; FE-only by design.
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

export type AuthSignupRequest = {
  email: string
  password: string
  tenantName: string
}

export type AuthLoginRequest = {
  email: string
  password: string
}

export type Login2faRequest = {
  pendingToken: string
  code: string
}

export type CreateApiTokenInput = {
  name: string
  expiresAt?: string | null
}

export type PasswordResetRequest = {
  email: string
}

export type PasswordResetConfirm = {
  token: string
  newPassword: string
}

export type SiteVerificationRequest = {
  method: SiteVerificationMethod
}

/** Body for POST /api/sites. The BE allows every config knob to default; only
 *  url is required from the client. */
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

/** Body for PATCH /api/sites/{id}. Every field is optional. */
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

export type CreateCheckoutSessionInput = {
  priceTier: Plan
  returnUrl: string
  trialDays?: number
}

export type CreatePortalSessionInput = {
  returnUrl: string
}

export type PatchAutoTopUpInput = {
  enabled: boolean
  packSku: CreditPackSku
  thresholdCredits: number
}

export type ManualTopUpInput = {
  packSku: CreditPackSku
}

export type UpdateAlertRuleInput = Partial<Pick<GenAlertRule, "enabled" | "params">>

/** Body for POST /api/sites/{siteId}/alert-rules. CUSTOM is the only kind
 *  the create endpoint currently accepts. */
export type CreateAlertRuleInput = {
  kind: AlertRuleKind
  enabled: boolean
  params: CustomAlertRuleParams | Record<string, unknown>
}

export type AlertRuleTriggerOp = "<" | ">" | "<=" | ">="
export type AlertRuleDigestCron = "DAILY" | "WEEKLY" | "MONTHLY"

export type AlertRuleTrigger =
  | { kind: "ALERT_FIRED"; firstSeen?: boolean }
  | { kind: "SCORE_THRESHOLD"; op: AlertRuleTriggerOp; value: number }
  | {
      kind: "ALERT_COUNT_THRESHOLD"
      severity?: import("./generated/wrendex-models").Severity
      op: AlertRuleTriggerOp
      value: number
    }
  | { kind: "DIGEST_PERIOD"; cron: AlertRuleDigestCron }

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

export type UpdateEmailChannelInput = Pick<GenEmailChannel, "recipients"> & {
  kind: EmailChannelKind
}

export type UpdateSiteScheduleInput = {
  cadence: import("./generated/wrendex-models").SiteCadence
}

export type TelemetryEvent = {
  event: string
  properties?: Record<string, unknown>
  timestamp?: string
  sessionId?: string
  anonymousCrawlToken?: string
  userId?: string
  tenantId?: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
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

export type UpdateTeamsChannelInput = {
  webhookUrl: string
}

export type UpdatePagerDutyChannelInput = {
  integrationKey: string
  severityFloor: SeverityFloor
}

export type BulkAlertActionRequest = {
  alertIds: string[]
}

export type BulkSnoozeRequest = BulkAlertActionRequest & {
  until: string
}

export type BulkAssignRequest = BulkAlertActionRequest & {
  userId: string | null
}

export type SnoozeAlertInput = {
  until: string
}

export type AssignAlertInput = {
  userId: string | null
}

export type StartSlackInstallInput = {
  returnUrl: string
}

export type UpdateTenantBrandingInput = {
  logoDataUrl?: string | null
  accentColor?: string | null
  fromName?: string | null
  hidePoweredBy?: boolean | null
  customSubdomain?: string | null
}

export type UpdateSamlConfigInput = {
  idpEntityId: string
  idpSsoUrl: string
  idpCertX509: string
  enabled?: boolean
}

export type ListInvoicesParams = {
  limit?: number
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

export type ListAuditLogParams = {
  page?: number
  size?: number
  since?: string
  action?: AuditAction
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

export type ListPublishedChangelogParams = {
  limit?: number
  since?: string
}

export type ListAdminChangelogParams = {
  includeDrafts?: boolean
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

export type CreateSavedViewInput = Pick<GenSavedView, "name" | "route" | "filterJson"> & {
  siteId?: string | null
  shared?: boolean
}

export type UpdateSavedViewInput = Partial<Pick<GenSavedView, "name" | "filterJson" | "shared">>

export type ListSavedViewsParams = {
  siteId?: string
  route?: string
}

export type StartSpotAuditInput = {
  urls: string[]
}

/** POST /api/sites/{siteId}/spot-audits returns the underlying CrawlRun
 *  populated with `origin` + `seedUrls` extras the persisted model carries.
 *  The shape is the codegen CrawlRun; the BE writes the extras directly on
 *  the model before returning, so no DTO wrapper is needed. */
export type StartSpotAuditResponse = GenCrawlRun & {
  origin?: string
  seedUrls?: string[]
}

export type SearchParams = {
  q: string
  tenantId: string
  limit?: number
  activeSiteId?: string
}

// ---------------------------------------------------------------------------
// Lightweight wrappers still hand-written.
// ---------------------------------------------------------------------------

/** POST /api/sites/{siteId}/emailed-summary response. Trivial; controller
 *  has not been migrated to a DTO yet. */
export type EmailedSummaryResponse = {
  queued: boolean
}
