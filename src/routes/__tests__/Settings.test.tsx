// Smoke test: the Settings page renders the three tabs and switching
// between them swaps the visible content.

import { describe, expect, it, vi, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

afterEach(() => {
  cleanup()
})
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getEmailChannel = vi.fn().mockResolvedValue({
  id: "ec_1",
  tenantId: "t_1",
  kind: "MEMBERS",
  recipients: [],
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z",
})
const updateEmailChannel = vi.fn()
const listSitesByTenant = vi.fn().mockResolvedValue([])
const changePassword = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getEmailChannel,
    updateEmailChannel,
    listSitesByTenant,
    changePassword,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u_1", email: "user@example.com", createdAt: "2026-05-01T00:00:00Z" },
    memberships: [
      { tenantId: "t_1", tenantName: "Acme Corp", role: "OWNER" },
    ],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => {},
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Settings } from "../Settings"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/settings"]}>
        <Routes>
          <Route path="/t/:tenantId/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Settings page", () => {
  it("renders the three tabs and switches content when clicked", async () => {
    renderRoute()

    // Account tab is the default; the email field is visible.
    expect(screen.getByRole("tab", { name: "Account" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Tenant" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Sites" })).toBeTruthy()
    const emailField = screen.getByLabelText("Email") as HTMLInputElement
    expect(emailField.value).toBe("user@example.com")

    // Switch to Tenant tab. Radix Tabs activates on mouseDown, not click;
    // fireEvent.click alone doesn't toggle the controlled value.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Workspace name")).toBeTruthy()
    })
    expect(
      (screen.getByLabelText("Workspace name") as HTMLInputElement).value,
    ).toBe("Acme Corp")

    // Switch to Sites tab.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sites" }))
    await waitFor(() => {
      // Either the empty state or the list renders. With listSitesByTenant
      // returning [], the empty-state copy lands.
      expect(screen.getByText(/No sites yet/i)).toBeTruthy()
    })
  })
})
