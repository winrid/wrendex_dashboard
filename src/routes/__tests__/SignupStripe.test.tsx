// Stripe payment scaffolding (plan section 1.2 step 3 - Phase 1.5
// fallback). Until the BE SetupIntent endpoint ships, the Signup route
// captures the card POST-signup by redirecting to Stripe Checkout. The
// PaymentMethodScaffolding card surfaces a small "we'll redirect after
// signup" notice so the user knows what to expect.

import { describe, expect, it, vi, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

afterEach(() => {
  cleanup()
})
import { MemoryRouter, Route, Routes } from "react-router-dom"

const sendTelemetry = vi.fn()
const createCheckoutSession = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    sendTelemetry,
    createCheckoutSession,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  SESSION_TOKEN_KEY: "wrendex.sessionToken",
  useAuth: () => ({
    isAuthed: false,
    isLoading: false,
    user: null,
    memberships: [],
    activeTenantId: null,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => {},
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Signup } from "../Signup"

function renderRoute(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Signup payment scaffolding (Phase 1.5 fallback)", () => {
  it("renders the 'redirect after signup' notice when claimToken is present", async () => {
    renderRoute(
      "/signup?claimToken=tok-claim&suggestedTenant=acme.example",
    )

    await waitFor(() => {
      expect(screen.getByTestId("payment-redirect-note")).toBeTruthy()
    })
    expect(
      screen.getByText(/redirect you to a secure card capture step after signup/i),
    ).toBeTruthy()
  })
})
