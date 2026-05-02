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
  Page,
  PageExploreParams,
  PageResult,
  RedirectsResult,
  ResourcesResult,
  Site,
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
   *  Placeholder for the auth work landing in plan section 0.3a. */
  getAuthHeader?: AuthHeaderProvider
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
   * binds to the async POST /api/sites/{siteId}/crawls endpoint that lands
   * in plan section 0.3b - do NOT call this from feature code.
   */
  function startCrawlSync(siteId: string): Promise<CrawlRun> {
    return request<CrawlRun>("POST", `/api/sites/${siteId}/crawl`)
  }

  function listCrawlsBySite(siteId: string): Promise<CrawlRun[]> {
    return request<CrawlRun[]>("GET", `/api/sites/${siteId}/crawls`)
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
    listCrawlsBySite,
    // reports
    listCrawlPages,
    listCrawlAlerts,
    listSiteAlerts,
    listPageAlerts,
    getHealthScore,
    getIssuesSummary,
    explorePages,
    getCrawlLog,
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
