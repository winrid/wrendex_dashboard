// Asserts that Signup with ?claimToken=... calls the claim mutation
// after signup completes. We mock the AuthProvider's
// signupWithOptionalClaim helper directly so the test boundary is the
// route component, not the network.

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const signupWithOptionalClaim = vi.fn()

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
      </Routes>
    </MemoryRouter>,
  )
}

describe("Signup with claimToken", () => {
  it("calls signupWithOptionalClaim with the claim token, then routes to the claiming view", async () => {
    signupWithOptionalClaim.mockResolvedValue({
      tenantId: "t_1",
      claim: {
        siteId: "s_1",
        crawlRunId: "c_1",
        claimedAt: "2026-05-02T00:00:00Z",
      },
    })

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

    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent ?? ""
      expect(loc).toContain("/a/tok-claim/claiming")
      expect(loc).toContain("tenantId=t_1")
      expect(loc).toContain("siteId=s_1")
    })
  })
})
