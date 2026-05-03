// Smoke test: the MS Teams channel form on Settings -> Tenant is disabled
// when the tenant's plan is STARTER (Pro plan only badge visible).

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

const getEmailChannel = vi.fn().mockResolvedValue({
  id: "ec_1",
  tenantId: "t_1",
  kind: "MEMBERS",
  recipients: [],
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
})
const updateEmailChannel = vi.fn()
const listSitesByTenant = vi.fn().mockResolvedValue([])
const getBilling = vi.fn().mockResolvedValue({
  plan: "STARTER",
  subscriptionStatus: "NONE",
  trialStartedAt: null,
  trialEndsAt: null,
  hasPaymentMethod: false,
})
const getTeamsChannel = vi.fn()
const getPagerDutyChannel = vi.fn()
const changePassword = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getEmailChannel,
    updateEmailChannel,
    listSitesByTenant,
    getBilling,
    getTeamsChannel,
    getPagerDutyChannel,
    changePassword,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      id: "u_1",
      email: "user@example.com",
      createdAt: "2026-05-01T00:00:00Z",
    },
    memberships: [{ tenantId: "t_1", tenantName: "Acme Corp", role: "OWNER" }],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => {},
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Settings } from "../Settings"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/settings"]}>
        <Routes>
          <Route path="/t/:tenantId/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Settings MS Teams channel gate", () => {
  afterEach(() => {
    cleanup()
    getTeamsChannel.mockReset()
    getPagerDutyChannel.mockReset()
  })

  it("disables the form and shows the Pro plan only badge for STARTER", async () => {
    const ApiErrorMod = await import("@/api/client")
    getTeamsChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getPagerDutyChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()

    // Switch to Tenant tab to mount the channel cards.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("teams-channel-card")).toBeTruthy()
    })

    expect(screen.getByTestId("teams-plan-gate").textContent).toMatch(
      /Pro plan only/i,
    )
    const webhook = screen.getByLabelText(
      "Incoming webhook URL",
    ) as HTMLInputElement
    expect(webhook.disabled).toBe(true)
    // The Teams card's Save button is the one inside the teams-channel-card
    // container; scope the lookup so we don't match the Email channel Save.
    const teamsCard = screen.getByTestId("teams-channel-card") as HTMLElement
    const saves = Array.from(
      teamsCard.querySelectorAll("button"),
    ).filter((b) => b.textContent?.trim() === "Save")
    expect(saves.length).toBe(1)
    expect(saves[0]!.hasAttribute("disabled")).toBe(true)
  })
})
