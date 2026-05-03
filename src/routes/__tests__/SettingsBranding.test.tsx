// Smoke test: the Branding card on Settings -> Tenant validates the hex
// accent input and disables the Save button + shows the upgrade badge for
// non-AGENCY tenants. We mock the typed client + AuthProvider so no
// network is exercised.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
const changePassword = vi.fn()
const getBilling = vi.fn()
const getTeamsChannel = vi.fn()
const getPagerDutyChannel = vi.fn()
const getSlackChannel = vi.fn()
const getBranding = vi.fn()
const updateBranding = vi.fn()
const listShareLinks = vi.fn().mockResolvedValue([])

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getEmailChannel,
    updateEmailChannel,
    listSitesByTenant,
    changePassword,
    getBilling,
    getTeamsChannel,
    getPagerDutyChannel,
    getSlackChannel,
    getBranding,
    updateBranding,
    listShareLinks,
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
    branding: null,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => {},
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Settings } from "../Settings"

beforeEach(() => {
  vi.clearAllMocks()
  getEmailChannel.mockResolvedValue({
    id: "ec_1",
    tenantId: "t_1",
    kind: "MEMBERS",
    recipients: [],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  })
  listSitesByTenant.mockResolvedValue([])
  listShareLinks.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

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

describe("Branding card", () => {
  it("disables the form and surfaces the Agency-only badge for STARTER", async () => {
    const ApiErrorMod = await import("@/api/client")
    getBilling.mockResolvedValue({
      plan: "STARTER",
      subscriptionStatus: "ACTIVE",
      trialStartedAt: null,
      trialEndsAt: null,
      hasPaymentMethod: true,
    })
    getBranding.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getTeamsChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getPagerDutyChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getSlackChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("branding-card")).toBeTruthy()
    })

    expect(screen.getByTestId("branding-plan-gate").textContent).toMatch(
      /Agency plan only/i,
    )
    const accentInput = screen.getByTestId(
      "branding-accent-input",
    ) as HTMLInputElement
    expect(accentInput.disabled).toBe(true)
    const save = screen.getByTestId("branding-save") as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it("flags an invalid hex accent on save for AGENCY tenants", async () => {
    const ApiErrorMod = await import("@/api/client")
    getBilling.mockResolvedValue({
      plan: "AGENCY",
      subscriptionStatus: "ACTIVE",
      trialStartedAt: null,
      trialEndsAt: null,
      hasPaymentMethod: true,
    })
    getBranding.mockResolvedValue({
      tenantId: "t_1",
      logoDataUrl: null,
      accentColor: null,
      fromName: null,
      hidePoweredBy: false,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-05-01T00:00:00Z",
    })
    getTeamsChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getPagerDutyChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )
    getSlackChannel.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("branding-card")).toBeTruthy()
    })

    // Plan gate hidden once the AGENCY billing snapshot resolves.
    await waitFor(() => {
      expect(screen.queryByTestId("branding-plan-gate")).toBeNull()
    })

    const accentInput = screen.getByTestId(
      "branding-accent-input",
    ) as HTMLInputElement
    await waitFor(() => {
      expect(accentInput.disabled).toBe(false)
    })
    fireEvent.change(accentInput, { target: { value: "not-a-hex" } })

    const save = screen.getByTestId("branding-save") as HTMLButtonElement
    fireEvent.click(save)

    await waitFor(() => {
      expect(screen.getByTestId("branding-accent-error")).toBeTruthy()
    })
    expect(updateBranding).not.toHaveBeenCalled()
  })
})
