// Login SSO button (P4 iter 4 FE-D + P5 iter 2 FE-B). Asserts:
//   1. Clicking the "Sign in with SSO" button opens the workspace prompt.
//   2. Submitting the prompt with a tenant id navigates the browser to
//      the SP-initiated login endpoint with returnTo set to the current
//      origin.
//   3. When the URL carries ?error=<saml-code> the page surfaces the
//      matching friendly inline banner and strips the param via
//      history.replaceState so a refresh doesn't re-toast. Covers the
//      legacy saml-not-implemented code (defensive) and the new real-
//      protocol codes saml-signature-invalid + saml-replay shipped in
//      P5 iter 2 BE.

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

  // Shared driver: shim window.location to look like the BE bounced the
  // user back to /login?error=<code>, render Login, then return both the
  // banner and the replaceState side-effect tracking so each error-code
  // test can assert message + param-strip uniformly.
  const runErrorParamCase = async (code: string) => {
    let currentHref = `http://localhost:5173/login?error=${code}`
    let currentSearch = `?error=${code}`
    let currentPathname = "/login"
    let replaceCalled = false
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        origin: "http://localhost:5173",
        get pathname() {
          return currentPathname
        },
        get search() {
          return currentSearch
        },
        hash: "",
        get href() {
          return assignedHref ?? currentHref
        },
        set href(v: string) {
          assignedHref = v
        },
      } as unknown as Location,
    })
    const originalReplaceState = window.history.replaceState.bind(
      window.history,
    )
    window.history.replaceState = ((
      data: unknown,
      _unused: string,
      url?: string | URL | null,
    ) => {
      replaceCalled = true
      if (typeof url === "string") {
        currentHref = `http://localhost:5173${url}`
        const q = url.includes("?") ? url.slice(url.indexOf("?")) : ""
        currentSearch = q
        currentPathname = url.split("?")[0] ?? "/login"
      }
      return originalReplaceState(data as never, _unused, url ?? null)
    }) as typeof window.history.replaceState

    try {
      renderLogin()
      const banner = await screen.findByTestId("sso-error-banner")
      return {
        bannerText: banner.textContent ?? "",
        replaceCalled: () => replaceCalled,
        currentSearch: () => currentSearch,
      }
    } finally {
      window.history.replaceState = originalReplaceState
    }
  }

  it("surfaces the saml-not-implemented banner and strips the error param when present", async () => {
    const r = await runErrorParamCase("saml-not-implemented")
    expect(r.bannerText).toMatch(/SSO sign-in is not yet/i)
    expect(r.replaceCalled()).toBe(true)
    expect(r.currentSearch().includes("error=saml-not-implemented")).toBe(false)
  })

  it("surfaces the saml-signature-invalid message and strips the error param", async () => {
    const r = await runErrorParamCase("saml-signature-invalid")
    expect(r.bannerText).toMatch(/could not be verified/i)
    expect(r.bannerText).toMatch(/signing certificate/i)
    expect(r.replaceCalled()).toBe(true)
    expect(r.currentSearch().includes("error=saml-signature-invalid")).toBe(
      false,
    )
  })

  it("surfaces the saml-replay message and strips the error param", async () => {
    const r = await runErrorParamCase("saml-replay")
    expect(r.bannerText).toMatch(/already been used/i)
    expect(r.replaceCalled()).toBe(true)
    expect(r.currentSearch().includes("error=saml-replay")).toBe(false)
  })
})
