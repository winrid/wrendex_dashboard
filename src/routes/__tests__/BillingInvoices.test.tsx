// Smoke test: the Billing page renders the invoice list (rows + PDF link)
// when listInvoices returns items, and falls back to the empty-state copy
// when the list is empty.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getBilling = vi.fn().mockResolvedValue({
  plan: "PROFESSIONAL",
  subscriptionStatus: "ACTIVE",
  trialStartedAt: null,
  trialEndsAt: null,
  hasPaymentMethod: true,
})
const createCheckoutSession = vi.fn()
const createPortalSession = vi.fn()
const sendTelemetry = vi.fn()
const listInvoices = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getBilling,
    createCheckoutSession,
    createPortalSession,
    sendTelemetry,
    listInvoices,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u_1", email: "user@example.com", createdAt: "2026-05-01T00:00:00Z" },
    memberships: [{ tenantId: "t_1", tenantName: "Acme", role: "OWNER" }],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
    branding: null,
    signup: async () => {},
    signupWithOptionalClaim: async () => ({ tenantId: "t_1" }),
    login: async () => ({}),
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { Billing } from "../Billing"

beforeEach(() => {
  vi.clearAllMocks()
  try {
    window.localStorage.clear()
  } catch {
    // ignore
  }
  getBilling.mockResolvedValue({
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
    trialStartedAt: null,
    trialEndsAt: null,
    hasPaymentMethod: true,
  })
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      origin: "http://localhost:3000",
      pathname: "/t/t_1/billing",
      href: "http://localhost:3000/t/t_1/billing",
    },
  })
})

afterEach(() => {
  cleanup()
})

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/billing"]}>
        <Routes>
          <Route path="/t/:tenantId/billing" element={<Billing />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Billing invoice list", () => {
  it("renders the empty-state copy when listInvoices returns no items", async () => {
    listInvoices.mockResolvedValue({ items: [] })
    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invoices-card")).toBeTruthy()
    })
    await waitFor(() => {
      expect(
        screen.getByText(
          /No invoices yet\. Your first invoice will appear after your trial converts\./i,
        ),
      ).toBeTruthy()
    })
  })

  it("renders one row per invoice with the PDF link present", async () => {
    listInvoices.mockResolvedValue({
      items: [
        {
          id: "in_1",
          number: "ACME-0001",
          amount: 19900,
          currency: "usd",
          status: "paid",
          hostedInvoiceUrl: "https://invoice.stripe.com/i/acct/test/1",
          invoicePdfUrl: "https://invoice.stripe.com/i/acct/test/1/pdf",
          periodStart: "2026-04-01T00:00:00Z",
          periodEnd: "2026-05-01T00:00:00Z",
          paidAt: "2026-05-02T00:00:00Z",
          createdAt: "2026-05-01T00:00:00Z",
        },
      ],
    })

    renderRoute()
    await waitFor(() => {
      expect(screen.getByTestId("invoices-card")).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText("ACME-0001")).toBeTruthy()
    })
    expect(screen.getByTestId("invoice-status-in_1")).toBeTruthy()
    const pdfLink = screen.getByTestId("invoice-pdf-in_1") as HTMLAnchorElement
    expect(pdfLink.href).toContain("/pdf")
    const viewLink = screen.getByTestId("invoice-view-in_1") as HTMLAnchorElement
    expect(viewLink.href).toContain("invoice.stripe.com")
  })
})
