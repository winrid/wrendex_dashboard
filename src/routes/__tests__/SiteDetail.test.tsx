// Smoke test for the SiteDetail overview. Mocks the typed client at the
// useApiClient module boundary so the route renders without network. Asserts
// the issue queue surfaces the categories returned by getIssuesSummary.

import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getSite = vi.fn()
const listCrawlsBySite = vi.fn()
const getHealthScore = vi.fn()
const getIssuesSummary = vi.fn()
const startCrawlAsync = vi.fn()
const requestSiteVerification = vi.fn()
const confirmSiteVerification = vi.fn()
const getCrawl = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getSite,
    listCrawlsBySite,
    getHealthScore,
    getIssuesSummary,
    startCrawlAsync,
    requestSiteVerification,
    confirmSiteVerification,
    getCrawl,
  }),
}))

import { SiteDetail } from "../SiteDetail"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1"]}>
        <Routes>
          <Route path="/t/:tenantId/sites/:siteId" element={<SiteDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("SiteDetail issue queue", () => {
  it("renders categories from getIssuesSummary", async () => {
    getSite.mockResolvedValue({
      id: "s_1",
      tenantId: "t_1",
      url: "https://acme.example",
      createdAt: "2026-04-30T00:00:00Z",
      lastCrawlAt: "2026-04-30T00:00:00Z",
      verifiedAt: "2026-04-30T00:00:00Z",
      cadence: "DAILY",
    })
    listCrawlsBySite.mockResolvedValue([
      {
        id: "c_1",
        siteId: "s_1",
        startedAt: "2026-04-30T00:00:00Z",
        finishedAt: "2026-04-30T00:01:00Z",
        status: "completed",
        pagesDiscovered: 10,
        pagesCrawled: 10,
        healthScore: 92,
        errorCount: 1,
        warningCount: 2,
        noticeCount: 3,
      },
    ])
    getHealthScore.mockResolvedValue([
      {
        crawlRunId: "c_1",
        startedAt: "2026-04-30T00:00:00Z",
        healthScore: 92,
        errorCount: 1,
        warningCount: 2,
        noticeCount: 3,
      },
    ])
    getIssuesSummary.mockResolvedValue({
      totalIssues: 6,
      bySeverity: { ERROR: 1, WARNING: 2, NOTICE: 3 },
      byCategory: [
        {
          category: "Title",
          errorCount: 1,
          warningCount: 0,
          noticeCount: 0,
          byType: { TITLE_MISSING: 1 },
        },
        {
          category: "Images",
          errorCount: 0,
          warningCount: 2,
          noticeCount: 0,
          byType: { MISSING_ALT_TEXT: 2 },
        },
      ],
    })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("acme.example")).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText("Title")).toBeTruthy()
      expect(screen.getByText("Images")).toBeTruthy()
    })
    expect(screen.getByText("Issues by category")).toBeTruthy()
  })
})
