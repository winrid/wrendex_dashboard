// Smoke tests for the accept-invite landing page (plan section 14.2).
// Asserts the five terminal states from the route's branch table:
//   1. 404 -> "invalid" message.
//   2. 410 -> "expired" message.
//   3. signed-out + 200 -> sign-in prompt with the invite email surfaced.
//   4. signed-in + email mismatch -> sign-out prompt.
//   5. signed-in + email match -> Accept button calls acceptInvite.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getPublicInvite = vi.fn()
const acceptInvite = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getPublicInvite,
    acceptInvite,
  }),
}))

type AuthShape = {
  user: { id: string; email: string; createdAt: string } | null
  memberships: { tenantId: string; tenantName: string; role: string }[]
  activeTenantId: string | null
  isAuthed: boolean
  isLoading: boolean
  logout: () => void
  setActiveTenant: (id: string) => void
}

let authState: AuthShape = {
  user: null,
  memberships: [],
  activeTenantId: null,
  isAuthed: false,
  isLoading: false,
  logout: () => {},
  setActiveTenant: () => {},
}

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => authState,
}))

import { AcceptInvite } from "../AcceptInvite"
import { ApiError } from "@/api/client"

function renderRoute(token = "tok_abc") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/accept-invite?token=${token}`]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            path="/t/:tenantId/sites"
            element={<div data-testid="landed-on-sites" />}
          />
          <Route path="/login" element={<div data-testid="login-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PUBLIC_INVITE = {
  tenantId: "t_2",
  tenantName: "Beta Co",
  email: "invitee@example.com",
  role: "EDITOR" as const,
  invitedByEmail: "owner@example.com",
  expiresAt: "2026-05-07T00:00:00Z",
}

describe("AcceptInvite", () => {
  beforeEach(() => {
    authState = {
      user: null,
      memberships: [],
      activeTenantId: null,
      isAuthed: false,
      isLoading: false,
      logout: () => {},
      setActiveTenant: () => {},
    }
  })
  afterEach(() => {
    cleanup()
    getPublicInvite.mockReset()
    acceptInvite.mockReset()
  })

  it("renders an 'invalid' message when the BE 404s", async () => {
    getPublicInvite.mockRejectedValue(new ApiError(404, "Not Found", null))
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invite-error-body").textContent).toMatch(
        /invalid/i,
      )
    })
  })

  it("renders an 'expired' message when the BE 410s", async () => {
    getPublicInvite.mockRejectedValue(new ApiError(410, "Gone", null))
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invite-error-body").textContent).toMatch(
        /expired/i,
      )
    })
  })

  it("shows the sign-in prompt when the user is signed out", async () => {
    getPublicInvite.mockResolvedValue(PUBLIC_INVITE)
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invite-signin-prompt")).toBeTruthy()
    })
    // The CTA links round-trip the token.
    const signInLink = screen
      .getAllByRole("link")
      .find((l) => l.textContent === "Sign in")
    expect(signInLink?.getAttribute("href")).toContain("invite=tok_abc")
  })

  it("shows a sign-out prompt when the signed-in email does not match", async () => {
    getPublicInvite.mockResolvedValue(PUBLIC_INVITE)
    authState = {
      ...authState,
      isAuthed: true,
      user: {
        id: "u_other",
        email: "other@example.com",
        createdAt: "2026-04-01T00:00:00Z",
      },
    }
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invite-email-mismatch")).toBeTruthy()
    })
  })

  it("calls acceptInvite when the signed-in email matches", async () => {
    getPublicInvite.mockResolvedValue(PUBLIC_INVITE)
    acceptInvite.mockResolvedValue({ tenantId: "t_2", role: "EDITOR" })
    authState = {
      ...authState,
      isAuthed: true,
      user: {
        id: "u_invitee",
        email: "invitee@example.com",
        createdAt: "2026-04-01T00:00:00Z",
      },
    }
    renderRoute()
    const btn = await screen.findByTestId("invite-accept-button")
    fireEvent.click(btn)
    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledTimes(1)
    })
    expect(acceptInvite.mock.calls[0][0]).toBe("tok_abc")
  })
})
