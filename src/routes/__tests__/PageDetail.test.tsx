// Smoke test for the Page detail. Mocks the typed client at the
// useApiClient boundary. Asserts:
//   1. Tabs switch and the chosen tab renders its content.
//   2. The Alerts tab calls listPageAlerts with the page id.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AlertQueryResult, Page } from "@/api/types"

const getPageByUrl = vi.fn()
const listPageAlerts = vi.fn()
const listCrawlsBySite = vi.fn()
const ignoreAlert = vi.fn()
const unignoreAlert = vi.fn()
const getResources = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getPageByUrl,
    listPageAlerts,
    listCrawlsBySite,
    ignoreAlert,
    unignoreAlert,
    getResources,
  }),
}))

import { PageDetail } from "../PageDetail"

function makePage(): Page {
  return {
    id: "p_1",
    siteId: "s_1",
    crawlRunId: "c_1",
    url: "https://acme.example/about",
    statusCode: 200,
    contentType: "text/html",
    responseTimeMs: 120,
    ttfbMs: 50,
    contentLengthBytes: 4096,
    title: "About us",
    metaDescription: "Acme example, about page.",
    h1: "About",
    canonicalUrl: "https://acme.example/about",
    robotsMeta: "index, follow",
    lang: "en",
    titleCount: 1,
    metaDescriptionCount: 1,
    h1Count: 1,
    viewportContent: "width=device-width, initial-scale=1",
    wordCount: 300,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    ogUrl: null,
    twitterCard: null,
    xRobotsTag: null,
    fromPageId: null,
    outgoingLinks: [
      {
        href: "/team",
        resolvedUrl: "https://acme.example/team",
        anchorText: "Our team",
        nofollow: false,
        rel: null,
        context: null,
        loading: null,
        width: null,
        height: null,
        media: null,
        async: false,
        defer: false,
      },
    ],
    redirectChain: null,
    timedOut: false,
    redirectLoop: false,
    contentEncoding: "gzip",
    hreflangEntries: null,
    metaRefreshUrl: null,
    contentHash: "abc123",
    jsonLdScripts: null,
    crawledAt: "2026-04-30T00:00:00Z",
    ampPage: false,
  }
}

function emptyAlerts(): AlertQueryResult {
  return { items: [], total: 0, page: 0, size: 25 }
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
        initialEntries={[
          "/t/t_1/sites/s_1/pages?url=https%3A%2F%2Facme.example%2Fabout&crawlId=c_1",
        ]}
      >
        <Routes>
          <Route path="/t/:tenantId/sites/:siteId/pages" element={<PageDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("PageDetail", () => {
  afterEach(() => {
    cleanup()
    getPageByUrl.mockReset()
    listPageAlerts.mockReset()
    listCrawlsBySite.mockReset()
    getResources.mockReset()
  })

  it("renders tabs and switches to Performance", async () => {
    getPageByUrl.mockResolvedValue(makePage())
    listPageAlerts.mockResolvedValue(emptyAlerts())
    getResources.mockResolvedValue({
      resources: [],
      totalCss: 0,
      totalJs: 0,
      totalImages: 0,
    })

    renderRoute()

    // Title from header
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "About us" })).toBeTruthy()
    })
    // Overview is the default tab; performance is hidden.
    const performanceTab = screen.getByRole("tab", { name: "Performance" })
    fireEvent.mouseDown(performanceTab, { button: 0 })
    fireEvent.click(performanceTab)

    await waitFor(() => {
      expect(screen.getByText("Response")).toBeTruthy()
    })
    expect(screen.getByText("120 ms")).toBeTruthy()
  })

  it("Alerts tab fetches listPageAlerts with the page id", async () => {
    getPageByUrl.mockResolvedValue(makePage())
    listPageAlerts.mockResolvedValue(emptyAlerts())
    getResources.mockResolvedValue({
      resources: [],
      totalCss: 0,
      totalJs: 0,
      totalImages: 0,
    })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "About us" })).toBeTruthy()
    })

    const alertsTab = screen.getByRole("tab", { name: "Alerts" })
    fireEvent.mouseDown(alertsTab, { button: 0 })
    fireEvent.click(alertsTab)

    await waitFor(() => {
      expect(listPageAlerts).toHaveBeenCalled()
      expect(listPageAlerts.mock.calls.at(-1)?.[0]).toBe("p_1")
    })
  })
})
