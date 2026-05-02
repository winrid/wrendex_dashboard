// Smoke test for the regression strip. Mocks the typed client at the
// useApiClient boundary. Asserts:
//   1. With a previousCrawlId set, getCrawlDiff is called and the three
//      tiles (new / resolved / persisted) render with their counts.
//   2. With previousCrawlId=null the component returns null and renders
//      nothing.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Alert, CrawlDiff } from "@/api/types"

const getCrawlDiff = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getCrawlDiff,
  }),
}))

import { RegressionStrip } from "../RegressionStrip"

function makeAlert(id: string): Alert {
  return {
    id,
    pageId: "p_1",
    siteId: "s_1",
    crawlRunId: "c_1",
    pageUrl: "https://acme.example/",
    type: "TITLE_MISSING",
    severity: "ERROR",
    message: "missing",
    detail: null,
    createdAt: "2026-04-30T00:00:00Z",
    status: "OPEN",
    lastSeenAt: "2026-04-30T00:00:00Z",
    resolvedAt: null,
    expiresAt: null,
    affectedUrls: null,
  }
}

function renderStrip(previousCrawlId: string | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RegressionStrip
          tenantId="t_1"
          siteId="s_1"
          crawlId="c_2"
          previousCrawlId={previousCrawlId}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("RegressionStrip", () => {
  afterEach(() => {
    cleanup()
    getCrawlDiff.mockReset()
  })

  it("fetches the diff and renders three tiles when a previous crawl exists", async () => {
    const diff: CrawlDiff = {
      new: [makeAlert("a"), makeAlert("b")],
      resolved: [makeAlert("c")],
      persisted: [makeAlert("d"), makeAlert("e"), makeAlert("f")],
      newTruncated: false,
      resolvedTruncated: false,
      persistedTruncated: false,
    }
    getCrawlDiff.mockResolvedValue(diff)

    renderStrip("c_1")

    await waitFor(() => {
      expect(getCrawlDiff).toHaveBeenCalled()
    })
    expect(getCrawlDiff.mock.calls[0]?.[0]).toBe("c_2")
    expect(getCrawlDiff.mock.calls[0]?.[1]).toEqual({ against: "c_1" })

    await waitFor(() => {
      expect(screen.getByText("New errors")).toBeTruthy()
    })
    expect(screen.getByText("Resolved")).toBeTruthy()
    expect(screen.getByText("Persisted")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
    expect(screen.getByText("1")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
  })

  it("renders nothing when there is no previous crawl", () => {
    const { container } = renderStrip(null)
    expect(getCrawlDiff).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })
})
