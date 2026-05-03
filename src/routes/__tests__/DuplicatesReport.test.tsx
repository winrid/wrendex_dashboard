// Smoke tests for the Duplicate Content report (R.06). Mocks
// getDuplicates and asserts:
//   1. Tab switching filters the loaded clusters by `field`.
//   2. The empty state renders per-tab when no groups match.
//   3. The route does not crash on an empty payload.

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
import type { DuplicatesResult } from "@/api/types"

const getDuplicates = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getDuplicates,
  }),
}))

import { DuplicatesReport } from "../DuplicatesReport"

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
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/duplicates"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/duplicates"
            element={<DuplicatesReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("DuplicatesReport", () => {
  afterEach(() => {
    cleanup()
    getDuplicates.mockReset()
  })

  it("filters clusters when switching tabs", async () => {
    const result: DuplicatesResult = {
      groups: [
        {
          hash: null,
          urls: ["https://acme.example/a", "https://acme.example/b"],
          field: "title",
          value: "Welcome to Acme",
        },
        {
          hash: null,
          urls: ["https://acme.example/c", "https://acme.example/d"],
          field: "metaDescription",
          value: "We sell things",
        },
        {
          hash: "deadbeefcafef00d",
          urls: ["https://acme.example/x", "https://acme.example/y"],
          field: "content",
          value: null,
        },
      ],
      totalDuplicateGroups: 3,
    }
    getDuplicates.mockResolvedValue(result)

    renderRoute()

    // Default tab is "Title". The title-cluster should be visible, the
    // description-cluster and body-cluster should not.
    await waitFor(() => {
      expect(screen.getByText("Welcome to Acme")).toBeTruthy()
    })
    expect(screen.queryByText("We sell things")).toBeNull()

    // Switch to "Description" tab. Radix Tabs reacts to the pointer
    // down -> click sequence; click alone is a no-op in jsdom.
    const descTab = screen.getByRole("tab", { name: "Description" })
    fireEvent.mouseDown(descTab, { button: 0 })
    fireEvent.click(descTab)
    await waitFor(() => {
      expect(screen.getByText("We sell things")).toBeTruthy()
    })
    expect(screen.queryByText("Welcome to Acme")).toBeNull()

    // Switch to "Body" tab. The cluster title falls back to the hash
    // prefix because BE leaves `value` null for body duplicates.
    const bodyTab = screen.getByRole("tab", { name: "Body" })
    fireEvent.mouseDown(bodyTab, { button: 0 })
    fireEvent.click(bodyTab)
    await waitFor(() => {
      expect(screen.getByText(/hash deadbeefcafe/)).toBeTruthy()
    })
  })

  it("renders the empty-state per tab when no clusters match", async () => {
    const result: DuplicatesResult = {
      groups: [
        {
          hash: null,
          urls: ["https://acme.example/a", "https://acme.example/b"],
          field: "title",
          value: "Welcome",
        },
      ],
      totalDuplicateGroups: 1,
    }
    getDuplicates.mockResolvedValue(result)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeTruthy()
    })

    const descTab = screen.getByRole("tab", { name: "Description" })
    fireEvent.mouseDown(descTab, { button: 0 })
    fireEvent.click(descTab)
    await waitFor(() => {
      expect(
        screen.getByText(
          /No duplicate description found in this crawl/,
        ),
      ).toBeTruthy()
    })
  })

  it("does not crash on an empty payload", async () => {
    getDuplicates.mockResolvedValue({ groups: [], totalDuplicateGroups: 0 })

    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByText(/No duplicate title found in this crawl/),
      ).toBeTruthy()
    })
  })
})
