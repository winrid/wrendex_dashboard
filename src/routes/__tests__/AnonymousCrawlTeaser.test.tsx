// Smoke test for the anonymous-crawl teaser page. Mocks
// getAnonymousCrawl to return a "completed" payload and asserts the
// locked categories list renders.

import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AnonymousCrawlSummary } from "@/api/types"

const getAnonymousCrawl = vi.fn()
const requestEmailedSummary = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getAnonymousCrawl,
    requestEmailedSummary,
  }),
}))

import { AnonymousCrawlTeaser } from "../AnonymousCrawlTeaser"

function renderRoute(token: string) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/a/${token}`]}>
        <Routes>
          <Route path="/a/:token" element={<AnonymousCrawlTeaser />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("AnonymousCrawlTeaser", () => {
  it("renders the locked categories list when the crawl is completed", async () => {
    const summary: AnonymousCrawlSummary = {
      token: "tok-abc",
      url: "https://acme.example",
      status: "completed",
      crawlRunId: "c_1",
      healthScore: 78,
      pagesCrawled: 42,
      pagesDiscovered: 50,
      issuesSummary: {
        totalIssues: 9,
        bySeverity: { ERROR: 2, WARNING: 5, NOTICE: 2 },
        byCategory: [
          {
            category: "Title",
            errorCount: 2,
            warningCount: 0,
            noticeCount: 0,
            byType: { TITLE_MISSING: 2 },
          },
          {
            category: "Meta description",
            errorCount: 0,
            warningCount: 4,
            noticeCount: 0,
            byType: { META_DESCRIPTION_TOO_LONG: 4 },
          },
          {
            category: "Headings",
            errorCount: 0,
            warningCount: 1,
            noticeCount: 2,
            byType: { H1_MISSING: 1 },
          },
        ],
      },
      isClaimed: false,
      claimedByTenantId: null,
      expiresAt: "2026-05-09T00:00:00Z",
    }
    getAnonymousCrawl.mockResolvedValue(summary)

    renderRoute("tok-abc")

    await waitFor(() => {
      expect(screen.getByText("Top issue categories")).toBeTruthy()
    })

    // The 3 visible categories show through
    expect(screen.getByText("Title")).toBeTruthy()
    expect(screen.getByText("Meta description")).toBeTruthy()
    expect(screen.getByText("Headings")).toBeTruthy()

    // The locked-categories list renders below; it should contain at
    // least one entry that's NOT in the visible categories above.
    const locked = screen.getByTestId("locked-categories")
    expect(locked).toBeTruthy()
    expect(locked.textContent).toMatch(/Performance|Internal links|Indexability/)
    expect(
      locked.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0)

    // The CTA is present.
    expect(
      screen.getByText(/Start 14 day trial/i),
    ).toBeTruthy()
  })
})
