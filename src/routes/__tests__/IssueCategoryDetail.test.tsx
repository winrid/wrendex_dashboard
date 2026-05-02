// Smoke test for the per-category drill-in (plan section 4A.2). Mocks the
// typed client and asserts the header shows the totals from
// IssuesSummary.byCategory and that rows in the category render through
// the AlertsTable.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AlertQueryResult, IssuesSummary } from "@/api/types"

const getIssuesSummary = vi.fn()
const listCrawlAlerts = vi.fn()
const ignoreAlert = vi.fn()
const unignoreAlert = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getIssuesSummary,
    listCrawlAlerts,
    ignoreAlert,
    unignoreAlert,
  }),
}))

import { IssueCategoryDetail } from "../IssueCategoryDetail"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/crawls/c_1/issues/category/Title"]}>
        <Routes>
          <Route
            path="/t/:tenantId/crawls/:crawlId/issues/category/:categoryId"
            element={<IssueCategoryDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("IssueCategoryDetail", () => {
  afterEach(() => {
    cleanup()
    getIssuesSummary.mockReset()
    listCrawlAlerts.mockReset()
    ignoreAlert.mockReset()
    unignoreAlert.mockReset()
  })

  it("renders the total count from IssuesSummary and matching rows", async () => {
    const summary: IssuesSummary = {
      totalIssues: 5,
      bySeverity: { ERROR: 3, WARNING: 2 },
      byCategory: [
        {
          category: "Title",
          errorCount: 3,
          warningCount: 2,
          noticeCount: 0,
          byType: { TITLE_MISSING: 3, TITLE_TOO_LONG: 2 },
        },
      ],
    }
    getIssuesSummary.mockResolvedValue(summary)
    const result: AlertQueryResult = {
      items: [
        {
          id: "a_1",
          pageId: "p_1",
          siteId: "s_1",
          crawlRunId: "c_1",
          pageUrl: "https://acme.example/a",
          type: "TITLE_MISSING",
          severity: "ERROR",
          message: "No title",
          detail: null,
          createdAt: "2026-04-30T00:00:00Z",
          status: "OPEN",
          lastSeenAt: "2026-04-30T00:00:00Z",
          resolvedAt: null,
          expiresAt: null,
          affectedUrls: null,
        },
        // An alert from a different category - filtered out client-side.
        {
          id: "a_2",
          pageId: "p_2",
          siteId: "s_1",
          crawlRunId: "c_1",
          pageUrl: "https://acme.example/b",
          type: "MISSING_ALT_TEXT",
          severity: "WARNING",
          message: "No alt",
          detail: null,
          createdAt: "2026-04-30T00:00:00Z",
          status: "OPEN",
          lastSeenAt: "2026-04-30T00:00:00Z",
          resolvedAt: null,
          expiresAt: null,
          affectedUrls: null,
        },
      ],
      total: 2,
      page: 0,
      size: 50,
    }
    listCrawlAlerts.mockResolvedValue(result)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy()
    })
    // Header total = 3+2+0 = 5
    await waitFor(() => {
      expect(screen.getByText("5 total")).toBeTruthy()
    })

    // Row from the Title category renders inside the table body.
    await waitFor(() => {
      const table = screen.getByRole("table")
      expect(within(table).getByText("Page title missing")).toBeTruthy()
    })
    // The Images row is filtered out client-side.
    expect(screen.queryByText("Missing alt text")).toBeNull()
  })
})
