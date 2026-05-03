// Smoke test: the change-password form on Settings -> Account surfaces a
// 401 from the typed client as an inline error against the current-
// password field.

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

describe("Settings change-password form", () => {
  afterEach(() => {
    cleanup()
    changePassword.mockReset()
    getTeamsChannel.mockReset()
    getPagerDutyChannel.mockReset()
  })

  it("surfaces a 401 from changePassword as an inline error", async () => {
    const ApiErrorMod = await import("@/api/client")
    changePassword.mockRejectedValue(
      new ApiErrorMod.ApiError(401, "Unauthorized", null),
    )
    getTeamsChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getPagerDutyChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("change-password-form")).toBeTruthy()
    })

    const current = screen.getByLabelText("Current password") as HTMLInputElement
    const next = screen.getByLabelText("New password") as HTMLInputElement
    const confirm = screen.getByLabelText("Confirm new password") as HTMLInputElement
    fireEvent.change(current, { target: { value: "oldPassword1" } })
    fireEvent.change(next, { target: { value: "newPassword1" } })
    fireEvent.change(confirm, { target: { value: "newPassword1" } })

    fireEvent.click(screen.getByRole("button", { name: /Change password/i }))

    await waitFor(() => {
      expect(screen.getByTestId("error-current-password").textContent).toMatch(
        /Current password is incorrect/i,
      )
    })
  })
})
