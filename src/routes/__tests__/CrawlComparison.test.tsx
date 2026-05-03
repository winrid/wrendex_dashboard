// Smoke test for the crawl comparison view (plan section 4A.4). Mocks the
// typed-client methods at the useApiClient boundary; asserts that the three
// alert sections render and the CSV export button is wired.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  Alert,
  CrawlDiff,
  CrawlRun,
  IssuesSummary,
} from "@/api/types"

const listCrawlsBySite = vi.fn()
const getIssuesSummary = vi.fn()
const getCrawlDiff = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listCrawlsBySite,
    getIssuesSummary,
    getCrawlDiff,
  }),
}))

import { CrawlComparison } from "../CrawlComparison"

function makeRun(id: string, score: number): CrawlRun {
  return {
    id,
    siteId: "s_1",
    startedAt: "2026-04-01T00:00:00Z",
    finishedAt: "2026-04-01T00:05:00Z",
    status: "completed",
    pagesDiscovered: 100,
    pagesCrawled: 100,
    healthScore: score,
    errorCount: 5,
    warningCount: 2,
    noticeCount: 1,
  }
}

function makeAlert(id: string, type: string): Alert {
  return {
    id,
    pageId: null,
    siteId: "s_1",
    crawlRunId: "c_b",
    pageUrl: `https://acme.example/${id}`,
    type: type as Alert["type"],
    severity: "ERROR",
    message: "boom",
    detail: null,
    createdAt: "2026-04-01T00:00:00Z",
    status: "OPEN",
    lastSeenAt: null,
    resolvedAt: null,
    expiresAt: null,
    affectedUrls: null,
  }
}

function makeSummary(): IssuesSummary {
  return {
    totalIssues: 3,
    bySeverity: { ERROR: 2, WARNING: 1 },
    byCategory: [
      {
        category: "Title",
        errorCount: 2,
        warningCount: 0,
        noticeCount: 0,
        byType: {},
      },
    ],
  }
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
        initialEntries={["/t/t_1/sites/s_1/compare?a=c_a&b=c_b"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/compare"
            element={<CrawlComparison />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("CrawlComparison", () => {
  afterEach(() => {
    cleanup()
    listCrawlsBySite.mockReset()
    getIssuesSummary.mockReset()
    getCrawlDiff.mockReset()
  })

  it("renders before / after / delta header, category delta card, and the alert sections, with a CSV export button", async () => {
    listCrawlsBySite.mockResolvedValue([
      makeRun("c_a", 80),
      makeRun("c_b", 90),
    ])
    getIssuesSummary.mockResolvedValue(makeSummary())
    const diff: CrawlDiff = {
      new: [makeAlert("a1", "TITLE_MISSING")],
      resolved: [makeAlert("a2", "H1_MISSING")],
      persisted: [makeAlert("a3", "META_DESCRIPTION_MISSING")],
      newTruncated: false,
      resolvedTruncated: false,
      persistedTruncated: false,
    }
    getCrawlDiff.mockResolvedValue(diff)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("comparison-header")).toBeTruthy()
    })
    expect(screen.getByTestId("comparison-delta")).toBeTruthy()
    expect(screen.getByTestId("category-delta-card")).toBeTruthy()
    expect(screen.getByTestId("diff-tab-new")).toBeTruthy()
    expect(screen.getByTestId("csv-export-button")).toBeTruthy()
    // CrawlDiff was hit with b=c_b against=c_a.
    expect(getCrawlDiff).toHaveBeenCalledWith("c_b", { against: "c_a" })
  })
})
