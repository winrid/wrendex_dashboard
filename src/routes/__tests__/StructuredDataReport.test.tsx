// Smoke tests for the Structured Data report (R.07). Mocks
// getStructuredData + listCrawlAlerts at the useApiClient boundary.
// Asserts:
//   1. The "With errors" filter narrows the entries to those with
//      JSON_LD_* / JSON_LD_GOOGLE_* error alerts.
//   2. The route does not crash on an empty payload.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  Alert,
  AlertQueryResult,
  StructuredDataResult,
} from "@/api/types"

const getStructuredData = vi.fn()
const listCrawlAlerts = vi.fn()
const getPageByUrl = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getStructuredData,
    listCrawlAlerts,
    getPageByUrl,
  }),
}))

import { StructuredDataReport } from "../StructuredDataReport"

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
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/structured-data"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/structured-data"
            element={<StructuredDataReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("StructuredDataReport", () => {
  afterEach(() => {
    cleanup()
    getStructuredData.mockReset()
    listCrawlAlerts.mockReset()
    getPageByUrl.mockReset()
  })

  it("filters entries when 'With errors' is selected", async () => {
    const sd: StructuredDataResult = {
      entries: [
        {
          url: "https://acme.example/clean",
          scriptCount: 1,
          types: ["Organization"],
        },
        {
          url: "https://acme.example/broken",
          scriptCount: 1,
          types: ["Article"],
        },
      ],
      totalPagesWithStructuredData: 2,
      totalScripts: 2,
      typeCounts: { Organization: 1, Article: 1 },
    }
    const errorAlert: Alert = {
      id: "a_1",
      pageId: "p_1",
      siteId: "s_1",
      crawlRunId: "c_1",
      pageUrl: "https://acme.example/broken",
      type: "JSON_LD_PARSE_ERROR",
      severity: "ERROR",
      message: "Could not parse JSON-LD",
      createdAt: "2026-04-30T00:00:00Z",
      status: "OPEN",
    }
    const alerts: AlertQueryResult = {
      items: [errorAlert],
      total: 1,
      page: 0,
      size: 500,
    }
    getStructuredData.mockResolvedValue(sd)
    listCrawlAlerts.mockResolvedValue(alerts)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("https://acme.example/clean")).toBeTruthy()
    })
    expect(screen.getByText("https://acme.example/broken")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "With errors" }))

    await waitFor(() => {
      expect(screen.queryByText("https://acme.example/clean")).toBeNull()
    })
    expect(screen.getByText("https://acme.example/broken")).toBeTruthy()
  })

  it("does not crash on an empty payload", async () => {
    getStructuredData.mockResolvedValue({
      entries: [],
      totalPagesWithStructuredData: 0,
      totalScripts: 0,
      typeCounts: {},
    })
    listCrawlAlerts.mockResolvedValue({
      items: [],
      total: 0,
      page: 0,
      size: 500,
    })

    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByText(/No JSON-LD captured in this crawl yet/),
      ).toBeTruthy()
    })
  })
})
