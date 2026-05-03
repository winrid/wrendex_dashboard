// TLS certificate subsection inside the Custom subdomain card (P5 iter 3
// FE-C). Asserts:
//   1. "Provision TLS" button is only enabled once the subdomain is
//      CNAME-verified; click calls provisionTls(tenantId).
//   2. PROVISIONING state polls the cert endpoint every 10s.
//   3. ACTIVE state renders the Issued / Renews relative timestamps and
//      the Revoke confirmation dialog routes through revokeTls(tenantId).
//
// We render the exported CustomSubdomainCard directly rather than the full
// Settings shell so the test focuses on TLS lifecycle without fighting the
// other tenant-tab cards.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getBilling = vi.fn()
const getBranding = vi.fn()
const updateBranding = vi.fn()
const verifySubdomain = vi.fn()
const getTlsCert = vi.fn()
const provisionTls = vi.fn()
const revokeTls = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getBilling,
    getBranding,
    updateBranding,
    verifySubdomain,
    getTlsCert,
    provisionTls,
    revokeTls,
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

import { CustomSubdomainCard } from "../Settings"

const AGENCY_BILLING = {
  plan: "AGENCY",
  subscriptionStatus: "ACTIVE",
  trialStartedAt: null,
  trialEndsAt: null,
  hasPaymentMethod: true,
}

const VERIFIED_BRANDING = {
  tenantId: "t_1",
  logoDataUrl: null,
  accentColor: null,
  fromName: null,
  hidePoweredBy: false,
  customSubdomain: "audits.acme.com",
  customSubdomainVerifiedAt: "2026-05-01T00:00:00Z",
  lastDnsCheckAt: "2026-05-01T00:00:00Z",
  lastDnsCheckResult: "ok",
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
}

const UNVERIFIED_BRANDING = {
  ...VERIFIED_BRANDING,
  customSubdomainVerifiedAt: null,
  lastDnsCheckAt: null,
  lastDnsCheckResult: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderCard() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <CustomSubdomainCard tenantId="t_1" />
    </QueryClientProvider>,
  )
}

describe("TLS cert section - Provision TLS gating", () => {
  it("disables Provision TLS until the subdomain is CNAME-verified", async () => {
    const { ApiError } = await import("@/api/client")
    getBilling.mockResolvedValue(AGENCY_BILLING)
    getBranding.mockResolvedValue(UNVERIFIED_BRANDING)
    getTlsCert.mockRejectedValue(new ApiError(404, "Not Found", null))

    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId("tls-cert-empty")).toBeTruthy()
    })

    const btn = screen.getByTestId("tls-cert-provision") as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it("enables Provision TLS once verified and click calls provisionTls", async () => {
    const { ApiError } = await import("@/api/client")
    getBilling.mockResolvedValue(AGENCY_BILLING)
    getBranding.mockResolvedValue(VERIFIED_BRANDING)
    getTlsCert.mockRejectedValue(new ApiError(404, "Not Found", null))
    provisionTls.mockResolvedValue({
      subdomain: "audits.acme.com",
      status: "PROVISIONING",
      issuedAt: null,
      expiresAt: null,
      renewAfter: null,
    })

    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId("tls-cert-empty")).toBeTruthy()
    })

    const btn = screen.getByTestId("tls-cert-provision") as HTMLButtonElement
    await waitFor(() => {
      expect(btn.disabled).toBe(false)
    })

    fireEvent.click(btn)

    await waitFor(() => {
      expect(provisionTls).toHaveBeenCalledWith("t_1")
    })
  })
})

describe("TLS cert section - PROVISIONING polls", () => {
  it("polls getTlsCert every 10s while status is PROVISIONING", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    getBilling.mockResolvedValue(AGENCY_BILLING)
    getBranding.mockResolvedValue(VERIFIED_BRANDING)
    getTlsCert.mockResolvedValue({
      subdomain: "audits.acme.com",
      status: "PROVISIONING",
      issuedAt: null,
      expiresAt: null,
      renewAfter: null,
    })

    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId("tls-cert-provisioning")).toBeTruthy()
    })

    expect(getTlsCert).toHaveBeenCalledTimes(1)

    // Advance 10s; react-query refetchInterval should refetch.
    await vi.advanceTimersByTimeAsync(10_000)
    await waitFor(() => {
      expect(getTlsCert).toHaveBeenCalledTimes(2)
    })

    // Another tick -> another refetch.
    await vi.advanceTimersByTimeAsync(10_000)
    await waitFor(() => {
      expect(getTlsCert).toHaveBeenCalledTimes(3)
    })
  })
})

describe("TLS cert section - ACTIVE + Revoke", () => {
  it("renders relative-time issued + renews and routes Revoke through the confirmation dialog", async () => {
    getBilling.mockResolvedValue(AGENCY_BILLING)
    getBranding.mockResolvedValue(VERIFIED_BRANDING)
    // Issued 1 day ago; renews in 60 days.
    const issuedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const renewAfter = new Date(
      Date.now() + 60 * 24 * 60 * 60 * 1000,
    ).toISOString()
    getTlsCert.mockResolvedValue({
      subdomain: "audits.acme.com",
      status: "ACTIVE",
      issuedAt,
      expiresAt: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      renewAfter,
    })
    revokeTls.mockResolvedValue(undefined)

    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId("tls-cert-active")).toBeTruthy()
    })

    const issued = screen.getByTestId("tls-cert-issued").textContent ?? ""
    const renews = screen.getByTestId("tls-cert-renews").textContent ?? ""
    // date-fns formatDistanceToNow always emits "ago" / "in" suffixes when
    // addSuffix:true; assert the relative-time shape rather than an exact
    // string so the test is robust to wall-clock drift.
    expect(issued).toMatch(/ago/)
    expect(renews).toMatch(/in /)

    const revokeBtn = screen.getByTestId("tls-cert-revoke") as HTMLButtonElement
    fireEvent.click(revokeBtn)

    // Confirmation dialog mounts the destructive Revoke action.
    const confirm = (await screen.findByTestId(
      "tls-cert-revoke-confirm",
    )) as HTMLButtonElement
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(revokeTls).toHaveBeenCalledWith("t_1")
    })
  })
})
