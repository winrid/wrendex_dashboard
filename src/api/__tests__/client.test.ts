import { describe, expect, it } from "vitest"
import {
  ApiError,
  createApiClient,
  isApiError,
  type ApiClient,
} from "../client"
import type {
  Alert,
  AlertQueryResult,
  CrawlDiff,
  CrawlLogEntry,
  CrawlRun,
  DirectoryNode,
  DuplicatesResult,
  HealthScorePoint,
  IssuesSummary,
  LinkResult,
  Page,
  PageResult,
  RedirectsResult,
  ResourcesResult,
  Site,
  SocialResult,
  StructuredDataResult,
  Tenant,
} from "../types"

function makeClient(fetchImpl?: typeof fetch): ApiClient {
  return createApiClient({
    baseUrl: "http://localhost:7070",
    fetchImpl,
  })
}

describe("createApiClient", () => {
  it("exposes every endpoint method the dashboard needs", () => {
    const client = makeClient()
    const expected: Array<keyof ApiClient> = [
      "listTenants",
      "createTenant",
      "listSitesByTenant",
      "getSite",
      "createSite",
      "updateSite",
      "deleteSite",
      "startCrawlSync",
      "startCrawlAsync",
      "listCrawlsBySite",
      "getCrawl",
      "getCrawlDiff",
      "listCrawlPages",
      "listCrawlAlerts",
      "listSiteAlerts",
      "listPageAlerts",
      "getHealthScore",
      "getIssuesSummary",
      "explorePages",
      "getCrawlLog",
      "listCrawlLog",
      "exploreLinks",
      "getStructure",
      "getRedirects",
      "getDuplicates",
      "getSocial",
      "getStructuredData",
      "getResources",
      "getPage",
      "getPageByUrl",
      "ignoreAlert",
      "unignoreAlert",
    ]
    for (const name of expected) {
      expect(typeof client[name]).toBe("function")
    }
  })

  it("returns undefined for 204 No Content", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(null, { status: 204 })
    const client = makeClient(fetchImpl)
    await expect(client.deleteSite("t1", "s1")).resolves.toBeUndefined()
  })

  it("parses JSON responses", async () => {
    const tenant: Tenant = {
      id: "abc",
      name: "Acme",
      createdAt: "2026-04-30T00:00:00Z",
    }
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify([tenant]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    const client = makeClient(fetchImpl)
    const tenants = await client.listTenants()
    expect(tenants).toEqual([tenant])
  })

  it("throws ApiError on non-2xx", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("nope", { status: 500 })
    const client = makeClient(fetchImpl)
    await expect(client.listTenants()).rejects.toBeInstanceOf(ApiError)
  })

  it("forces wrapped pagination shape on alert endpoints by sending page=0", async () => {
    let calledUrl: string | undefined
    const fetchImpl: typeof fetch = async (input) => {
      calledUrl = typeof input === "string" ? input : input.toString()
      const empty: AlertQueryResult = { items: [], total: 0, page: 0, size: 50 }
      return new Response(JSON.stringify(empty), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    const client = makeClient(fetchImpl)
    await client.listSiteAlerts("siteA")
    expect(calledUrl).toContain("/api/sites/siteA/alerts")
    expect(calledUrl).toContain("page=0")
  })
})

describe("isApiError", () => {
  it("returns true for ApiError instances", () => {
    const e = new ApiError(404, "missing", { message: "missing" })
    expect(isApiError(e)).toBe(true)
  })

  it("returns false for plain Errors and arbitrary values", () => {
    expect(isApiError(new Error("x"))).toBe(false)
    expect(isApiError("oops")).toBe(false)
    expect(isApiError(null)).toBe(false)
    expect(isApiError(undefined)).toBe(false)
    expect(isApiError({ status: 500 })).toBe(false)
  })

  it("narrows the type so callers can read .status / .body", () => {
    const e: unknown = new ApiError(429, "rate limit", { retryAfter: 30 })
    if (isApiError(e)) {
      // Compile-time check: TypeScript must see status:number, body:unknown.
      const status: number = e.status
      const body: unknown = e.body
      expect(status).toBe(429)
      expect(body).toEqual({ retryAfter: 30 })
    } else {
      throw new Error("typeguard failed")
    }
  })
})

// Compile-time type assertions: each endpoint method's return type is
// exactly the documented Promise<T>. These never run at runtime - any
// drift surfaces as a TS error during `tsc -b` (vitest type-checks too).
describe("endpoint method return types", () => {
  it("compiles", () => {
    const c = makeClient()
    // The expression below is a type-only check; the runtime test is just
    // that we can construct it without throwing. Each `satisfies` line
    // pins the method shape.
    const sigs = {
      listTenants: c.listTenants satisfies () => Promise<Tenant[]>,
      createTenant: c.createTenant satisfies (i: { name: string }) => Promise<Tenant>,
      listSitesByTenant: c.listSitesByTenant satisfies (t: string) => Promise<Site[]>,
      getSite: c.getSite satisfies (t: string, s: string) => Promise<Site>,
      deleteSite: c.deleteSite satisfies (t: string, s: string) => Promise<undefined>,
      startCrawlSync: c.startCrawlSync satisfies (s: string) => Promise<CrawlRun>,
      listCrawlsBySite: c.listCrawlsBySite satisfies (s: string) => Promise<CrawlRun[]>,
      getCrawlDiff:
        c.getCrawlDiff satisfies (
          c: string,
          p: { against: string },
        ) => Promise<CrawlDiff>,
      listCrawlPages: c.listCrawlPages satisfies (c: string) => Promise<Page[]>,
      listCrawlAlerts:
        c.listCrawlAlerts satisfies (c: string) => Promise<AlertQueryResult>,
      listSiteAlerts:
        c.listSiteAlerts satisfies (s: string) => Promise<AlertQueryResult>,
      listPageAlerts:
        c.listPageAlerts satisfies (p: string) => Promise<AlertQueryResult>,
      getHealthScore:
        c.getHealthScore satisfies (s: string) => Promise<HealthScorePoint[]>,
      getIssuesSummary:
        c.getIssuesSummary satisfies (c: string) => Promise<IssuesSummary>,
      explorePages: c.explorePages satisfies (c: string) => Promise<PageResult>,
      getCrawlLog: c.getCrawlLog satisfies (s: string) => Promise<CrawlLogEntry[]>,
      exploreLinks: c.exploreLinks satisfies (c: string) => Promise<LinkResult>,
      getStructure:
        c.getStructure satisfies (c: string) => Promise<DirectoryNode[]>,
      getRedirects:
        c.getRedirects satisfies (c: string) => Promise<RedirectsResult>,
      getDuplicates:
        c.getDuplicates satisfies (c: string) => Promise<DuplicatesResult>,
      getSocial: c.getSocial satisfies (c: string) => Promise<SocialResult>,
      getStructuredData:
        c.getStructuredData satisfies (c: string) => Promise<StructuredDataResult>,
      getResources:
        c.getResources satisfies (c: string) => Promise<ResourcesResult>,
      getPage: c.getPage satisfies (p: string) => Promise<Page>,
      getPageByUrl: c.getPageByUrl satisfies (c: string, u: string) => Promise<Page>,
      ignoreAlert: c.ignoreAlert satisfies (a: string) => Promise<Alert>,
      unignoreAlert: c.unignoreAlert satisfies (a: string) => Promise<Alert>,
    }
    expect(Object.keys(sigs).length).toBeGreaterThan(0)
  })
})
