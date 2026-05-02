// Thin typed fetch wrapper around the Javalin backend. Every dashboard
// HTTP call MUST go through this module - no raw fetch / axios / hand-
// written URL strings in feature code (see AGENTS.md hard rule #1).
//
// Backed by /home/winrid/dev/wrendex/backend/src/main/java/com/bigbug/api/*.java
// (TenantController, SiteController, CrawlController, ReportController).

import type {
  Alert,
  AlertListParams,
  AlertQueryResult,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSignupRequest,
  AuthSignupResponse,
  CrawlLogEntry,
  CrawlRun,
  CreateSiteInput,
  CreateTenantInput,
  DirectoryNode,
  DuplicatesResult,
  HealthScorePoint,
  IssuesSummary,
  LinkExploreParams,
  LinkResult,
  Me,
  Page,
  PageExploreParams,
  PageResult,
  PasswordResetConfirm,
  PasswordResetRequest,
  RedirectsResult,
  ResourcesResult,
  Site,
  SiteVerificationConfirmation,
  SiteVerificationRequest,
  SiteVerificationResponse,
  SocialResult,
  StructuredDataResult,
  Tenant,
  UpdateSiteInput,
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
    init: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = buildUrl(opts.baseUrl, path, init.query)
    const headers: Record<string, string> = { Accept: "application/json" }
    if (init.body !== undefined) headers["Content-Type"] = "application/json"
    if (opts.getAuthHeader) {
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
  } as const
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
  if (p.sort !== undefined) q.sort = p.sort
  if (p.dir !== undefined) q.dir = p.dir
  return q
}
