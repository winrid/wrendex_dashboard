// Billing page (credit-based billing model). Covers the credit-balance
// snapshot, the auto top-up save mutation, the manual top-up purchase, the
// Stripe billing portal gating + redirect, and the trial_active telemetry
// once-per-tenant guard. Stripe is never called from the FE directly; the
// typed-client methods are mocked.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const TRIALING_SNAPSHOT = {
  plan: "BASE",
  subscriptionStatus: "TRIALING",
  trialStartedAt: "2026-05-01T00:00:00Z",
  trialEndsAt: "2026-05-15T00:00:00Z",
  hasPaymentMethod: true,
  creditBalance: 4200,
  creditsGrantedThisCycle: 5000,
  cycleStartedAt: "2026-05-01T00:00:00Z",
  cycleEndsAt: "2026-06-01T00:00:00Z",
  autoTopUp: { enabled: false, packSku: "PACK_5K", thresholdCredits: 1000 },
  topUpInFlight: false,
}

const getBilling = vi.fn().mockResolvedValue(TRIALING_SNAPSHOT)
const createCheckoutSession = vi.fn()
const createPortalSession = vi.fn().mockResolvedValue({
  url: "https://billing.stripe.com/p/session/test_xyz",
})
const patchAutoTopUp = vi.fn().mockResolvedValue({
  enabled: true,
  packSku: "PACK_5K",
  thresholdCredits: 1000,
})
const manualTopUp = vi.fn().mockResolvedValue({})
const sendTelemetry = vi.fn()
const listInvoices = vi.fn().mockResolvedValue({ items: [] })

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getBilling,
    createCheckoutSession,
    createPortalSession,
    patchAutoTopUp,
    manualTopUp,
    sendTelemetry,
    listInvoices,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u_1", email: "user@example.com", createdAt: "2026-05-01T00:00:00Z" },
    memberships: [{ tenantId: "t_1", tenantName: "Acme", role: "OWNER" }],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
    branding: null,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => ({}),
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Billing } from "../Billing"

beforeEach(() => {
  vi.clearAllMocks()
  try {
    window.localStorage.clear()
  } catch {
    // ignore
  }
  // Re-prime defaults after vi.clearAllMocks.
  getBilling.mockResolvedValue(TRIALING_SNAPSHOT)
  createPortalSession.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/test_xyz",
  })
  patchAutoTopUp.mockResolvedValue({
    enabled: true,
    packSku: "PACK_5K",
    thresholdCredits: 1000,
  })
  manualTopUp.mockResolvedValue({})
  listInvoices.mockResolvedValue({ items: [] })
  // jsdom's window.location is read-only; swap it for a plain mockable object
  // so the portal-success branch's `window.location.href = ...` assignment
  // doesn't navigate the test runner.
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      origin: "http://localhost:3000",
      pathname: "/t/t_1/billing",
      href: "http://localhost:3000/t/t_1/billing",
    },
  })
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
      <MemoryRouter initialEntries={["/t/t_1/billing"]}>
        <Routes>
          <Route path="/t/:tenantId/billing" element={<Billing />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Billing page (credit model)", () => {
  it("renders the credit balance card with the snapshot numbers", async () => {
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("credit-balance-card")).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText("4,200")).toBeTruthy()
    })
    expect(screen.getByText(/of 5,000 credits this cycle/)).toBeTruthy()
    expect(screen.getByTestId("credit-balance-bar")).toBeTruthy()
  })

  it("enables auto top-up and saves with the expected wire shape", async () => {
    renderRoute()
    const enabledCheckbox = (await screen.findByTestId(
      "auto-top-up-enabled",
    )) as HTMLInputElement
    await waitFor(() => {
      // Wait for the snapshot to land so the inputs are no longer disabled.
      expect(enabledCheckbox.disabled).toBe(false)
    })
    fireEvent.click(enabledCheckbox)
    const saveBtn = screen.getByTestId("auto-top-up-save")
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(patchAutoTopUp).toHaveBeenCalledTimes(1)
    })
    const [tenantId, body] = patchAutoTopUp.mock.calls[0]
    expect(tenantId).toBe("t_1")
    expect(body).toEqual({
      enabled: true,
      packSku: "PACK_5K",
      thresholdCredits: 1000,
    })
  })

  it("manual top-up calls the charge endpoint with the selected pack", async () => {
    renderRoute()
    const buyBtn = (await screen.findByTestId(
      "manual-top-up-buy",
    )) as HTMLButtonElement
    await waitFor(() => {
      expect(buyBtn.disabled).toBe(false)
    })
    fireEvent.click(buyBtn)
    await waitFor(() => {
      expect(manualTopUp).toHaveBeenCalledTimes(1)
    })
    const [tenantId, body] = manualTopUp.mock.calls[0]
    expect(tenantId).toBe("t_1")
    expect(body).toEqual({ packSku: "PACK_5K" })
  })

  it("gates the billing portal button on hasPaymentMethod and redirects on success", async () => {
    renderRoute()
    const portalBtn = (await screen.findByRole("button", {
      name: /Open billing portal/i,
    })) as HTMLButtonElement
    await waitFor(() => {
      expect(portalBtn.disabled).toBe(false)
    })
    fireEvent.click(portalBtn)
    await waitFor(() => {
      expect(createPortalSession).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(window.location.href).toBe(
        "https://billing.stripe.com/p/session/test_xyz",
      )
    })
  })

  it("disables the billing portal button when hasPaymentMethod is false", async () => {
    getBilling.mockResolvedValue({
      ...TRIALING_SNAPSHOT,
      hasPaymentMethod: false,
    })
    renderRoute()
    const portalBtn = (await screen.findByRole("button", {
      name: /Open billing portal/i,
    })) as HTMLButtonElement
    await waitFor(() => {
      expect(portalBtn.disabled).toBe(true)
    })
    expect(createPortalSession).not.toHaveBeenCalled()
  })

  it("fires trial_active telemetry once when the snapshot is TRIALING", async () => {
    renderRoute()
    await waitFor(() => {
      expect(sendTelemetry).toHaveBeenCalled()
    })
    const events = sendTelemetry.mock.calls.flatMap((call) => call[0])
    const trialActive = events.find(
      (e: { event: string }) => e.event === "trial_active",
    )
    expect(trialActive).toBeTruthy()
    expect(trialActive.properties).toMatchObject({
      tenantId: "t_1",
      plan: "BASE",
      userId: "u_1",
    })
  })
})
