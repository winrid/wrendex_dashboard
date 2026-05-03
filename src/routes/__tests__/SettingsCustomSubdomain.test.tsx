// Custom subdomain card on Settings -> Tenant (P4 iter 4 FE-D). Asserts:
//   1. STARTER plan renders the Agency-only badge and disables the input
//      and Save button.
//   2. Save calls updateBranding({customSubdomain}).
//   3. Check DNS calls verifySubdomain and surfaces the response.

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
const verifySubdomain = vi.fn()
const getSamlConfig = vi.fn()
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
    verifySubdomain,
    getSamlConfig,
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

describe("Custom subdomain card", () => {
  it("disables the input + save button on STARTER and shows the Agency badge", async () => {
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
    getSamlConfig.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("custom-subdomain-card")).toBeTruthy()
    })

    expect(
      screen.getByTestId("custom-subdomain-plan-gate").textContent,
    ).toMatch(/Agency plan only/i)
    const input = screen.getByTestId(
      "custom-subdomain-input",
    ) as HTMLInputElement
    expect(input.disabled).toBe(true)
    const save = screen.getByTestId(
      "custom-subdomain-save",
    ) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it("Save calls updateBranding with the typed subdomain on AGENCY", async () => {
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
      customSubdomain: null,
      customSubdomainVerifiedAt: null,
      lastDnsCheckAt: null,
      lastDnsCheckResult: null,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-05-01T00:00:00Z",
    })
    updateBranding.mockResolvedValue({
      tenantId: "t_1",
      logoDataUrl: null,
      accentColor: null,
      fromName: null,
      hidePoweredBy: false,
      customSubdomain: "audits.acme.com",
      customSubdomainVerifiedAt: null,
      lastDnsCheckAt: null,
      lastDnsCheckResult: null,
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
    getSamlConfig.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("custom-subdomain-card")).toBeTruthy()
    })

    const input = screen.getByTestId(
      "custom-subdomain-input",
    ) as HTMLInputElement
    await waitFor(() => {
      expect(input.disabled).toBe(false)
    })

    fireEvent.change(input, { target: { value: "audits.acme.com" } })

    const save = screen.getByTestId(
      "custom-subdomain-save",
    ) as HTMLButtonElement
    fireEvent.click(save)

    await waitFor(() => {
      expect(updateBranding).toHaveBeenCalledWith("t_1", {
        customSubdomain: "audits.acme.com",
      })
    })
  })

  it("Check DNS calls verifySubdomain on AGENCY", async () => {
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
      customSubdomain: "audits.acme.com",
      customSubdomainVerifiedAt: null,
      lastDnsCheckAt: null,
      lastDnsCheckResult: null,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-05-01T00:00:00Z",
    })
    verifySubdomain.mockResolvedValue({
      verified: true,
      customSubdomain: "audits.acme.com",
      lastDnsCheckResult: "ok",
      lastDnsCheckAt: "2026-05-03T10:00:00Z",
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
    getSamlConfig.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("custom-subdomain-card")).toBeTruthy()
    })

    const verify = screen.getByTestId(
      "custom-subdomain-verify",
    ) as HTMLButtonElement
    await waitFor(() => {
      expect(verify.disabled).toBe(false)
    })

    fireEvent.click(verify)

    await waitFor(() => {
      expect(verifySubdomain).toHaveBeenCalledWith("t_1")
    })
  })
})
