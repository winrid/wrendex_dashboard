// Stripe payment scaffolding (plan section 1.2 step 3). The Signup route
// surfaces a small "we'll capture a card" notice on mount when claimToken
// is present; the real Stripe Elements PaymentElement renders on the
// post-signup card-capture step (covered by separate flow tests once the
// confirmSetup mock is wired in jsdom).

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

describe("Signup payment notice", () => {
  it("renders the 'capture a card' notice when claimToken is present", async () => {
    renderRoute(
      "/signup?claimToken=tok-claim&suggestedTenant=acme.example",
    )

    await waitFor(() => {
      expect(screen.getByTestId("payment-redirect-note")).toBeTruthy()
    })
    expect(
      screen.getByText(/capture a card so we can start your 14-day trial/i),
    ).toBeTruthy()
  })
})
