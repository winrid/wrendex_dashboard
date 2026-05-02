// Stripe Elements scaffolding (plan section 1.2 step 3). When
// createSetupIntent returns null (the documented Phase 1.5 deferral),
// the Signup route surfaces a "Skip card capture" prompt so the user
// can still create their account.

import { describe, expect, it, vi, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

afterEach(() => {
  cleanup()
})
import { MemoryRouter, Route, Routes } from "react-router-dom"

const sendTelemetry = vi.fn()
const createSetupIntent = vi.fn().mockResolvedValue(null)
const createCheckoutSession = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    sendTelemetry,
    createSetupIntent,
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

describe("Signup Stripe Elements scaffolding", () => {
  it("renders the 'Skip card capture' link when createSetupIntent returns null", async () => {
    renderRoute(
      "/signup?claimToken=tok-claim&suggestedTenant=acme.example",
    )

    await waitFor(() => {
      expect(screen.getByTestId("skip-card-capture")).toBeTruthy()
    })
    expect(screen.getByText(/Skip card capture for now/i)).toBeTruthy()
  })
})
