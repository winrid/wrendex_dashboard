// Smoke tests for the Site Structure Map (R.04). Mocks getStructure and
// listCrawlAlerts at the useApiClient boundary. Asserts:
//   1. The directory tree renders with expected segments.
//   2. Clicking a leaf URL navigates to the Page Explorer for the crawl.
//   3. The route does not crash on an empty payload.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AlertQueryResult, DirectoryNode } from "@/api/types"

const getStructure = vi.fn()
const listCrawlAlerts = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getStructure,
    listCrawlAlerts,
  }),
}))

import { StructureMap } from "../StructureMap"

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
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
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/structure"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/structure"
            element={
              <>
                <StructureMap />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/pages"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const EMPTY_ALERTS: AlertQueryResult = {
  items: [],
  total: 0,
  page: 0,
  size: 200,
}

describe("StructureMap", () => {
  afterEach(() => {
    cleanup()
    getStructure.mockReset()
    listCrawlAlerts.mockReset()
  })

  it("renders the tree and navigates to Page Explorer on leaf click", async () => {
    const nodes: DirectoryNode[] = [
      {
        path: "/",
        pageCount: 1,
        avgResponseTimeMs: 100,
        avgWordCount: 200,
        statusCodeCounts: { "200": 1 },
      },
      {
        path: "/blog/",
        pageCount: 1,
        avgResponseTimeMs: 110,
        avgWordCount: 250,
        statusCodeCounts: { "200": 1 },
      },
    ]
    getStructure.mockResolvedValue(nodes)
    listCrawlAlerts.mockResolvedValue(EMPTY_ALERTS)

    renderRoute()

    const leafLink = await screen.findByRole("link", { name: /^blog\/$/ })
    expect(leafLink).toBeTruthy()

    fireEvent.click(leafLink)

    await waitFor(() => {
      const probe = screen.getByTestId("location")
      expect(probe.textContent).toBe(
        "/t/t_1/sites/s_1/crawls/c_1/pages",
      )
    })
  })

  it("renders the empty state on an empty payload", async () => {
    getStructure.mockResolvedValue([])
    listCrawlAlerts.mockResolvedValue(EMPTY_ALERTS)

    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByText(
          /No directories captured for this crawl yet/,
        ),
      ).toBeTruthy()
    })
  })
})
