// Smoke test for the cross-site Inbox. Mocks listSitesByTenant +
// listSiteAlerts at the typed-client boundary. Asserts:
//   1. The site picker switches the queried site.
//   2. Tab switching from Open to Resolved drives the right ?status param
//      through to listSiteAlerts.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Site, AlertQueryResult } from "@/api/types"

const listSitesByTenant = vi.fn()
const listSiteAlerts = vi.fn()
const ignoreAlert = vi.fn()
const unignoreAlert = vi.fn()
const snoozeAlert = vi.fn()
const unsnoozeAlert = vi.fn()
const assignAlert = vi.fn()
const bulkIgnore = vi.fn()
const bulkUnignore = vi.fn()
const bulkSnooze = vi.fn()
const bulkAssign = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listSitesByTenant,
    listSiteAlerts,
    ignoreAlert,
    unignoreAlert,
    snoozeAlert,
    unsnoozeAlert,
    assignAlert,
    bulkIgnore,
    bulkUnignore,
    bulkSnooze,
    bulkAssign,
  }),
}))

vi.mock("@/auth/AuthProvider", async () => {
  const { createContext } = await import("react")
  return {
    useAuth: () => ({
      user: { id: "u_1", email: "user@example.com", createdAt: "2026-04-30T00:00:00Z" },
      memberships: [
        { tenantId: "t_1", tenantName: "Acme", role: "OWNER" as const },
      ],
      activeTenantId: "t_1",
      isAuthed: true,
      isLoading: false,
    }),
    AuthContext: createContext<unknown>(null),
  }
})

import { Inbox } from "../Inbox"

function emptyResult(): AlertQueryResult {
  return { items: [], total: 0, page: 0, size: 25 }
}

function makeSite(id: string, url: string): Site {
  return {
    id,
    tenantId: "t_1",
    url,
    createdAt: "2026-04-30T00:00:00Z",
  } as unknown as Site
}

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/inbox"]}>
        <Routes>
          <Route path="/t/:tenantId/inbox" element={<Inbox />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Inbox", () => {
  afterEach(() => {
    cleanup()
    listSitesByTenant.mockReset()
    listSiteAlerts.mockReset()
    ignoreAlert.mockReset()
    unignoreAlert.mockReset()
    snoozeAlert.mockReset()
    unsnoozeAlert.mockReset()
    assignAlert.mockReset()
    bulkIgnore.mockReset()
    bulkUnignore.mockReset()
    bulkSnooze.mockReset()
    bulkAssign.mockReset()
  })

  it("queries the selected site and switches when the picker changes", async () => {
    listSitesByTenant.mockResolvedValue([
      makeSite("s_1", "https://acme.example"),
      makeSite("s_2", "https://other.example"),
    ])
    listSiteAlerts.mockResolvedValue(emptyResult())

    renderRoute()

    // First site auto-selected.
    await waitFor(() => {
      expect(listSiteAlerts).toHaveBeenCalled()
      const call = listSiteAlerts.mock.calls[0]
      expect(call?.[0]).toBe("s_1")
    })

    const picker = (await screen.findByLabelText("Site")) as HTMLSelectElement
    fireEvent.change(picker, { target: { value: "s_2" } })

    await waitFor(() => {
      const callArgs = listSiteAlerts.mock.calls.map((c) => c[0])
      expect(callArgs).toContain("s_2")
    })
  })

  it("calls bulkIgnore with the selected alert ids when the bulk Ignore button is clicked", async () => {
    listSitesByTenant.mockResolvedValue([makeSite("s_1", "https://acme.example")])
    listSiteAlerts.mockResolvedValue({
      items: [
        {
          id: "a_1",
          siteId: "s_1",
          crawlRunId: "c_1",
          pageUrl: "https://acme.example/a",
          type: "TITLE_MISSING",
          severity: "ERROR",
          message: "no title",
          createdAt: "2026-04-30T00:00:00Z",
          status: "OPEN",
          lastSeenAt: "2026-04-30T00:00:00Z",
          affectedUrls: [],
        },
        {
          id: "a_2",
          siteId: "s_1",
          crawlRunId: "c_1",
          pageUrl: "https://acme.example/b",
          type: "MISSING_ALT_TEXT",
          severity: "WARNING",
          message: "no alt",
          createdAt: "2026-04-30T00:00:00Z",
          status: "OPEN",
          lastSeenAt: "2026-04-30T00:00:00Z",
          affectedUrls: [],
        },
      ],
      total: 2,
      page: 0,
      size: 25,
    })
    bulkIgnore.mockResolvedValue({ updated: 2 })

    renderRoute()

    await waitFor(() => {
      expect(listSiteAlerts).toHaveBeenCalled()
    })

    // Toggle the two row checkboxes. Re-find each checkbox by id between
    // clicks so we get the latest reference (TanStack Table re-renders the
    // cell tree after the first selection update).
    const cb1 = await screen.findByTestId("alerts-select-a_1")
    fireEvent.click(cb1)
    await waitFor(() => {
      const refresh = screen.getByTestId("alerts-select-a_1") as HTMLElement
      expect(refresh.getAttribute("aria-checked")).toBe("true")
    })
    const cb2 = await screen.findByTestId("alerts-select-a_2")
    fireEvent.click(cb2)
    await waitFor(() => {
      const refresh = screen.getByTestId("alerts-select-a_2") as HTMLElement
      expect(refresh.getAttribute("aria-checked")).toBe("true")
    })

    // Toolbar appears once 1+ rows are selected.
    const ignoreBtn = await screen.findByTestId("bulk-ignore")
    fireEvent.click(ignoreBtn)

    await waitFor(() => {
      expect(bulkIgnore).toHaveBeenCalledTimes(1)
    })
    const ids = bulkIgnore.mock.calls[0]?.[0]
    expect(ids).toBeDefined()
    expect(Array.isArray(ids)).toBe(true)
    expect(ids).toContain("a_1")
    expect(ids).toContain("a_2")
  })

  it("passes status=OPEN on the Open tab and status=RESOLVED on the Resolved tab", async () => {
    listSitesByTenant.mockResolvedValue([makeSite("s_1", "https://acme.example")])
    listSiteAlerts.mockResolvedValue(emptyResult())

    renderRoute()

    await waitFor(() => {
      const lastParams = listSiteAlerts.mock.calls.at(-1)?.[1]
      expect(lastParams?.status).toBe("OPEN")
    })

    const resolvedTab = screen.getByRole("tab", { name: "Resolved" })
    // Radix Tabs reads mouse / pointer events; fireEvent.click alone is
    // sometimes not enough on jsdom because the trigger gates onValueChange
    // on a mousedown handler.
    fireEvent.mouseDown(resolvedTab, { button: 0 })
    fireEvent.click(resolvedTab)

    await waitFor(() => {
      const statuses = listSiteAlerts.mock.calls.map((c) => c[1]?.status)
      expect(statuses).toContain("RESOLVED")
    })
  })
})
