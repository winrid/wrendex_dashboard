// Funnel telemetry: the /audit submit form fires hero_paste_url with
// {url} on the typed-client sendTelemetry method. Mocked at the
// useApiClient boundary; no real network involved.

import { describe, expect, it, vi, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react"

afterEach(() => {
  cleanup()
})
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const startAnonymousCrawl = vi.fn().mockResolvedValue({
  token: "tok-xyz",
  crawlRunId: "c_1",
  status: "queued",
})
const sendTelemetry = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    startAnonymousCrawl,
    sendTelemetry,
  }),
}))

import { Audit } from "../Audit"

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
          <Route path="/a/:token" element={<div>TEASER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Audit funnel telemetry", () => {
  it("fires hero_paste_url with {url} on submit", async () => {
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
      expect(sendTelemetry).toHaveBeenCalledTimes(1)
    })
    const events = sendTelemetry.mock.calls[0][0] as Array<{
      event: string
      properties?: Record<string, unknown>
    }>
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe("hero_paste_url")
    expect(events[0].properties?.url).toBe("https://acme.example")
  })
})
