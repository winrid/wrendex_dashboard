// Smoke test for the anonymous-crawl teaser page. Mocks
// getAnonymousCrawl to return a "completed" payload and asserts all
// category rows render together with the trial CTA.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AnonymousCrawlSummary } from "@/api/types"

const getAnonymousCrawl = vi.fn()
const requestEmailedSummary = vi.fn()
const sendTelemetry = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getAnonymousCrawl,
    requestEmailedSummary,
    sendTelemetry,
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
  afterEach(() => {
    cleanup()
    getAnonymousCrawl.mockReset()
  })

  it("renders every issue category and the trial CTA when the crawl is completed", async () => {
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
        duplicateCodeStats: null,
      },
      isClaimed: false,
      claimedByTenantId: null,
      expiresAt: "2026-05-09T00:00:00Z",
      startedAt: "2026-05-02T12:00:00Z",
      finishedAt: "2026-05-02T12:01:30Z",
      lastScrapedPage: null,
      postProcessingProgress: null,
    }
    getAnonymousCrawl.mockResolvedValue(summary)

    renderRoute("tok-abc")

    await waitFor(() => {
      expect(screen.getByText("Issue Categories")).toBeTruthy()
    })

    // All categories from the response show through.
    expect(screen.getByText("Title")).toBeTruthy()
    expect(screen.getByText("Meta description")).toBeTruthy()
    expect(screen.getByText("Headings")).toBeTruthy()

    // The locked-categories teaser is gone.
    expect(screen.queryByTestId("locked-categories")).toBeNull()

    // The CTA is present.
    expect(
      screen.getByText(/Start 14 day trial/i),
    ).toBeTruthy()
  })

  it("renders duplicate-code per-language stats on the Duplicate Code row", async () => {
    const summary: AnonymousCrawlSummary = {
      token: "tok-dc",
      url: "https://dup.example",
      status: "completed",
      crawlRunId: "c_dc",
      healthScore: 65,
      pagesCrawled: 10,
      pagesDiscovered: 10,
      issuesSummary: {
        totalIssues: 4,
        bySeverity: { WARNING: 4 },
        byCategory: [
          {
            category: "Duplicate Code",
            errorCount: 0,
            warningCount: 4,
            noticeCount: 0,
            byType: { DUPLICATE_JS_CODE: 3, DUPLICATE_CSS_CODE: 1 },
          },
        ],
        duplicateCodeStats: {
          js: {
            alertCount: 3,
            totalTokens: 900,
            avgTokens: 300,
            maxTokens: 500,
          },
          css: {
            alertCount: 1,
            totalTokens: 100,
            avgTokens: 100,
            maxTokens: 100,
          },
        },
      },
      isClaimed: false,
      claimedByTenantId: null,
      expiresAt: "2026-06-01T00:00:00Z",
      startedAt: "2026-05-25T12:00:00Z",
      finishedAt: "2026-05-25T12:01:30Z",
      lastScrapedPage: null,
      postProcessingProgress: null,
    }
    getAnonymousCrawl.mockResolvedValue(summary)

    renderRoute("tok-dc")

    await waitFor(() => {
      expect(screen.getByText("Duplicate Code")).toBeTruthy()
    })

    // JS and CSS labels render under the Duplicate Code row.
    expect(screen.getByText("JS")).toBeTruthy()
    expect(screen.getByText("CSS")).toBeTruthy()
    // Three Total / Avg / Max labels per visible language.
    expect(screen.getAllByText(/Total/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Avg/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Max/).length).toBeGreaterThanOrEqual(2)
  })

  it("hides duplicate-code stats block when stats are null", async () => {
    const summary: AnonymousCrawlSummary = {
      token: "tok-no-dc",
      url: "https://nope.example",
      status: "completed",
      crawlRunId: "c_nodc",
      healthScore: 80,
      pagesCrawled: 5,
      pagesDiscovered: 5,
      issuesSummary: {
        totalIssues: 1,
        bySeverity: { ERROR: 1 },
        byCategory: [
          {
            category: "Title",
            errorCount: 1,
            warningCount: 0,
            noticeCount: 0,
            byType: { TITLE_MISSING: 1 },
          },
        ],
        duplicateCodeStats: null,
      },
      isClaimed: false,
      claimedByTenantId: null,
      expiresAt: "2026-06-01T00:00:00Z",
      startedAt: "2026-05-25T12:00:00Z",
      finishedAt: "2026-05-25T12:01:30Z",
      lastScrapedPage: null,
      postProcessingProgress: null,
    }
    getAnonymousCrawl.mockResolvedValue(summary)

    renderRoute("tok-no-dc")

    await waitFor(() => {
      expect(screen.getByText("Title")).toBeTruthy()
    })

    // No Duplicate Code micro-stats block (no JS/CSS labels in the
    // Duplicate Code position).
    expect(screen.queryByText("Duplicate Code")).toBeNull()
    expect(screen.queryByText("JS")).toBeNull()
  })
})
