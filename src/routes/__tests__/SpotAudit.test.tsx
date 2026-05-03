// SpotAudit form: textarea is split on newlines; submit calls
// startSpotAudit; >1000 URLs is rejected client-side.

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
import type { Site } from "@/api/types"

const startSpotAudit = vi.fn()
const getSite = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    startSpotAudit,
    getSite,
  }),
}))

import { SpotAudit, partitionUrls } from "../SpotAudit"

const SITE = {
  id: "s_1",
  tenantId: "t_1",
  url: "https://acme.example",
  createdAt: "2026-04-30T00:00:00Z",
  lastCrawlAt: null,
} as unknown as Site

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/spot-audit"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/spot-audit"
            element={<SpotAudit />}
          />
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId"
            element={<div data-testid="crawl-detail-stub">crawl detail</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("SpotAudit", () => {
  afterEach(() => {
    cleanup()
    startSpotAudit.mockReset()
    getSite.mockReset()
  })

  it("splits the textarea on newlines and POSTs the URL list to startSpotAudit", async () => {
    getSite.mockResolvedValue(SITE)
    startSpotAudit.mockResolvedValue({
      id: "cr_1",
      siteId: "s_1",
      startedAt: "2026-05-03T00:00:00Z",
      status: "queued",
      pagesDiscovered: 0,
      pagesCrawled: 0,
      healthScore: 0,
      errorCount: 0,
      warningCount: 0,
      noticeCount: 0,
      origin: "spot-audit",
      seedUrls: [
        "https://acme.example/one",
        "https://acme.example/two",
        "https://acme.example/three",
      ],
    })

    renderRoute()

    // Wait for the site query to land so the hostname-validation banner is
    // wired up before we type into the textarea.
    await waitFor(() => {
      expect(getSite).toHaveBeenCalled()
    })

    const ta = screen.getByTestId("spot-audit-textarea") as HTMLTextAreaElement
    fireEvent.change(ta, {
      target: {
        value:
          "https://acme.example/one\nhttps://acme.example/two\n\nhttps://acme.example/three\n",
      },
    })

    expect(screen.getByTestId("spot-audit-count").textContent).toContain("3 URLs")

    fireEvent.click(screen.getByTestId("spot-audit-submit"))

    await waitFor(() => {
      expect(startSpotAudit).toHaveBeenCalledTimes(1)
    })

    const [siteId, body] = startSpotAudit.mock.calls[0]
    expect(siteId).toBe("s_1")
    expect(body).toEqual({
      urls: [
        "https://acme.example/one",
        "https://acme.example/two",
        "https://acme.example/three",
      ],
    })

    // Successful 202 navigates to the queued crawl detail page.
    await waitFor(() => {
      expect(screen.getByTestId("crawl-detail-stub")).toBeTruthy()
    })
  })

  it("rejects more than 1000 URLs client-side without calling startSpotAudit", async () => {
    getSite.mockResolvedValue(SITE)

    renderRoute()
    await waitFor(() => {
      expect(getSite).toHaveBeenCalled()
    })

    const lines: string[] = []
    for (let i = 0; i < 1001; i++) {
      lines.push(`https://acme.example/page-${i}`)
    }
    const ta = screen.getByTestId("spot-audit-textarea") as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: lines.join("\n") } })

    const count = screen.getByTestId("spot-audit-count")
    expect(count.textContent).toContain("1001")
    expect(count.textContent).toContain(`max 1000`)

    const submit = screen.getByTestId("spot-audit-submit") as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.click(submit)
    expect(startSpotAudit).not.toHaveBeenCalled()
  })

  it("flags off-site hostnames as a warning (not blocking)", () => {
    const part = partitionUrls(
      [
        "https://acme.example/a",
        "https://other.example/b",
        "not a url",
      ],
      "acme.example",
    )
    expect(part.invalid).toEqual(["not a url"])
    expect(part.offSite).toEqual(["https://other.example/b"])
  })
})
