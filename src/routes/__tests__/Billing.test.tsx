// BillingPage: renders the three plan cards and clicking Subscribe on
// Professional calls createCheckoutSession with priceTier=PROFESSIONAL.
// Stripe is never called in tests; the typed-client method is mocked.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getBilling = vi.fn().mockResolvedValue({
  plan: "PROFESSIONAL",
  subscriptionStatus: "NONE",
  trialStartedAt: null,
  trialEndsAt: null,
  hasPaymentMethod: false,
})
const createCheckoutSession = vi.fn().mockResolvedValue({
  url: "https://checkout.stripe.com/pay/cs_test_xyz",
  sessionId: "cs_test_xyz",
})
const createPortalSession = vi.fn()
const sendTelemetry = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getBilling,
    createCheckoutSession,
    createPortalSession,
    sendTelemetry,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u_1", email: "user@example.com", createdAt: "2026-05-01T00:00:00Z" },
    memberships: [{ tenantId: "t_1", tenantName: "Acme", role: "OWNER" }],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
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
  // Reset the trial_active dedup so cross-test bleed-through doesn't mask
  // a fresh fire of the telemetry event.
  try {
    window.localStorage.clear()
  } catch {
    // ignore
  }
  // Re-prime defaults after vi.clearAllMocks.
  getBilling.mockResolvedValue({
    plan: "PROFESSIONAL",
    subscriptionStatus: "NONE",
    trialStartedAt: null,
    trialEndsAt: null,
    hasPaymentMethod: false,
  })
  createCheckoutSession.mockResolvedValue({
    url: "https://checkout.stripe.com/pay/cs_test_xyz",
    sessionId: "cs_test_xyz",
  })
  // Replace window.location with a mockable surface so the Subscribe
  // button's redirect doesn't navigate the test runner. jsdom's location
  // object is read-only by default.
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

describe("Billing page", () => {
  it("renders the three plan tier cards", async () => {
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("plan-card-STARTER")).toBeTruthy()
      expect(screen.getByTestId("plan-card-PROFESSIONAL")).toBeTruthy()
      expect(screen.getByTestId("plan-card-AGENCY")).toBeTruthy()
    })
  })

  it("calls createCheckoutSession with priceTier=PROFESSIONAL when Subscribe is clicked", async () => {
    renderRoute()
    const button = await screen.findByTestId("subscribe-PROFESSIONAL")
    fireEvent.click(button)
    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledTimes(1)
    })
    const [tenantId, args] = createCheckoutSession.mock.calls[0]
    expect(tenantId).toBe("t_1")
    expect(args.priceTier).toBe("PROFESSIONAL")
    expect(args.trialDays).toBe(14)
    expect(typeof args.returnUrl).toBe("string")
  })
})
