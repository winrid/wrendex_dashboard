// SavedViewMenu: clicking "Save current view" submits createSavedView with
// the consumer-supplied filter; clicking a segment hands its parsed
// filterJson back via the onApply callback.

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
import type { SavedView } from "@/api/types"

const listSavedViews = vi.fn()
const createSavedView = vi.fn()
const updateSavedView = vi.fn()
const deleteSavedView = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listSavedViews,
    createSavedView,
    updateSavedView,
    deleteSavedView,
  }),
}))

vi.mock("@/auth/AuthProvider", async () => {
  const { createContext } = await import("react")
  const value = {
    user: { id: "u_1", email: "u@example.com", createdAt: "2026-04-30T00:00:00Z" },
    memberships: [],
    activeTenantId: "t_1",
    isLoading: false,
    isAuthed: true,
    branding: null,
  }
  return {
    useAuth: () => value,
    // The SavedViewMenu reads AuthContext directly with useContext so it can
    // gracefully no-op when no provider is mounted. The mock context exposes
    // the same shape as useAuth so ownership detection still works.
    AuthContext: createContext<typeof value | null>(value),
  }
})

import { SavedViewMenu } from "@/components/saved-views/SavedViewMenu"

function makeView(over: Partial<SavedView> = {}): SavedView {
  return {
    id: "v_1",
    tenantId: "t_1",
    siteId: "s_1",
    ownerUserId: "u_1",
    name: "404 cluster",
    route: "/sites/:siteId/crawls/:crawlId/pages",
    filterJson: JSON.stringify({ statusCodes: [404], urlContains: "" }),
    shared: false,
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
    ...over,
  }
}

function renderMenu(props: {
  currentFilter: unknown
  onApply: (f: unknown) => void
}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/crawls/c_1/pages"]}>
        <SavedViewMenu
          siteId="s_1"
          route="/sites/:siteId/crawls/:crawlId/pages"
          currentFilter={props.currentFilter}
          onApply={props.onApply}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("SavedViewMenu", () => {
  afterEach(() => {
    cleanup()
    listSavedViews.mockReset()
    createSavedView.mockReset()
    updateSavedView.mockReset()
    deleteSavedView.mockReset()
  })

  it("submits createSavedView when the user saves the current view", async () => {
    listSavedViews.mockResolvedValue([])
    createSavedView.mockResolvedValue(makeView({ name: "My segment" }))

    const onApply = vi.fn()
    const filter = { statusCodes: [500], urlContains: "/admin" }
    renderMenu({ currentFilter: filter, onApply })

    // Open the dropdown. Radix DropdownMenu opens on pointerDown, not click.
    const trigger = screen.getByTestId("saved-views-trigger")
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)

    // Click "Save current view..." -> opens the dialog.
    const saveItem = await screen.findByTestId("saved-view-save-current")
    fireEvent.click(saveItem)

    await waitFor(() => {
      expect(screen.getByTestId("saved-view-save-dialog")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("saved-view-name-input"), {
      target: { value: "My segment" },
    })
    fireEvent.click(screen.getByTestId("saved-view-save-submit"))

    await waitFor(() => {
      expect(createSavedView).toHaveBeenCalledTimes(1)
    })

    const [tenantId, input] = createSavedView.mock.calls[0]
    expect(tenantId).toBe("t_1")
    expect(input).toMatchObject({
      siteId: "s_1",
      name: "My segment",
      route: "/sites/:siteId/crawls/:crawlId/pages",
      shared: false,
    })
    // The captured filter is round-tripped through JSON.
    expect(JSON.parse(input.filterJson)).toEqual(filter)
  })

  it("calls onApply with the parsed filter when a segment is clicked", async () => {
    const view = makeView({
      id: "v_42",
      filterJson: JSON.stringify({ statusCodes: [404, 500], urlContains: "x" }),
    })
    listSavedViews.mockResolvedValue([view])

    const onApply = vi.fn()
    renderMenu({ currentFilter: { statusCodes: [], urlContains: "" }, onApply })

    const trigger = screen.getByTestId("saved-views-trigger")
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)

    const apply = await screen.findByTestId("saved-view-apply-v_42")
    fireEvent.click(apply)

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({
      statusCodes: [404, 500],
      urlContains: "x",
    })
  })
})
