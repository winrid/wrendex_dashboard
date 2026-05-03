// Smoke tests for the reusable invite-member dialog (plan section 14.2).
// Asserts:
//   1. Submit calls createInvite(tenantId, {email, role}) on the typed
//      client.
//   2. A 409 from the BE surfaces the "already a pending invite" inline
//      error against the email field.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const createInvite = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    createInvite,
  }),
}))

import { InviteMemberDialog } from "@/components/team/InviteMemberDialog"
import { ApiError } from "@/api/client"

function renderOpen() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InviteMemberDialog
          tenantId="t_1"
          open={true}
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...utils, onOpenChange, onCreated }
}

describe("InviteMemberDialog", () => {
  afterEach(() => {
    cleanup()
    createInvite.mockReset()
  })

  it("calls createInvite with the entered email and the default role", async () => {
    createInvite.mockResolvedValue({
      id: "i_1",
      tenantId: "t_1",
      email: "new@example.com",
      role: "EDITOR",
      invitedByUserId: "u_owner",
      invitedByEmail: "owner@example.com",
      createdAt: "2026-04-30T00:00:00Z",
      expiresAt: "2026-05-07T00:00:00Z",
      acceptedAt: null,
    })

    renderOpen()

    const emailInput = await screen.findByTestId("invite-email-input")
    fireEvent.change(emailInput, { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByTestId("invite-submit"))

    await waitFor(() => {
      expect(createInvite).toHaveBeenCalledTimes(1)
    })
    const args = createInvite.mock.calls[0]
    expect(args[0]).toBe("t_1")
    expect(args[1]).toEqual({ email: "new@example.com", role: "EDITOR" })
  })

  it("surfaces a 409 as an inline 'already pending' error", async () => {
    createInvite.mockRejectedValue(
      new ApiError(409, "Conflict", { message: "duplicate invite" }),
    )

    renderOpen()

    const emailInput = await screen.findByTestId("invite-email-input")
    fireEvent.change(emailInput, { target: { value: "dup@example.com" } })
    fireEvent.click(screen.getByTestId("invite-submit"))

    const err = await screen.findByTestId("invite-email-error")
    expect(err.textContent).toMatch(/already a pending invite/i)
  })

  it("surfaces seat-cap errors with an upgrade prompt", async () => {
    createInvite.mockRejectedValue(
      new ApiError(403, "Forbidden", { message: "seat limit reached" }),
    )

    renderOpen()

    const emailInput = await screen.findByTestId("invite-email-input")
    fireEvent.change(emailInput, { target: { value: "more@example.com" } })
    fireEvent.click(screen.getByTestId("invite-submit"))

    const cap = await screen.findByTestId("invite-seat-cap")
    expect(cap.textContent).toMatch(/seat limit/i)
    // The Upgrade in Billing link is wired to the tenant's billing page.
    const link = cap.querySelector("a")
    expect(link?.getAttribute("href")).toBe("/t/t_1/billing")
  })
})
