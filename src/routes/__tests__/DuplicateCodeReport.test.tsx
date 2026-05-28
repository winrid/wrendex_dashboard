// Smoke tests for the Duplicate Code report. Mocks getDuplicateCode and
// asserts that the per-language stats render, tab switching filters
// entries by language, and the empty state renders when there are no
// alerts.

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
import type { DuplicateCodeResult } from "@/api/types"

const getDuplicateCode = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getDuplicateCode,
  }),
}))

import { DuplicateCodeReport } from "../DuplicateCodeReport"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/crawls/c_1/duplicate-code"]}>
        <Routes>
          <Route
            path="/t/:tenantId/crawls/:crawlId/duplicate-code"
            element={<DuplicateCodeReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("DuplicateCodeReport", () => {
  afterEach(() => {
    cleanup()
    getDuplicateCode.mockReset()
  })

  it("renders per-language stats and filters entries by tab", async () => {
    const result: DuplicateCodeResult = {
      stats: {
        js: {
          alertCount: 2,
          totalTokens: 600,
          avgTokens: 300,
          maxTokens: 400,
        },
        css: {
          alertCount: 1,
          totalTokens: 80,
          avgTokens: 80,
          maxTokens: 80,
        },
      },
      entries: [
        {
          alertId: "a1",
          pageUrl: "https://acme.example/a",
          language: "JS",
          tokenCount: 400,
          sourceA: "https://acme.example/x.js",
          sourceB: "https://acme.example/y.js",
          message: "Duplicate JavaScript code",
          snippet: "function x() {}",
        },
        {
          alertId: "a2",
          pageUrl: "https://acme.example/b",
          language: "JS",
          tokenCount: 200,
          sourceA: "https://acme.example/x.js",
          sourceB: "https://acme.example/z.js",
          message: "Duplicate JavaScript code",
          snippet: null,
        },
        {
          alertId: "a3",
          pageUrl: "https://acme.example/c",
          language: "CSS",
          tokenCount: 80,
          sourceA: "https://acme.example/a.css",
          sourceB: "https://acme.example/b.css",
          message: "Duplicate CSS code",
          snippet: null,
        },
      ],
    }
    getDuplicateCode.mockResolvedValue(result)

    renderRoute()

    // Wait for the per-language stats cards (only present after the
    // query resolves; the page heading renders during loading too).
    await waitFor(() => {
      expect(screen.getByText("JavaScript")).toBeTruthy()
    })
    expect(screen.getByText("CSS")).toBeTruthy()

    // JS tab (default) shows two entries.
    expect(screen.getByText("https://acme.example/a")).toBeTruthy()
    expect(screen.getByText("https://acme.example/b")).toBeTruthy()
    expect(screen.queryByText("https://acme.example/c")).toBeNull()

    // Switch to CSS tab. Radix Tabs reacts to the pointer-down -> click
    // sequence; click alone is a no-op in jsdom.
    const cssTab = screen.getByRole("tab", { name: /CSS/ })
    fireEvent.mouseDown(cssTab, { button: 0 })
    fireEvent.click(cssTab)
    await waitFor(() => {
      expect(screen.getByText("https://acme.example/c")).toBeTruthy()
    })
  })

  it("renders empty state when no alerts are present", async () => {
    getDuplicateCode.mockResolvedValue({ stats: null, entries: [] })

    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByText(/No duplicate code detected/),
      ).toBeTruthy()
    })
  })
})
