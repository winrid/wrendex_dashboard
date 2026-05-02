// Email channel editor. Asserts that switching the kind from MEMBERS to
// CUSTOM enables the recipients chip-input. Renders the editor through
// the Settings page so the live wiring is exercised.

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

describe("Email channel editor", () => {
  it("enables the recipients input after switching kind to CUSTOM", async () => {
    renderRoute()

    // Hop to the Tenant tab where the editor lives. Radix Tabs activates
    // on mouseDown, not click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tenant" }))

    // Default kind is MEMBERS - recipients chip-input is hidden.
    await waitFor(() => {
      expect(screen.queryByTestId("email-channel-recipients")).toBeNull()
    })

    // Click the CUSTOM radio.
    const customRadio = await screen.findByLabelText(
      "Custom recipients only",
    )
    fireEvent.click(customRadio)

    // Recipients chip-input becomes visible.
    await waitFor(() => {
      expect(screen.getByTestId("email-channel-recipients")).toBeTruthy()
    })
    expect(screen.getByLabelText("Recipient emails")).toBeTruthy()
  })
})
