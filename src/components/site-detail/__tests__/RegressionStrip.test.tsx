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
  } as unknown as Alert
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
      skipped: [],
      newCount: 2,
      resolvedCount: 1,
      persistedCount: 3,
      skippedCount: 0,
      newTruncated: false,
      resolvedTruncated: false,
      persistedTruncated: false,
      skippedTruncated: false,
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

  it("renders the true count when the array was capped but the count is higher", async () => {
    // BE caps each array at DIFF_MAX (200) but ships the true total in the
    // *Count fields. We render the count, not the array length.
    const diff: CrawlDiff = {
      new: Array.from({ length: 200 }, (_, i) => makeAlert(`n_${i}`)),
      resolved: [],
      persisted: [],
      skipped: [],
      newCount: 982,
      resolvedCount: 0,
      persistedCount: 0,
      skippedCount: 0,
      newTruncated: true,
      resolvedTruncated: false,
      persistedTruncated: false,
      skippedTruncated: false,
    }
    getCrawlDiff.mockResolvedValue(diff)

    renderStrip("c_1")

    await waitFor(() => {
      expect(screen.getByText("982")).toBeTruthy()
    })
    expect(screen.getByText("+more")).toBeTruthy()
  })

  it("surfaces skipped alerts under the strip when present", async () => {
    const diff: CrawlDiff = {
      new: [],
      resolved: [],
      persisted: [],
      skipped: [makeAlert("s1")],
      newCount: 0,
      resolvedCount: 0,
      persistedCount: 0,
      skippedCount: 952,
      newTruncated: false,
      resolvedTruncated: false,
      persistedTruncated: false,
      skippedTruncated: true,
    }
    getCrawlDiff.mockResolvedValue(diff)

    renderStrip("c_1")

    const skipped = await screen.findByTestId("regression-strip-skipped")
    expect(skipped.textContent).toMatch(/952 alerts on URLs not re-tested/)
  })

  it("hides the skipped line when skippedCount is zero", async () => {
    const diff: CrawlDiff = {
      new: [makeAlert("a")],
      resolved: [],
      persisted: [],
      skipped: [],
      newCount: 1,
      resolvedCount: 0,
      persistedCount: 0,
      skippedCount: 0,
      newTruncated: false,
      resolvedTruncated: false,
      persistedTruncated: false,
      skippedTruncated: false,
    }
    getCrawlDiff.mockResolvedValue(diff)

    renderStrip("c_1")
    await screen.findByText("New errors")
    expect(screen.queryByTestId("regression-strip-skipped")).toBeNull()
  })

  it("renders nothing when there is no previous crawl", () => {
    const { container } = renderStrip(null)
    expect(getCrawlDiff).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })
})
