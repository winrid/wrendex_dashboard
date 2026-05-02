// Smoke test for the crawl history page. Verifies the empty state when
// listCrawlLog returns []. We mock the API client at the module boundary
// so the route never hits the network.

import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const listCrawlLog = vi.fn()
const startCrawlAsync = vi.fn()
const getCrawl = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listCrawlLog,
    startCrawlAsync,
    getCrawl,
  }),
}))

import { CrawlHistory } from "../CrawlHistory"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/crawls"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls"
            element={<CrawlHistory />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("CrawlHistory empty state", () => {
  it("renders the empty state when listCrawlLog returns []", async () => {
    listCrawlLog.mockResolvedValue([])
    renderRoute()
    await waitFor(() => {
      expect(
        screen.getByText("No crawls have run for this site yet."),
      ).toBeTruthy()
    })
    expect(
      screen.getByRole("button", { name: /Run your first audit/ }),
    ).toBeTruthy()
  })
})
