// SAML SSO config card on Settings -> Tenant (P4 iter 4 FE-D). Asserts:
//   1. 404 from getSamlConfig renders "SSO is not configured." + the
//      Configure SAML button.
//   2. Submitting valid IdP fields calls updateSamlConfig.
//   3. A 400 with a body string from updateSamlConfig surfaces inline
//      against the cert textarea.

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
const updateSamlConfig = vi.fn()
const deleteSamlConfig = vi.fn()
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
    updateSamlConfig,
    deleteSamlConfig,
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

const VALID_PEM =
  "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEF\n-----END CERTIFICATE-----"

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

async function setupAgencyWith404Saml() {
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
  return ApiErrorMod
}

describe("SAML SSO config card", () => {
  it("renders 'SSO is not configured.' + Configure SAML when GET 404s", async () => {
    await setupAgencyWith404Saml()

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("saml-config-card")).toBeTruthy()
    })

    await waitFor(() => {
      expect(screen.getByTestId("saml-not-configured")).toBeTruthy()
    })
    expect(screen.getByTestId("saml-not-configured").textContent).toMatch(
      /SSO is not configured/i,
    )
    expect(screen.getByTestId("saml-configure")).toBeTruthy()
  })

  it("submits valid IdP fields via updateSamlConfig", async () => {
    await setupAgencyWith404Saml()
    updateSamlConfig.mockResolvedValue({
      id: "saml_1",
      tenantId: "t_1",
      idpEntityId: "https://idp.example.com/entity",
      idpSsoUrl: "https://idp.example.com/sso",
      idpCertX509: VALID_PEM,
      enabled: true,
      createdAt: "2026-05-03T10:00:00Z",
      updatedAt: "2026-05-03T10:00:00Z",
      configuredByUserId: "u_1",
    })

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("saml-configure")).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId("saml-configure"))

    await waitFor(() => {
      expect(screen.getByTestId("saml-idp-entity")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("saml-idp-entity"), {
      target: { value: "https://idp.example.com/entity" },
    })
    fireEvent.change(screen.getByTestId("saml-idp-sso"), {
      target: { value: "https://idp.example.com/sso" },
    })
    fireEvent.change(screen.getByTestId("saml-idp-cert"), {
      target: { value: VALID_PEM },
    })

    fireEvent.click(screen.getByTestId("saml-submit"))

    await waitFor(() => {
      expect(updateSamlConfig).toHaveBeenCalledWith("t_1", {
        idpEntityId: "https://idp.example.com/entity",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertX509: VALID_PEM,
        enabled: true,
      })
    })
  })

  it("surfaces a 400 from updateSamlConfig as an inline cert error", async () => {
    const ApiErrorMod = await setupAgencyWith404Saml()
    updateSamlConfig.mockRejectedValue(
      new ApiErrorMod.ApiError(
        400,
        "Could not parse PEM",
        "Could not parse PEM",
      ),
    )

    renderRoute()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    await waitFor(() => {
      expect(screen.getByTestId("saml-configure")).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId("saml-configure"))

    await waitFor(() => {
      expect(screen.getByTestId("saml-idp-entity")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("saml-idp-entity"), {
      target: { value: "https://idp.example.com/entity" },
    })
    fireEvent.change(screen.getByTestId("saml-idp-sso"), {
      target: { value: "https://idp.example.com/sso" },
    })
    fireEvent.change(screen.getByTestId("saml-idp-cert"), {
      target: { value: VALID_PEM },
    })

    fireEvent.click(screen.getByTestId("saml-submit"))

    await waitFor(() => {
      expect(screen.getByTestId("saml-cert-error")).toBeTruthy()
    })
    expect(screen.getByTestId("saml-cert-error").textContent).toMatch(
      /Could not parse PEM/,
    )
  })
})
