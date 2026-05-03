// Login SSO button (P4 iter 4 FE-D). Asserts:
//   1. Clicking the "Sign in with SSO" button opens the workspace prompt.
//   2. Submitting the prompt with a tenant id navigates the browser to
//      the SP-initiated login endpoint with returnTo set to the current
//      origin.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const login = vi.fn()
const login2fa = vi.fn()
const getMe = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    login,
    login2fa,
    getMe,
    acceptInvite: vi.fn(),
    claimAnonymousCrawl: vi.fn(),
  }),
  setAuthToken: () => {},
  getAuthToken: () => null,
}))

import { Login } from "../Login"
import { AuthProvider } from "@/auth/AuthProvider"

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider skipBootstrap>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div data-testid="home-stub">home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe("Login SSO button", () => {
  let originalLocation: Location
  let assignedHref: string | null

  beforeEach(() => {
    assignedHref = null
    originalLocation = window.location
    // jsdom location is non-configurable; replace via defineProperty so
    // setting window.location.href doesn't navigate the test runner.
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        origin: "http://localhost:5173",
        pathname: "/login",
        search: "",
        hash: "",
        get href() {
          return assignedHref ?? "http://localhost:5173/login"
        },
        set href(v: string) {
          assignedHref = v
        },
      } as unknown as Location,
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    })
    login.mockReset()
    login2fa.mockReset()
    getMe.mockReset()
  })

  it("opens the workspace prompt when the SSO button is clicked", async () => {
    renderLogin()

    fireEvent.click(screen.getByTestId("sso-open"))

    await waitFor(() => {
      expect(screen.getByTestId("sso-workspace")).toBeTruthy()
    })
  })

  it("navigates to the SP login endpoint on submit", async () => {
    renderLogin()
    fireEvent.click(screen.getByTestId("sso-open"))
    await waitFor(() => {
      expect(screen.getByTestId("sso-workspace")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("sso-workspace"), {
      target: { value: "acme" },
    })
    fireEvent.click(screen.getByTestId("sso-submit"))

    await waitFor(() => {
      expect(assignedHref).not.toBeNull()
    })
    expect(assignedHref).toMatch(/\/api\/saml\/sp\/acme\/login/)
    expect(assignedHref).toMatch(/returnTo=http%3A%2F%2Flocalhost%3A5173%2F/)
  })

  it("rejects an empty workspace submit with an inline error", async () => {
    renderLogin()
    fireEvent.click(screen.getByTestId("sso-open"))
    await waitFor(() => {
      expect(screen.getByTestId("sso-workspace")).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId("sso-submit"))

    await waitFor(() => {
      expect(screen.getByTestId("sso-error")).toBeTruthy()
    })
    expect(assignedHref).toBeNull()
  })
})
