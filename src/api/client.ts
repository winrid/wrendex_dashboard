// Thin typed fetch wrapper around the Javalin backend. Every dashboard
// HTTP call MUST go through this module - no raw fetch / axios / hand-
// written URL strings in feature code (see AGENTS.md hard rule #1).
//
// Backed by /home/winrid/dev/wrendex/backend/src/main/java/com/bigbug/api/*.java
// (TenantController, SiteController, CrawlController, ReportController).

import type {
  AcceptInviteResponse,
  Alert,
  AlertListParams,
  AlertQueryResult,
  AlertRule,
  AnonymousCrawlClaimResponse,
  AnonymousCrawlFull,
  AnonymousCrawlStartResponse,
  AnonymousCrawlSummary,
  AuditLogResult,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSignupRequest,
  AuthSignupResponse,
  BillingSnapshot,
  BulkActionResponse,
  ChangePasswordInput,
  CrawlDiff,
  CrawlLogEntry,
  CrawlRun,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResponse,
  CreateInviteInput,
  CreatePortalSessionInput,
  CreatePortalSessionResponse,
  CreateSiteInput,
  CreateTenantInput,
  DirectoryNode,
  DuplicatesResult,
  EmailChannel,
  EmailedSummaryResponse,
  HealthScorePoint,
  InvitePublicView,
  IssuesSummary,
  LinkExploreParams,
  LinkResult,
  ListAuditLogParams,
  ListNotificationLogParams,
  Me,
  NotificationLogResult,
  Page,
  PageExploreParams,
  PageResult,
  PagerDutyChannel,
  PasswordResetConfirm,
  PasswordResetRequest,
  PublicCatalogEntry,
  RedirectsResult,
  ResendNotificationInput,
  ResendNotificationResponse,
  ResourcesResult,
  SetupIntent,
  Site,
  SiteSchedule,
  SlackChannel,
  StartSlackInstallInput,
  StartSlackInstallResponse,
  StatusResponse,
  TeamsChannel,
  TenantInvite,
  TenantMember,
  TransferOwnershipInput,
  UpdateMemberRoleInput,
  UpdatePagerDutyChannelInput,
  UpdateTeamsChannelInput,
  SiteVerificationConfirmation,
  SiteVerificationRequest,
  SiteVerificationResponse,
  SocialResult,
  StructuredDataResult,
  TelemetryEvent,
  Tenant,
  UpdateAlertRuleInput,
  UpdateEmailChannelInput,
  UpdateSiteInput,
  UpdateSiteScheduleInput,
} from "./types"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown for any non-2xx response. `body` is the parsed JSON body if
 *  available, otherwise the raw text. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** Specialised ApiError thrown when the backend rate-limits a request
 *  (HTTP 429). The Retry-After response header is parsed into seconds so
 *  callers can render a "try again in N minutes" message without re-
 *  parsing the HTTP layer. */
export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number

  constructor(message: string, body: unknown, retryAfterSeconds: number) {
    super(429, message, body)
    this.name = "RateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isRateLimitError(e: unknown): e is RateLimitError {
  return e instanceof RateLimitError
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type AuthHeaderProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>
  | undefined

export type CreateApiClientOptions = {
  baseUrl: string
  /** Returns headers to merge into every request (e.g. Authorization).
   *  Wired up to the auth token store in plan section 0.3a; see
   *  useApiClient.ts for the singleton's wiring. */
  getAuthHeader?: AuthHeaderProvider
  /** Side-effect setter the auth methods call after login/signup/logout to
   *  keep the in-memory bearer token in sync without a round-trip through
   *  the AuthProvider. The provider still writes to localStorage. */
  setAuthToken?: (token: string | null) => void
  /** Override the global fetch (handy for tests). */
  fetchImpl?: typeof fetch
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const url = new URL(trimmed + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/** Parse the HTTP Retry-After response header into seconds. Per RFC 7231
 *  the value is either an HTTP-date or a delta-seconds integer; the BE
 *  emits delta-seconds. Falls back to 60s if the header is missing or
 *  malformed so the UI always has something to show. */
function parseRetryAfter(raw: string | null): number {
  if (!raw) return 60
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) return Math.round(n)
  // HTTP-date fallback (uncommon in practice for 429s).
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) {
    const diff = Math.round((t - Date.now()) / 1000)
    return diff > 0 ? diff : 60
  }
  return 60
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined
  const text = await res.text()
  if (!text) return undefined
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(opts: CreateApiClientOptions) {
  const fetchImpl: typeof fetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown; skipAuth?: boolean } = {},
  ): Promise<T> {
    const url = buildUrl(opts.baseUrl, path, init.query)
    const headers: Record<string, string> = { Accept: "application/json" }
    if (init.body !== undefined) headers["Content-Type"] = "application/json"
    // skipAuth opts a single request out of the global Authorization
    // header. Used by the public anonymous-crawl POST + GET so the
    // backend's auth middleware doesn't see a Bearer token while the
    // public path is still being routed.
    if (opts.getAuthHeader && !init.skipAuth) {
      const auth = await opts.getAuthHeader()
      if (auth) Object.assign(headers, auth)
    }
    const res = await fetchImpl(url, {
      method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const body = await parseBody(res)
    if (!res.ok) {
      const message =
        typeof body === "string" && body.length > 0
          ? body
          : `${method} ${path} failed with ${res.status}`
      if (res.status === 429) {
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"))
        throw new RateLimitError(message, body, retryAfter)
      }
      throw new ApiError(res.status, message, body)
    }
    return body as T
  }

  // -------------------------------------------------------------------------
  // Auth - AuthController (plan section 0.3a)
  // -------------------------------------------------------------------------

  async function signup(input: AuthSignupRequest): Promise<AuthSignupResponse> {
    const res = await request<AuthSignupResponse>("POST", "/api/auth/signup", {
      body: input,
    })
    opts.setAuthToken?.(res.sessionToken)
    return res
  }

  async function login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    const res = await request<AuthLoginResponse>("POST", "/api/auth/login", {
      body: input,
    })
    opts.setAuthToken?.(res.sessionToken)
    return res
  }

  async function logout(): Promise<void> {
    try {
      await request<undefined>("POST", "/api/auth/logout")
    } finally {
      opts.setAuthToken?.(null)
    }
  }

  function requestPasswordReset(input: PasswordResetRequest): Promise<undefined> {
    return request<undefined>("POST", "/api/auth/password-reset/request", {
      body: input,
    })
  }

  function confirmPasswordReset(
    input: PasswordResetConfirm,
  ): Promise<undefined> {
    return request<undefined>("POST", "/api/auth/password-reset/confirm", {
      body: input,
    })
  }

  function getMe(): Promise<Me> {
    return request<Me>("GET", "/api/me")
  }

  // -------------------------------------------------------------------------
  // Site verification (plan section 0.3a)
  // -------------------------------------------------------------------------

  function requestSiteVerification(
    siteId: string,
    input: SiteVerificationRequest,
  ): Promise<SiteVerificationResponse> {
    return request<SiteVerificationResponse>(
      "POST",
      `/api/sites/${siteId}/verify`,
      { body: input },
    )
  }

  function confirmSiteVerification(
    siteId: string,
  ): Promise<SiteVerificationConfirmation> {
    return request<SiteVerificationConfirmation>(
      "POST",
      `/api/sites/${siteId}/verify/confirm`,
    )
  }

  // -------------------------------------------------------------------------
  // Tenants - TenantController
  // -------------------------------------------------------------------------

  function listTenants(): Promise<Tenant[]> {
    return request<Tenant[]>("GET", "/api/tenants")
  }

  function createTenant(input: CreateTenantInput): Promise<Tenant> {
    return request<Tenant>("POST", "/api/tenants", { body: input })
  }

  // -------------------------------------------------------------------------
  // Sites - SiteController
  // -------------------------------------------------------------------------

  function listSitesByTenant(tenantId: string): Promise<Site[]> {
    return request<Site[]>("GET", `/api/tenants/${tenantId}/sites`)
  }

  function getSite(tenantId: string, siteId: string): Promise<Site> {
    return request<Site>("GET", `/api/tenants/${tenantId}/sites/${siteId}`)
  }

  function createSite(tenantId: string, input: CreateSiteInput): Promise<Site> {
    return request<Site>("POST", `/api/tenants/${tenantId}/sites`, { body: input })
  }

  function updateSite(
    tenantId: string,
    siteId: string,
    input: UpdateSiteInput,
  ): Promise<Site> {
    return request<Site>("PUT", `/api/tenants/${tenantId}/sites/${siteId}`, {
      body: input,
    })
  }

  function deleteSite(tenantId: string, siteId: string): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/sites/${siteId}`,
    )
  }

  // -------------------------------------------------------------------------
  // Crawls - CrawlController
  // -------------------------------------------------------------------------

  /**
   * INTERNAL / debug only. Triggers the synchronous crawl endpoint and
   * blocks until the crawl finishes. The dashboard "Run audit now" button
   * binds to startCrawlAsync below.
   */
  function startCrawlSync(siteId: string): Promise<CrawlRun> {
    return request<CrawlRun>("POST", `/api/sites/${siteId}/crawl`)
  }

  /**
   * Async crawl trigger. Backed by POST /api/sites/{siteId}/crawls (plural).
   * The backend returns 202 Accepted with the queued CrawlRun (status="queued"
   * or "running"); poll getCrawl(run.id) every couple of seconds to advance.
   * If a run is already active for the site, the backend returns 409 with the
   * existing run; the typed client surfaces that as an ApiError with .body
   * set to the live CrawlRun so callers can recover by polling it.
   */
  function startCrawlAsync(siteId: string): Promise<CrawlRun> {
    return request<CrawlRun>("POST", `/api/sites/${siteId}/crawls`)
  }

  function listCrawlsBySite(siteId: string): Promise<CrawlRun[]> {
    return request<CrawlRun[]>("GET", `/api/sites/${siteId}/crawls`)
  }

  /** Fetches a single CrawlRun by id; used by the "Run audit now" poll loop. */
  function getCrawl(crawlRunId: string): Promise<CrawlRun> {
    return request<CrawlRun>("GET", `/api/crawls/${crawlRunId}`)
  }

  /**
   * Diff the alerts of two crawls of the same site. Backed by GET
   * /api/crawls/{crawlId}/diff?against={prevCrawlId} (iter 4 BE-4 commit
   * db0983c). Returns three partitions - new / resolved / persisted - each
   * hard-capped at the backend's DIFF_MAX with a sibling truncation boolean.
   * Used by the SiteDetail regression strip (plan section 2.5).
   */
  function getCrawlDiff(
    crawlId: string,
    params: { against: string },
  ): Promise<CrawlDiff> {
    return request<CrawlDiff>("GET", `/api/crawls/${crawlId}/diff`, {
      query: { against: params.against },
    })
  }

  // -------------------------------------------------------------------------
  // Reports - ReportController
  // -------------------------------------------------------------------------

  function listCrawlPages(crawlId: string): Promise<Page[]> {
    return request<Page[]>("GET", `/api/crawls/${crawlId}/pages`)
  }

  /** Always sends at least page=0 so the backend returns the wrapped
   *  AlertQueryResult shape. Feature code never needs to branch on the
   *  bare-array compatibility response. */
  function listCrawlAlerts(
    crawlId: string,
    params: AlertListParams = {},
  ): Promise<AlertQueryResult> {
    return request<AlertQueryResult>("GET", `/api/crawls/${crawlId}/alerts`, {
      query: { page: 0, ...alertQuery(params) },
    })
  }

  function listSiteAlerts(
    siteId: string,
    params: AlertListParams = {},
  ): Promise<AlertQueryResult> {
    return request<AlertQueryResult>("GET", `/api/sites/${siteId}/alerts`, {
      query: { page: 0, ...alertQuery(params) },
    })
  }

  function listPageAlerts(
    pageId: string,
    params: AlertListParams = {},
  ): Promise<AlertQueryResult> {
    return request<AlertQueryResult>("GET", `/api/pages/${pageId}/alerts`, {
      query: { page: 0, ...alertQuery(params) },
    })
  }

  function getHealthScore(siteId: string): Promise<HealthScorePoint[]> {
    return request<HealthScorePoint[]>(
      "GET",
      `/api/sites/${siteId}/health-score`,
    )
  }

  function getIssuesSummary(crawlId: string): Promise<IssuesSummary> {
    return request<IssuesSummary>("GET", `/api/crawls/${crawlId}/issues`)
  }

  function explorePages(
    crawlId: string,
    params: PageExploreParams = {},
  ): Promise<PageResult> {
    return request<PageResult>(
      "GET",
      `/api/crawls/${crawlId}/pages/explore`,
      { query: params as Query },
    )
  }

  function getCrawlLog(siteId: string): Promise<CrawlLogEntry[]> {
    return request<CrawlLogEntry[]>("GET", `/api/sites/${siteId}/crawl-log`)
  }

  /** Plan-preferred name for getCrawlLog. Same backing endpoint - both names
   *  are exported so feature code can use whichever reads naturally. */
  const listCrawlLog = getCrawlLog

  function exploreLinks(
    crawlId: string,
    params: LinkExploreParams = {},
  ): Promise<LinkResult> {
    return request<LinkResult>(
      "GET",
      `/api/crawls/${crawlId}/links/explore`,
      { query: params as Query },
    )
  }

  function getStructure(crawlId: string): Promise<DirectoryNode[]> {
    return request<DirectoryNode[]>("GET", `/api/crawls/${crawlId}/structure`)
  }

  function getRedirects(crawlId: string): Promise<RedirectsResult> {
    return request<RedirectsResult>("GET", `/api/crawls/${crawlId}/redirects`)
  }

  function getDuplicates(crawlId: string): Promise<DuplicatesResult> {
    return request<DuplicatesResult>(
      "GET",
      `/api/crawls/${crawlId}/duplicates`,
    )
  }

  function getSocial(crawlId: string): Promise<SocialResult> {
    return request<SocialResult>("GET", `/api/crawls/${crawlId}/social`)
  }

  function getStructuredData(crawlId: string): Promise<StructuredDataResult> {
    return request<StructuredDataResult>(
      "GET",
      `/api/crawls/${crawlId}/structured-data`,
    )
  }

  function getResources(crawlId: string): Promise<ResourcesResult> {
    return request<ResourcesResult>("GET", `/api/crawls/${crawlId}/resources`)
  }

  function getPage(pageId: string): Promise<Page> {
    return request<Page>("GET", `/api/pages/${pageId}`)
  }

  function getPageByUrl(crawlId: string, url: string): Promise<Page> {
    return request<Page>("GET", `/api/crawls/${crawlId}/pages/by-url`, {
      query: { url },
    })
  }

  function ignoreAlert(alertId: string): Promise<Alert> {
    return request<Alert>("PATCH", `/api/alerts/${alertId}/ignore`)
  }

  function unignoreAlert(alertId: string): Promise<Alert> {
    return request<Alert>("PATCH", `/api/alerts/${alertId}/unignore`)
  }

  // -------------------------------------------------------------------------
  // Per-alert snooze / assign (plan section 3, BE iter 3). Snooze sets the
  // alert status to SNOOZED until the supplied ISO timestamp; the BE
  // un-snoozes lazily on read or via a sweep.
  // -------------------------------------------------------------------------

  function snoozeAlert(alertId: string, until: string): Promise<Alert> {
    return request<Alert>("PATCH", `/api/alerts/${alertId}/snooze`, {
      body: { until },
    })
  }

  function unsnoozeAlert(alertId: string): Promise<Alert> {
    return request<Alert>("PATCH", `/api/alerts/${alertId}/unsnooze`)
  }

  function assignAlert(
    alertId: string,
    userId: string | null,
  ): Promise<Alert> {
    return request<Alert>("PATCH", `/api/alerts/${alertId}/assign`, {
      body: { userId },
    })
  }

  // -------------------------------------------------------------------------
  // Bulk actions (plan section 3, BE iter 3). Each method takes a list of
  // alert ids; the BE returns {updated: N}. Endpoints under /api/bulk/alerts/*.
  // -------------------------------------------------------------------------

  function bulkIgnore(alertIds: string[]): Promise<BulkActionResponse> {
    return request<BulkActionResponse>("PATCH", "/api/bulk/alerts/ignore", {
      body: { alertIds },
    })
  }

  function bulkUnignore(alertIds: string[]): Promise<BulkActionResponse> {
    return request<BulkActionResponse>("PATCH", "/api/bulk/alerts/unignore", {
      body: { alertIds },
    })
  }

  function bulkSnooze(
    alertIds: string[],
    until: string,
  ): Promise<BulkActionResponse> {
    return request<BulkActionResponse>("PATCH", "/api/bulk/alerts/snooze", {
      body: { alertIds, until },
    })
  }

  function bulkAssign(
    alertIds: string[],
    userId: string | null,
  ): Promise<BulkActionResponse> {
    return request<BulkActionResponse>("PATCH", "/api/bulk/alerts/assign", {
      body: { alertIds, userId },
    })
  }

  // -------------------------------------------------------------------------
  // Anonymous crawls - AnonymousCrawlController (plan section 2.0)
  // -------------------------------------------------------------------------
  //
  // The POST + GET teaser endpoints do NOT require a bearer token. We pass
  // skipAuth=true so the global getAuthHeader hook is not consulted; this
  // avoids leaking the user's session token to the public bucket and keeps
  // the backend's auth middleware happy when both a public POST and an
  // authenticated /claim are routed through the same shared base path.

  function startAnonymousCrawl(input: {
    url: string
  }): Promise<AnonymousCrawlStartResponse> {
    return request<AnonymousCrawlStartResponse>(
      "POST",
      "/api/anonymous-crawls",
      { body: input, skipAuth: true },
    )
  }

  function getAnonymousCrawl(token: string): Promise<AnonymousCrawlSummary> {
    return request<AnonymousCrawlSummary>(
      "GET",
      `/api/anonymous-crawls/${encodeURIComponent(token)}`,
      { skipAuth: true },
    )
  }

  function claimAnonymousCrawl(
    token: string,
    tenantId: string,
  ): Promise<AnonymousCrawlClaimResponse> {
    return request<AnonymousCrawlClaimResponse>(
      "POST",
      `/api/anonymous-crawls/${encodeURIComponent(token)}/claim`,
      { body: { tenantId } },
    )
  }

  function getAnonymousCrawlFull(token: string): Promise<AnonymousCrawlFull> {
    return request<AnonymousCrawlFull>(
      "GET",
      `/api/anonymous-crawls/${encodeURIComponent(token)}/full`,
    )
  }

  /**
   * STUB. The "Email me the summary" CTA on the teaser page. There is no
   * backend endpoint yet (the BE email worker doesn't expose this surface);
   * this method resolves after a short delay so the dialog can show a loading
   * state before flipping to the toast. Replace the body with a real
   * `request(...)` call once the BE wires the endpoint. This is the only
   * allowed exception to the "no raw fetch" rule because there is no fetch -
   * it's a Promise.resolve wrapped in a setTimeout.
   */
  function requestEmailedSummary(
    _token: string,
    _email: string,
  ): Promise<EmailedSummaryResponse> {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve({ queued: true }), 250)
    })
  }

  // -------------------------------------------------------------------------
  // Billing - BillingController (plan section 11; iter 5 BE 097adde)
  // -------------------------------------------------------------------------

  function getBilling(tenantId: string): Promise<BillingSnapshot> {
    return request<BillingSnapshot>(
      "GET",
      `/api/tenants/${tenantId}/billing`,
    )
  }

  function createCheckoutSession(
    tenantId: string,
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResponse> {
    return request<CreateCheckoutSessionResponse>(
      "POST",
      `/api/tenants/${tenantId}/billing/checkout-session`,
      { body: input },
    )
  }

  function createPortalSession(
    tenantId: string,
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResponse> {
    return request<CreatePortalSessionResponse>(
      "POST",
      `/api/tenants/${tenantId}/billing/portal-session`,
      { body: input },
    )
  }

  // -------------------------------------------------------------------------
  // Alert rules - AlertRuleController (plan section 8.1; iter 6 BE)
  // -------------------------------------------------------------------------

  function listAlertRules(siteId: string): Promise<AlertRule[]> {
    return request<AlertRule[]>("GET", `/api/sites/${siteId}/alert-rules`)
  }

  function updateAlertRule(
    siteId: string,
    ruleId: string,
    input: UpdateAlertRuleInput,
  ): Promise<AlertRule> {
    return request<AlertRule>(
      "PUT",
      `/api/sites/${siteId}/alert-rules/${ruleId}`,
      { body: input },
    )
  }

  // -------------------------------------------------------------------------
  // Email channel - EmailChannelController (plan section 8.2; iter 6 BE)
  // -------------------------------------------------------------------------

  function getEmailChannel(tenantId: string): Promise<EmailChannel> {
    return request<EmailChannel>(
      "GET",
      `/api/tenants/${tenantId}/email-channel`,
    )
  }

  function updateEmailChannel(
    tenantId: string,
    input: UpdateEmailChannelInput,
  ): Promise<EmailChannel> {
    return request<EmailChannel>(
      "PUT",
      `/api/tenants/${tenantId}/email-channel`,
      { body: input },
    )
  }

  // -------------------------------------------------------------------------
  // Schedule - SiteController.getSchedule / putSchedule (plan section 7;
  // iter 4 BE-4)
  // -------------------------------------------------------------------------

  function getSchedule(siteId: string): Promise<SiteSchedule> {
    return request<SiteSchedule>("GET", `/api/sites/${siteId}/schedule`)
  }

  function updateSchedule(
    siteId: string,
    input: UpdateSiteScheduleInput,
  ): Promise<SiteSchedule> {
    return request<SiteSchedule>("PUT", `/api/sites/${siteId}/schedule`, {
      body: input,
    })
  }

  // -------------------------------------------------------------------------
  // Telemetry - TelemetryController (plan section 16; iter 6 BE).
  //
  // PUBLIC route. We deliberately route through a dedicated raw fetch so the
  // global Authorization header is never attached, the call is best-effort
  // (errors logged + swallowed), and the per-browser sessionId is folded
  // onto each event before they go on the wire. Callers MUST NOT depend on
  // the return value beyond awaiting the promise.
  // -------------------------------------------------------------------------

  async function sendTelemetry(events: TelemetryEvent[]): Promise<void> {
    if (!events || events.length === 0) return
    try {
      const sessionId = getOrCreateSessionId()
      const stamped = events.map((e) =>
        e.sessionId ? e : { ...e, sessionId },
      )
      const url = buildUrl(opts.baseUrl, "/api/telemetry/events")
      // Note: skipAuth at the request-helper level isn't enough; we use a
      // dedicated fetch path so the response status is never thrown to the
      // user surface. Telemetry must never break the UX.
      await fetchImpl(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: stamped }),
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sendTelemetry failed", err)
    }
  }

  // -------------------------------------------------------------------------
  // Stripe SetupIntent (plan section 1.2 step 3). Bound to BE endpoint
  // POST /api/tenants/{tenantId}/billing/setup-intent (iter 2 round 1).
  // Returns the client_secret the FE feeds into Stripe Elements + the
  // Stripe customerId for downstream attach calls.
  // -------------------------------------------------------------------------

  function createSetupIntent(tenantId: string): Promise<SetupIntent> {
    return request<SetupIntent>(
      "POST",
      `/api/tenants/${tenantId}/billing/setup-intent`,
    )
  }

  // -------------------------------------------------------------------------
  // Account - changePassword. Bound to POST /api/auth/password/change (BE
  // iter 2 round 1). Returns 204 on success; the route surfaces 401 +
  // 400 inline.
  // -------------------------------------------------------------------------

  function changePassword(input: ChangePasswordInput): Promise<undefined> {
    return request<undefined>("POST", "/api/auth/password/change", {
      body: input,
    })
  }

  // -------------------------------------------------------------------------
  // Notification delivery log (plan section 4A.5). BE iter 2 round 2.
  // -------------------------------------------------------------------------

  function listNotificationLog(
    tenantId: string,
    params: ListNotificationLogParams = {},
  ): Promise<NotificationLogResult> {
    return request<NotificationLogResult>(
      "GET",
      `/api/tenants/${tenantId}/notifications/log`,
      {
        query: {
          page: params.page ?? 0,
          size: params.size,
          channel: params.channel,
          status: params.status,
          since: params.since,
        },
      },
    )
  }

  function resendNotification(
    tenantId: string,
    deliveryId: string,
    input: ResendNotificationInput,
  ): Promise<ResendNotificationResponse> {
    return request<ResendNotificationResponse>(
      "POST",
      `/api/tenants/${tenantId}/notifications/${deliveryId}/resend`,
      { body: input },
    )
  }

  // -------------------------------------------------------------------------
  // MS Teams + PagerDuty channels (plan section 8.2). BE iter 2 round 2.
  // 404 from the GET endpoints indicates the channel is not connected.
  // -------------------------------------------------------------------------

  function getTeamsChannel(tenantId: string): Promise<TeamsChannel> {
    return request<TeamsChannel>(
      "GET",
      `/api/tenants/${tenantId}/teams-channel`,
    )
  }

  function updateTeamsChannel(
    tenantId: string,
    input: UpdateTeamsChannelInput,
  ): Promise<TeamsChannel> {
    return request<TeamsChannel>(
      "PUT",
      `/api/tenants/${tenantId}/teams-channel`,
      { body: input },
    )
  }

  function deleteTeamsChannel(tenantId: string): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/teams-channel`,
    )
  }

  function getPagerDutyChannel(tenantId: string): Promise<PagerDutyChannel> {
    return request<PagerDutyChannel>(
      "GET",
      `/api/tenants/${tenantId}/pagerduty-channel`,
    )
  }

  function updatePagerDutyChannel(
    tenantId: string,
    input: UpdatePagerDutyChannelInput,
  ): Promise<PagerDutyChannel> {
    return request<PagerDutyChannel>(
      "PUT",
      `/api/tenants/${tenantId}/pagerduty-channel`,
      { body: input },
    )
  }

  function deletePagerDutyChannel(tenantId: string): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/pagerduty-channel`,
    )
  }

  // -------------------------------------------------------------------------
  // Slack channel (plan section 8.2). BE wired iter 1; FE OAuth install flow
  // shipped here. The install/start POST authenticates the caller (tenant
  // membership required) and returns the Slack authorize URL; the OAuth
  // callback POST is BE-handled and 302s back to the user's returnUrl.
  // -------------------------------------------------------------------------

  function getSlackChannel(tenantId: string): Promise<SlackChannel> {
    return request<SlackChannel>(
      "GET",
      `/api/tenants/${tenantId}/slack-channel`,
    )
  }

  function startSlackInstall(
    tenantId: string,
    input: StartSlackInstallInput,
  ): Promise<StartSlackInstallResponse> {
    return request<StartSlackInstallResponse>(
      "POST",
      `/api/tenants/${tenantId}/slack-channel/install/start`,
      { body: input },
    )
  }

  function deleteSlackChannel(tenantId: string): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/slack-channel`,
    )
  }

  // -------------------------------------------------------------------------
  // Team invites + members + audit log (plan section 14.2; phase 3 iter 1 BE).
  // The accept-invite POST is authenticated; the public GET of the invite
  // surface is opted out of the global Authorization header so unsigned-in
  // recipients can preview the invite before they have a session.
  // -------------------------------------------------------------------------

  function listTenantInvites(tenantId: string): Promise<TenantInvite[]> {
    return request<TenantInvite[]>(
      "GET",
      `/api/tenants/${tenantId}/invites`,
    )
  }

  function createInvite(
    tenantId: string,
    input: CreateInviteInput,
  ): Promise<TenantInvite> {
    return request<TenantInvite>(
      "POST",
      `/api/tenants/${tenantId}/invites`,
      { body: input },
    )
  }

  function revokeInvite(
    tenantId: string,
    inviteId: string,
  ): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/invites/${inviteId}`,
    )
  }

  /** POST /api/tenants/{tenantId}/invites/{inviteId}/resend. Re-enqueues the
   *  invitation email; the BE returns the (still-same) invite row. If the BE
   *  has not shipped this endpoint yet the call surfaces as a 404 ApiError;
   *  the FE catches that and renders a soft-fail toast. */
  function resendInvite(
    tenantId: string,
    inviteId: string,
  ): Promise<TenantInvite> {
    return request<TenantInvite>(
      "POST",
      `/api/tenants/${tenantId}/invites/${inviteId}/resend`,
    )
  }

  /** PUBLIC. Reads the invite metadata for the recipient before they have
   *  a session; skipAuth keeps the global Bearer header off the request so
   *  the BE's auth middleware never sees a stale token. */
  function getPublicInvite(token: string): Promise<InvitePublicView> {
    return request<InvitePublicView>(
      "GET",
      `/api/invites/${encodeURIComponent(token)}`,
      { skipAuth: true },
    )
  }

  /** AUTH. Accepts the invitation as the currently signed-in user. The BE
   *  enforces email match server-side and returns 403 if the signed-in
   *  email does not match the invite. */
  function acceptInvite(token: string): Promise<AcceptInviteResponse> {
    return request<AcceptInviteResponse>(
      "POST",
      `/api/invites/${encodeURIComponent(token)}/accept`,
    )
  }

  function listTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return request<TenantMember[]>(
      "GET",
      `/api/tenants/${tenantId}/members`,
    )
  }

  function updateMemberRole(
    tenantId: string,
    userId: string,
    input: UpdateMemberRoleInput,
  ): Promise<TenantMember> {
    return request<TenantMember>(
      "PATCH",
      `/api/tenants/${tenantId}/members/${userId}/role`,
      { body: input },
    )
  }

  function removeMember(
    tenantId: string,
    userId: string,
  ): Promise<undefined> {
    return request<undefined>(
      "DELETE",
      `/api/tenants/${tenantId}/members/${userId}`,
    )
  }

  function transferOwnership(
    tenantId: string,
    input: TransferOwnershipInput,
  ): Promise<undefined> {
    return request<undefined>(
      "POST",
      `/api/tenants/${tenantId}/transfer-ownership`,
      { body: input },
    )
  }

  function listAuditLog(
    tenantId: string,
    params: ListAuditLogParams = {},
  ): Promise<AuditLogResult> {
    return request<AuditLogResult>(
      "GET",
      `/api/tenants/${tenantId}/audit-log`,
      {
        query: {
          page: params.page ?? 0,
          size: params.size,
          since: params.since,
          action: params.action,
        },
      },
    )
  }

  // -------------------------------------------------------------------------
  // Public catalog (plan section 6 / sec 0.3e iter 2). PUBLIC, no auth.
  // The dashboard's static checkCatalog.ts is the source of truth for
  // human-readable copy; this endpoint is used to surface drift between FE
  // and BE catalogs and to back the /catalog explorer route.
  // -------------------------------------------------------------------------

  function getPublicCatalog(): Promise<PublicCatalogEntry[]> {
    return request<PublicCatalogEntry[]>("GET", "/api/catalog", {
      skipAuth: true,
    })
  }

  // -------------------------------------------------------------------------
  // Public status page (plan section 16; BE iter 3). PUBLIC, no auth.
  // Returns operational / degraded / down for each subsystem the FE
  // surfaces on /status.
  // -------------------------------------------------------------------------

  function getStatus(): Promise<StatusResponse> {
    return request<StatusResponse>("GET", "/api/status", { skipAuth: true })
  }

  return {
    // auth
    signup,
    login,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
    getMe,
    // site verification
    requestSiteVerification,
    confirmSiteVerification,
    // tenants
    listTenants,
    createTenant,
    // sites
    listSitesByTenant,
    getSite,
    createSite,
    updateSite,
    deleteSite,
    // crawls
    startCrawlSync,
    startCrawlAsync,
    listCrawlsBySite,
    getCrawl,
    getCrawlDiff,
    // reports
    listCrawlPages,
    listCrawlAlerts,
    listSiteAlerts,
    listPageAlerts,
    getHealthScore,
    getIssuesSummary,
    explorePages,
    getCrawlLog,
    listCrawlLog,
    exploreLinks,
    getStructure,
    getRedirects,
    getDuplicates,
    getSocial,
    getStructuredData,
    getResources,
    getPage,
    getPageByUrl,
    ignoreAlert,
    unignoreAlert,
    snoozeAlert,
    unsnoozeAlert,
    assignAlert,
    bulkIgnore,
    bulkUnignore,
    bulkSnooze,
    bulkAssign,
    // anonymous crawls
    startAnonymousCrawl,
    getAnonymousCrawl,
    claimAnonymousCrawl,
    getAnonymousCrawlFull,
    requestEmailedSummary,
    // billing
    getBilling,
    createCheckoutSession,
    createPortalSession,
    // alert rules
    listAlertRules,
    updateAlertRule,
    // email channel
    getEmailChannel,
    updateEmailChannel,
    // schedule
    getSchedule,
    updateSchedule,
    // telemetry (public; best-effort)
    sendTelemetry,
    // stripe
    createSetupIntent,
    // account
    changePassword,
    // notifications (BE iter 2 round 2)
    listNotificationLog,
    resendNotification,
    // channels (BE iter 2 round 2)
    getTeamsChannel,
    updateTeamsChannel,
    deleteTeamsChannel,
    getPagerDutyChannel,
    updatePagerDutyChannel,
    deletePagerDutyChannel,
    // slack channel (BE iter 1)
    getSlackChannel,
    startSlackInstall,
    deleteSlackChannel,
    // team (phase 3 iter 1 BE)
    listTenantInvites,
    createInvite,
    revokeInvite,
    resendInvite,
    getPublicInvite,
    acceptInvite,
    listTenantMembers,
    updateMemberRole,
    removeMember,
    transferOwnership,
    listAuditLog,
    // public surfaces (no auth header)
    getPublicCatalog,
    getStatus,
  } as const
}

// ---------------------------------------------------------------------------
// Telemetry session id (plan section 16). One UUID per browser, stored under
// `wrendex.sessionId`. Reused across page loads, cleared on logout (the
// AuthProvider calls clearTelemetrySessionId in its logout path).
// ---------------------------------------------------------------------------

export const TELEMETRY_SESSION_ID_KEY = "wrendex.sessionId"

function generateSessionId(): string {
  // crypto.randomUUID is available everywhere we ship to (modern browsers +
  // jsdom 22+); fall back to a Math.random hex if it's missing so older test
  // environments still work.
  const c =
    typeof globalThis !== "undefined"
      ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
          .crypto
      : undefined
  if (c?.randomUUID) return c.randomUUID()
  const rand = Math.random().toString(16).slice(2)
  return `sid_${Date.now().toString(16)}_${rand}`
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return generateSessionId()
  try {
    const existing = window.localStorage.getItem(TELEMETRY_SESSION_ID_KEY)
    if (existing && existing.length > 0) return existing
    const next = generateSessionId()
    window.localStorage.setItem(TELEMETRY_SESSION_ID_KEY, next)
    return next
  } catch {
    return generateSessionId()
  }
}

export function clearTelemetrySessionId(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(TELEMETRY_SESSION_ID_KEY)
  } catch {
    // ignore
  }
}

/** Build the alert query, omitting undefined keys so a default page=0 set
 *  by the caller is not stomped by an explicit `page: undefined` here. */
function alertQuery(p: AlertListParams): Query {
  const q: Query = {}
  if (p.page !== undefined) q.page = p.page
  if (p.size !== undefined) q.size = p.size
  if (p.severity !== undefined) q.severity = p.severity
  if (p.type !== undefined) q.type = p.type
  if (p.pageUrlContains !== undefined) q.pageUrlContains = p.pageUrlContains
  if (p.pageId !== undefined) q.pageId = p.pageId
  if (p.status !== undefined) q.status = p.status
  if (p.crawlRunId !== undefined) q.crawlRunId = p.crawlRunId
  if (p.sort !== undefined) q.sort = p.sort
  if (p.dir !== undefined) q.dir = p.dir
  return q
}
