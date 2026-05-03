// CommandPalette (P4 iter 3 BE-C):
//   1. Typing a query fires a debounced client.search call with
//      {q, tenantId, limit: 20}.
//   2. Clicking a returned result navigates to the result's route + closes
//      the palette.
//
// We intentionally avoid vi.useFakeTimers here because cmdk's internal
// store wires up subscriptions during its first render and the fake-timer
// monkey-patching causes "Cannot read properties of undefined (reading
// 'subscribe')" inside the cmdk dist bundle. Real timers + a generous
// waitFor (debounce is 200ms) is the simplest way to keep both happy.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const search = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    search,
  }),
}))

import { CommandPalette } from "@/components/layout/CommandPalette"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  search.mockReset()
})

function renderPalette() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId"
            element={<div data-testid="site-detail">SITE_DETAIL</div>}
          />
          <Route
            path="/t/:tenantId/*"
            element={
              <>
                <CommandPalette />
                <div data-testid="route-content">SITES</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function openPalette() {
  // The palette is hidden until cmd+k. The CommandDialog wraps the input in
  // a Dialog which only mounts when open=true; the cleanest way to flip it
  // is dispatching the keydown the component listens for.
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    )
  })
}

describe("CommandPalette - search wiring", () => {
  it("calls client.search with the typed query (debounced) and the route tenantId", async () => {
    search.mockResolvedValue([
      {
        kind: "site",
        id: "s_1",
        title: "acme.example",
        snippet: "https://acme.example",
        route: "/t/t_1/sites/s_1",
      },
    ])

    renderPalette()
    openPalette()

    const input = await screen.findByPlaceholderText(
      /Search sites, pages, alerts, checks/i,
    )
    fireEvent.change(input, { target: { value: "acme" } })

    // Real-time debounce window is 200ms; waitFor polls until search is
    // called or the default 1s timeout expires.
    await waitFor(() => {
      expect(search).toHaveBeenCalled()
    })
    const call = search.mock.calls[search.mock.calls.length - 1]
    expect(call[0]).toEqual({
      q: "acme",
      tenantId: "t_1",
      limit: 20,
    })
  })

  it("forwards the URL :siteId as activeSiteId and renders the truncated footer when set", async () => {
    search.mockResolvedValue({
      items: [
        {
          kind: "site",
          id: "s_1",
          title: "acme.example",
          snippet: "https://acme.example",
          route: "/t/t_1/sites/s_1",
        },
      ],
      truncated: true,
    })

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/t/t_1/sites/s_99/pages"]}>
          <Routes>
            <Route
              path="/t/:tenantId/sites/:siteId/*"
              element={
                <>
                  <CommandPalette />
                  <div data-testid="route-content">PAGES</div>
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    openPalette()

    const input = await screen.findByPlaceholderText(
      /Search sites, pages, alerts, checks/i,
    )
    fireEvent.change(input, { target: { value: "acme" } })

    await waitFor(() => {
      expect(search).toHaveBeenCalled()
    })
    const call = search.mock.calls[search.mock.calls.length - 1]
    expect(call[0]).toEqual({
      q: "acme",
      tenantId: "t_1",
      limit: 20,
      activeSiteId: "s_99",
    })

    // The truncated footer renders inside the palette.
    const footer = await screen.findByTestId(
      "cmdk-truncated-footer",
      {},
      { timeout: 2000 },
    )
    expect(footer.textContent ?? "").toMatch(/most recently crawled sites/i)
  })

  it("navigates to the clicked result's route and closes the palette", async () => {
    search.mockResolvedValue([
      {
        kind: "site",
        id: "s_99",
        title: "example.com",
        snippet: "https://example.com",
        route: "/t/t_1/sites/s_99",
      },
    ])

    renderPalette()
    openPalette()

    const input = await screen.findByPlaceholderText(
      /Search sites, pages, alerts, checks/i,
    )
    fireEvent.change(input, { target: { value: "example" } })

    const item = await screen.findByTestId(
      "cmdk-result-site-s_99",
      {},
      { timeout: 2000 },
    )
    await act(async () => {
      fireEvent.click(item)
    })

    // The MemoryRouter rendered the matching SiteDetail stub.
    await waitFor(() => {
      expect(screen.getByTestId("site-detail")).toBeTruthy()
    })
  })
})
