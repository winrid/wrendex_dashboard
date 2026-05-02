// Smoke test for the Redirects report. Mocks the typed client at the
// useApiClient boundary. Asserts the originating-pages popover trigger
// renders with the count and that opening it surfaces the URLs.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { RedirectsResult } from "@/api/types"

const getRedirects = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getRedirects,
  }),
}))

import { RedirectsReport } from "../RedirectsReport"

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
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/redirects"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/redirects"
            element={<RedirectsReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("RedirectsReport", () => {
  afterEach(() => {
    cleanup()
    getRedirects.mockReset()
  })

  it("renders the originating-pages popover with the URL list", async () => {
    const result: RedirectsResult = {
      entries: [
        {
          sourceUrl: "https://acme.example/old",
          finalUrl: "https://acme.example/new",
          statusCode: 200,
          chainLength: 1,
          hops: [],
          loop: false,
          hasMetaRefresh: false,
          originatingPages: [
            "https://acme.example/page-a",
            "https://acme.example/page-b",
          ],
        },
      ],
      totalChains: 1,
      totalLoops: 0,
    }
    getRedirects.mockResolvedValue(result)

    renderRoute()

    const trigger = await screen.findByRole("button", {
      name: /2 pages link here/,
    })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText("https://acme.example/page-a")).toBeTruthy()
    })
    expect(screen.getByText("https://acme.example/page-b")).toBeTruthy()
  })

  it("renders the empty state when no redirects are present", async () => {
    getRedirects.mockResolvedValue({
      entries: [],
      totalChains: 0,
      totalLoops: 0,
    })

    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByText(
          /No redirects found in this crawl - everything resolves directly/,
        ),
      ).toBeTruthy()
    })
  })
})
