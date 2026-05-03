// Smoke test for the Health Score History route. Mocks the typed client at
// the useApiClient boundary. Asserts:
//   1. The chart container + per-crawl DataTable both render when
//      getHealthScore returns data.
//   2. The page still renders cleanly when only a single crawl point is
//      returned by the health-score endpoint.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HealthScorePoint, Site } from "@/api/types"

// Recharts uses ResponsiveContainer which measures the parent box; jsdom
// reports zero. We mock ResponsiveContainer to a fixed-size wrapper so the
// chart actually renders during tests. Only ResponsiveContainer is
// overridden; the rest of recharts is left untouched.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }) => (
      <div style={{ width: 600, height: 300 }} data-testid="rc-fixed">
        {children}
      </div>
    ),
  }
})

beforeAll(() => {
  // Recharts also needs getBoundingClientRect to be sensible; jsdom returns
  // zeros by default which trips the chart's domain calculation.
  if (
    typeof Element !== "undefined" &&
    !("__bbcrPatched" in Element.prototype)
  ) {
    Object.defineProperty(Element.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        width: 600,
        height: 300,
        top: 0,
        left: 0,
        right: 600,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    Object.defineProperty(Element.prototype, "__bbcrPatched", {
      value: true,
    })
  }
})

const getHealthScore = vi.fn()
const getSite = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getHealthScore,
    getSite,
  }),
}))

import { HealthHistory } from "../HealthHistory"
import React from "react"

function makePoint(
  crawlRunId: string,
  startedAt: string,
  healthScore: number,
  errorCount = 0,
  warningCount = 0,
  noticeCount = 0,
): HealthScorePoint {
  return {
    crawlRunId,
    startedAt,
    finishedAt: startedAt,
    healthScore,
    errorCount,
    warningCount,
    noticeCount,
  }
}

function makeSite(): Site {
  return {
    id: "s_1",
    tenantId: "t_1",
    url: "https://acme.example",
    createdAt: "2026-04-01T00:00:00Z",
    lastCrawlAt: "2026-04-30T00:00:00Z",
  } as unknown as Site
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
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/health-history"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/health-history"
            element={<HealthHistory />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("HealthHistory", () => {
  afterEach(() => {
    cleanup()
    getHealthScore.mockReset()
    getSite.mockReset()
  })

  it("renders the chart container + DataTable when data loads", async () => {
    // Use timestamps within the last 90 days so they pass the default
    // window filter.
    const now = Date.now()
    const t1 = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
    const t2 = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    getSite.mockResolvedValue(makeSite())
    getHealthScore.mockResolvedValue([
      makePoint("c_1", t1, 88, 5, 10, 20),
      makePoint("c_2", t2, 92, 2, 8, 18),
    ])

    renderRoute()

    await waitFor(() => {
      expect(getHealthScore).toHaveBeenCalledWith("s_1")
    })

    // Chart container is in the DOM.
    await waitFor(() => {
      expect(screen.getByTestId("health-history-chart")).toBeTruthy()
    })

    // DataTable headers + score cells render.
    await waitFor(() => {
      expect(screen.getByText("Score")).toBeTruthy()
    })
    expect(screen.getByText("Errors")).toBeTruthy()
    expect(screen.getByText("Warnings")).toBeTruthy()
    expect(screen.getByText("Notices")).toBeTruthy()
    expect(screen.getByText("88")).toBeTruthy()
    expect(screen.getByText("92")).toBeTruthy()
    // The "View" link is in the actions column for each row.
    expect(screen.getAllByText("View").length).toBe(2)
  })

  it("renders chart + table for a single crawl point", async () => {
    const now = Date.now()
    const t1 = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
    getSite.mockResolvedValue(makeSite())
    getHealthScore.mockResolvedValue([makePoint("c_1", t1, 90, 1, 2, 3)])

    renderRoute()

    // Chart still renders.
    await waitFor(() => {
      expect(screen.getByTestId("health-history-chart")).toBeTruthy()
    })
    // DataTable still renders.
    await waitFor(() => {
      expect(screen.getByText("90")).toBeTruthy()
    })
  })
})
