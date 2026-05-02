// Smoke test for the per-AlertType drill-in (plan section 4A.3). Mocks
// listCrawlAlerts and asserts the catalog description + how-to-fix render.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AlertQueryResult } from "@/api/types"

const listCrawlAlerts = vi.fn()
const ignoreAlert = vi.fn()
const unignoreAlert = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listCrawlAlerts,
    ignoreAlert,
    unignoreAlert,
  }),
}))

import { IssueTypeDetail } from "../IssueTypeDetail"
import { getCheck } from "@/api/checkCatalog"

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
        initialEntries={["/t/t_1/crawls/c_1/issues/type/TITLE_MISSING"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/crawls/:crawlId/issues/type/:alertType"
            element={<IssueTypeDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("IssueTypeDetail", () => {
  afterEach(() => {
    cleanup()
    listCrawlAlerts.mockReset()
    ignoreAlert.mockReset()
    unignoreAlert.mockReset()
  })

  it("renders the catalog description and how-to-fix", async () => {
    const result: AlertQueryResult = {
      items: [],
      total: 0,
      page: 0,
      size: 25,
    }
    listCrawlAlerts.mockResolvedValue(result)

    renderRoute()

    const entry = getCheck("TITLE_MISSING")!
    await waitFor(() => {
      expect(screen.getByText(entry.title)).toBeTruthy()
    })
    expect(screen.getByText(entry.description)).toBeTruthy()
    expect(screen.getByText(entry.howToFix)).toBeTruthy()
  })
})
