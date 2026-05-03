// Smoke test for the Page Explorer. Mocks the typed client at the
// useApiClient module boundary. Asserts:
//   1. The DataTable renders with the rows from explorePages.
//   2. Selecting a single status code in the multi-select drives that
//      status code through to explorePages.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { PageResult, PageRow } from "@/api/types"

const explorePages = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    explorePages,
  }),
}))

import { PageExplorer } from "../PageExplorer"

function makePage(
  id: string,
  url: string,
  statusCode: number,
  overrides: Partial<PageRow> = {},
): PageRow {
  return {
    id,
    siteId: "s_1",
    crawlRunId: "c_1",
    url,
    statusCode,
    contentType: "text/html",
    responseTimeMs: 120,
    ttfbMs: 50,
    contentLengthBytes: 4096,
    title: null,
    metaDescription: null,
    h1: null,
    canonicalUrl: null,
    robotsMeta: null,
    lang: "en",
    titleCount: 1,
    metaDescriptionCount: 0,
    h1Count: 1,
    viewportContent: null,
    wordCount: 200,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    ogUrl: null,
    twitterCard: null,
    xrobotsTag: null,
    fromPageId: null,
    outgoingLinks: null,
    redirectChain: null,
    timedOut: false,
    redirectLoop: false,
    contentEncoding: null,
    hreflangEntries: null,
    metaRefreshUrl: null,
    contentHash: null,
    jsonLdScripts: null,
    crawledAt: "2026-04-30T00:00:00Z",
    ampPage: false,
    errorCount: 0,
    warningCount: 0,
    noticeCount: 0,
    indexable: true,
    ...overrides,
  } as unknown as PageRow
}

function makeResult(pages: PageRow[]): PageResult {
  return { pages, total: pages.length, page: 0, size: 50 }
}

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/pages"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/pages"
            element={<PageExplorer />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("PageExplorer", () => {
  afterEach(() => {
    cleanup()
    explorePages.mockReset()
  })

  it("renders DataTable with pages from explorePages", async () => {
    explorePages.mockResolvedValue(
      makeResult([
        makePage("p_1", "https://acme.example/", 200),
        makePage("p_2", "https://acme.example/about", 404),
      ]),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("https://acme.example/")).toBeTruthy()
    })
    expect(screen.getByText("https://acme.example/about")).toBeTruthy()
    // The 200 badge + 404 badge each render their status code text. Multiple
    // other cells (e.g. wordCount=200) also produce a "200" string, so use
    // getAllByText to match any of them.
    expect(screen.getAllByText("200").length).toBeGreaterThan(0)
    expect(screen.getByText("404")).toBeTruthy()
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0)
  })

  it("filters via the status code multi-select (single selection)", async () => {
    explorePages.mockResolvedValue(makeResult([makePage("p_1", "https://acme.example/", 200)]))

    renderRoute()

    await waitFor(() => {
      expect(explorePages).toHaveBeenCalled()
    })
    explorePages.mockClear()

    const trigger = screen.getByRole("button", { name: /Status code filter/ })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)

    const checkbox = await screen.findByRole("menuitemcheckbox", { name: "404" })
    fireEvent.click(checkbox)

    await waitFor(() => {
      const last = explorePages.mock.calls.at(-1)
      expect(last?.[1]?.statusCode).toBe(404)
    })
  })
})
