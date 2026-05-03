// Login 2FA flow (P4 iter 2). When client.login returns the
// twoFactorRequired shape the form swaps to a code-entry view; submitting
// the code calls login2fa with the pendingToken; on success the user is
// routed past the login screen.

import { afterEach, describe, expect, it, vi } from "vitest"
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

describe("Login 2FA flow", () => {
  afterEach(() => {
    cleanup()
    login.mockReset()
    login2fa.mockReset()
    getMe.mockReset()
  })

  it("renders the second-step input when login returns twoFactorRequired and submits the code via login2fa", async () => {
    login.mockResolvedValue({
      sessionToken: "pending-token-abc",
      twoFactorRequired: true,
    })
    login2fa.mockResolvedValue({
      sessionToken: "real-token-xyz",
      user: {
        id: "u_1",
        email: "user@example.com",
        createdAt: "2026-04-30T00:00:00Z",
      },
    })
    getMe.mockResolvedValue({
      user: {
        id: "u_1",
        email: "user@example.com",
        createdAt: "2026-04-30T00:00:00Z",
      },
      memberships: [{ tenantId: "t_1", tenantName: "Acme", role: "OWNER" }],
      activeTenantId: "t_1",
    })

    renderLogin()

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    // The second-step form renders with a code input.
    await waitFor(() => {
      expect(screen.getByTestId("two-factor-form")).toBeTruthy()
    })
    expect(screen.getByTestId("two-factor-code")).toBeTruthy()

    // The first call to login should have been made.
    expect(login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "hunter22",
    })

    // Submit the code; login2fa receives the pending token + code.
    fireEvent.change(screen.getByTestId("two-factor-code"), {
      target: { value: "123456" },
    })
    fireEvent.click(screen.getByTestId("two-factor-submit"))

    await waitFor(() => {
      expect(login2fa).toHaveBeenCalledTimes(1)
    })
    expect(login2fa).toHaveBeenCalledWith({
      pendingToken: "pending-token-abc",
      code: "123456",
    })
  })

  it("toggles to backup code mode and updates the input length when the link is clicked", async () => {
    login.mockResolvedValue({
      sessionToken: "pending-token-abc",
      twoFactorRequired: true,
    })

    renderLogin()

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByTestId("two-factor-form")).toBeTruthy()
    })

    const totpInput = screen.getByTestId("two-factor-code") as HTMLInputElement
    expect(totpInput.maxLength).toBe(6)

    fireEvent.click(screen.getByTestId("two-factor-toggle"))

    const backupInput = screen.getByTestId(
      "two-factor-code",
    ) as HTMLInputElement
    expect(backupInput.maxLength).toBe(8)
  })

  it("surfaces a 401 from login2fa as 'That code is incorrect.'", async () => {
    login.mockResolvedValue({
      sessionToken: "pending-token-abc",
      twoFactorRequired: true,
    })
    const ApiErrorMod = await import("@/api/client")
    login2fa.mockRejectedValue(
      new ApiErrorMod.ApiError(401, "Unauthorized", null),
    )

    renderLogin()

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter22" },
    })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByTestId("two-factor-form")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("two-factor-code"), {
      target: { value: "000000" },
    })
    fireEvent.click(screen.getByTestId("two-factor-submit"))

    await waitFor(() => {
      expect(screen.getByTestId("two-factor-error").textContent).toMatch(
        /That code is incorrect/i,
      )
    })
  })
})
