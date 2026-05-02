// Smoke test for the public /audit landing form. Mocks
// startAnonymousCrawl to return a token and asserts the form posts and
// the route navigates to /a/{token}.

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const startAnonymousCrawl = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    startAnonymousCrawl,
  }),
}))

import { Audit } from "../Audit"

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
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
      <MemoryRouter initialEntries={["/audit"]}>
        <Routes>
          <Route path="/audit" element={<Audit />} />
          <Route path="/a/:token" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Audit landing", () => {
  it("submits startAnonymousCrawl and navigates to /a/{token} on success", async () => {
    startAnonymousCrawl.mockResolvedValue({
      token: "tok-xyz",
      crawlRunId: "c_1",
      status: "queued",
    })

    renderRoute()

    const input = screen.getByLabelText("Site URL") as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: "https://acme.example" } })
    })

    const submit = screen.getByRole("button", { name: /Run free audit/i })
    await act(async () => {
      fireEvent.submit(submit.closest("form")!)
    })

    await waitFor(() => {
      expect(startAnonymousCrawl).toHaveBeenCalledWith({
        url: "https://acme.example",
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId("loc").textContent).toBe("/a/tok-xyz")
    })
  })
})
