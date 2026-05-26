// Smoke tests for the public status page (plan section 16). Mocks getStatus
// at the typed-client boundary; asserts each of the four canonical component
// cards renders, plus the coming-soon fallback when the BE 404s.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { StatusResponse } from "@/api/types"
import { ApiError } from "@/api/client"

const getStatus = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({ getStatus }),
}))

import { Status } from "../Status"

function renderStatus() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/status"]}>
        <Status />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE: StatusResponse = {
  status: "operational",
  updatedAt: "2026-04-30T12:00:00Z",
  components: [
    {
      id: "api",
      name: "API",
      status: "operational",
      metric: "99.97% uptime",
      updatedAt: null,
    },
    {
      id: "crawler",
      name: "Crawler",
      status: "degraded",
      metric: "98.1% success",
      updatedAt: null,
    },
    {
      id: "scheduler",
      name: "Scheduler",
      status: "operational",
      metric: "p95 lateness 12s",
      updatedAt: null,
    },
    {
      id: "mongo",
      name: "Mongo",
      status: "operational",
      metric: "45ms p99 latency",
      updatedAt: null,
    },
  ],
  incidents: null,
  sloTargets: null,
}

describe("Status page", () => {
  afterEach(() => {
    cleanup()
    getStatus.mockReset()
  })

  it("renders four component cards from a mocked status response", async () => {
    getStatus.mockResolvedValue(SAMPLE)
    renderStatus()

    await waitFor(() => {
      expect(screen.getByTestId("status-card-api")).toBeTruthy()
      expect(screen.getByTestId("status-card-crawler")).toBeTruthy()
      expect(screen.getByTestId("status-card-scheduler")).toBeTruthy()
      expect(screen.getByTestId("status-card-mongo")).toBeTruthy()
    })
    expect(screen.getByText(/99.97% uptime/)).toBeTruthy()
    expect(screen.getByText(/98.1% success/)).toBeTruthy()
  })

  it("renders the coming-soon fallback when the BE 404s", async () => {
    getStatus.mockRejectedValue(new ApiError(404, "not found", null))
    renderStatus()

    await waitFor(() => {
      expect(screen.getByTestId("status-coming-soon")).toBeTruthy()
    })
  })
})
