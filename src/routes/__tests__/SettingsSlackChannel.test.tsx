// Slack OAuth FE flow on Settings -> Tenant. Asserts:
//   1. When getSlackChannel 404s the card renders an "Install to Slack"
//      button.
//   2. Clicking the button calls startSlackInstall and navigates the
//      browser to the BE-returned URL.

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
const getSlackChannel = vi.fn()
const startSlackInstall = vi.fn()
const deleteSlackChannel = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getEmailChannel,
    updateEmailChannel,
    listSitesByTenant,
    getBilling,
    getTeamsChannel,
    getPagerDutyChannel,
    changePassword,
    getSlackChannel,
    startSlackInstall,
    deleteSlackChannel,
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

describe("Settings Slack channel install flow", () => {
  afterEach(() => {
    cleanup()
    getSlackChannel.mockReset()
    startSlackInstall.mockReset()
    deleteSlackChannel.mockReset()
    getTeamsChannel.mockReset()
    getPagerDutyChannel.mockReset()
  })

  it("navigates to the BE-returned install URL when the user clicks Install to Slack", async () => {
    const ApiErrorMod = await import("@/api/client")
    getSlackChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getTeamsChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getPagerDutyChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    startSlackInstall.mockResolvedValue({
      url: "https://slack.com/oauth/v2/authorize?state=abc",
    })

    // Stub window.location.href via a mutable accessor on the global object.
    const original = window.location
    let assignedHref = ""
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...original,
        get href() {
          return assignedHref
        },
        set href(v: string) {
          assignedHref = v
        },
        origin: "http://localhost",
        pathname: "/t/t_1/settings",
      } as unknown as Location,
    })

    try {
      renderRoute()

      fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

      const installBtn = await screen.findByTestId("slack-install-button")
      fireEvent.click(installBtn)

      await waitFor(() => {
        expect(startSlackInstall).toHaveBeenCalledTimes(1)
      })
      const callArgs = startSlackInstall.mock.calls[0]
      expect(callArgs?.[0]).toBe("t_1")
      expect(callArgs?.[1]).toEqual({
        returnUrl: "http://localhost/t/t_1/settings",
      })

      await waitFor(() => {
        expect(assignedHref).toBe(
          "https://slack.com/oauth/v2/authorize?state=abc",
        )
      })
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      })
    }
  })
})
