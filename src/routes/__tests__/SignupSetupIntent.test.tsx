// Stripe SetupIntent flow (plan section 1.2 step 3). Asserts that when
// createSetupIntent returns a real clientSecret, the Signup route mounts
// the Stripe Elements provider + PaymentElement on the post-signup card-
// capture step.
//
// We mock @stripe/stripe-js and @stripe/react-stripe-js so the test does
// not need a real publishable key (and so jsdom doesn't try to load the
// Stripe browser SDK). The mocks render a sentinel <div data-testid> for
// the Elements wrapper and the PaymentElement.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

// Inject a publishable key BEFORE the Signup module evaluates its lazy
// stripePromise. vi.stubEnv mutates import.meta.env in vitest's vite
// runner; static assignment is rejected because the env object is frozen.
vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_x")

const sendTelemetry = vi.fn()
const createCheckoutSession = vi.fn()
const createSetupIntent = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    sendTelemetry,
    createCheckoutSession,
    createSetupIntent,
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
    signupWithOptionalClaim: async () => ({
      tenantId: "t_1",
      claim: {
        siteId: "s_1",
        crawlRunId: "c_1",
        claimedAt: "2026-05-01T00:00:00Z",
      },
    }),
    login: async () => {},
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

const loadStripeMock = vi.fn(() => Promise.resolve({ id: "fake-stripe" }))
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: (...args: unknown[]) => loadStripeMock(...(args as [])),
}))

vi.mock("@stripe/react-stripe-js", async () => {
  const React = await import("react")
  return {
    Elements: ({ children }: { children: unknown }) =>
      React.createElement(
        "div",
        { "data-testid": "elements-provider" },
        children as React.ReactNode,
      ),
    PaymentElement: () =>
      React.createElement(
        "div",
        { "data-testid": "payment-element" },
        "PaymentElement",
      ),
    useStripe: () => ({
      confirmSetup: async () => ({
        setupIntent: { payment_method: "pm_1" },
      }),
    }),
    useElements: () => ({}),
  }
})

import { Signup } from "../Signup"

afterEach(() => {
  cleanup()
  createSetupIntent.mockReset()
  createCheckoutSession.mockReset()
})

function renderRoute(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Signup Stripe SetupIntent flow", () => {
  it("renders PaymentElement after createSetupIntent returns a clientSecret", async () => {
    createSetupIntent.mockResolvedValue({
      clientSecret: "seti_test_secret_x",
      customerId: "cus_test",
    })

    renderRoute(
      "/signup?claimToken=tok-claim&suggestedTenant=acme.example",
    )

    await waitFor(() => {
      expect(screen.getByLabelText("Work email")).toBeTruthy()
    })

    // Submit the email/password/tenant form.
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "validpw1" },
    })
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Acme" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }))

    await waitFor(() => {
      expect(screen.getByTestId("card-capture-card")).toBeTruthy()
    })
    expect(screen.getByTestId("elements-provider")).toBeTruthy()
    expect(screen.getByTestId("payment-element")).toBeTruthy()
    expect(createSetupIntent).toHaveBeenCalledWith("t_1")
  })
})
