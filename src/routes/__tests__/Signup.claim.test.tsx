// Asserts that Signup with ?claimToken=... calls the claim mutation
// after signup completes, then attempts to start the trial via Stripe
// Checkout. On createCheckoutSession soft-failure (Stripe unavailable)
// the user lands on the claimed site overview and a toast surfaces.

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const signupWithOptionalClaim = vi.fn()
const sendTelemetry = vi.fn()
const createCheckoutSession = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    sendTelemetry,
    createCheckoutSession,
  }),
}))

vi.mock("@/auth/AuthProvider", async () => {
  // Re-export the rest of the module shape but stub useAuth.
  return {
    SESSION_TOKEN_KEY: "wrendex.sessionToken",
    AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useAuth: () => ({
      isAuthed: false,
      isLoading: false,
      user: null,
      memberships: [],
      activeTenantId: null,
      signup: async () => {},
      signupWithOptionalClaim,
      login: async () => {},
      logout: () => {},
      setActiveTenant: () => {},
    }),
  }
})

import { Signup } from "../Signup"

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderRoute(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/a/:token/claiming" element={<LocationProbe />} />
        <Route path="/t/:tenantId/sites" element={<LocationProbe />} />
        <Route
          path="/t/:tenantId/sites/:siteId"
          element={<LocationProbe />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Signup with claimToken", () => {
  it("calls signupWithOptionalClaim with the claim token, then attempts a Stripe Checkout and lands on the site overview when checkout fails", async () => {
    signupWithOptionalClaim.mockResolvedValue({
      tenantId: "t_1",
      claim: {
        siteId: "s_1",
        crawlRunId: "c_1",
        claimedAt: "2026-05-02T00:00:00Z",
      },
    })
    // Soft-fail Stripe so the route falls through to the SPA navigate.
    createCheckoutSession.mockRejectedValue(new Error("Stripe unavailable"))

    renderRoute("/signup?claimToken=tok-claim&suggestedTenant=acme.example")

    expect(screen.getByTestId("claim-note")).toBeTruthy()

    const email = screen.getByLabelText("Work email") as HTMLInputElement
    const password = screen.getByLabelText("Password") as HTMLInputElement
    const tenantName = screen.getByLabelText("Workspace name") as HTMLInputElement

    expect(tenantName.value).toBe("acme.example")

    await act(async () => {
      fireEvent.change(email, { target: { value: "user@example.com" } })
      fireEvent.change(password, { target: { value: "hunter2hunter2" } })
    })

    const submit = screen.getByRole("button", { name: /Create account/i })
    await act(async () => {
      fireEvent.submit(submit.closest("form")!)
    })

    await waitFor(() => {
      expect(signupWithOptionalClaim).toHaveBeenCalledWith(
        {
          email: "user@example.com",
          password: "hunter2hunter2",
          tenantName: "acme.example",
        },
        "tok-claim",
      )
    })

    // Stripe Checkout was attempted with the right shape.
    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalled()
    })
    const [tenantId, args] = createCheckoutSession.mock.calls[0]
    expect(tenantId).toBe("t_1")
    expect(args.priceTier).toBe("PROFESSIONAL")
    expect(args.trialDays).toBe(14)
    expect(typeof args.returnUrl).toBe("string")
    expect(args.returnUrl).toContain("/t/t_1/sites/s_1")

    // On checkout soft-fail we land on the site overview.
    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent ?? ""
      expect(loc).toContain("/t/t_1/sites/s_1")
    }, { timeout: 3000 })
  })
})
