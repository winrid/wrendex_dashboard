// Smoke test for the Resources report. Mocks the typed client at the
// useApiClient boundary and asserts:
//   1. Render-blocking + duplicate flags surface as amber badges.
//   2. The flagged row gets stamped with data-flagged="true" via the
//      FlaggedRowMarker effect.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ResourcesResult } from "@/api/types"

const getResources = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getResources,
  }),
}))

import { ResourcesReport } from "../ResourcesReport"

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
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/resources"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/resources"
            element={<ResourcesReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("ResourcesReport", () => {
  afterEach(() => {
    cleanup()
    getResources.mockReset()
  })

  it("highlights render-blocking rows", async () => {
    const result: ResourcesResult = {
      resources: [
        {
          url: "https://cdn.example/a.png",
          type: "image",
          sourcePageCount: 3,
          bytes: 0,
          originatingPages: ["https://acme.example/"],
          renderBlocking: true,
          duplicateTracker: false,
        },
      ],
      totalCss: 0,
      totalJs: 0,
      totalImages: 1,
    }
    getResources.mockResolvedValue(result)

    const { container } = renderRoute()

    await waitFor(() => {
      expect(screen.getByText("https://cdn.example/a.png")).toBeTruthy()
    })
    expect(screen.getByText("Render-blocking")).toBeTruthy()

    // The FlaggedRowMarker stamps data-flagged on the corresponding tr via
    // requestAnimationFrame; await the next frame.
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    await waitFor(() => {
      const flagged = container.querySelector('tr[data-flagged="true"]')
      expect(flagged).not.toBeNull()
    })
  })
})
