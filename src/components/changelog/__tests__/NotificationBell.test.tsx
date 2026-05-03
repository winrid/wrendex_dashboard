// Smoke tests for the topbar bell + What's new badge (plan section 13).
// Asserts:
//   1. When unreadCount > 0 the badge is shown over the bell.
//   2. Clicking the bell opens the WhatsNewModal, which fetches +
//      renders entries and fires markChangelogSeen() on first render.

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
import type { ChangelogEntry, ChangelogResult } from "@/api/types"

const getUnreadChangelog = vi.fn()
const listPublishedChangelog = vi.fn()
const markChangelogSeen = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getUnreadChangelog,
    listPublishedChangelog,
    markChangelogSeen,
  }),
}))

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u_1", email: "u@example.com", createdAt: "2026-01-01" },
    memberships: [],
    activeTenantId: "t_1",
    isAuthed: true,
    isLoading: false,
    branding: null,
    logout: () => {},
    setActiveTenant: () => {},
  }),
}))

import { NotificationBell } from "@/components/layout/NotificationBell"

function renderBell() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE: ChangelogEntry[] = [
  {
    id: "c_1",
    slug: "first-entry",
    title: "Shipped the bell",
    body: "It rings.",
    tag: "NEW",
    publishedAt: "2026-04-14T00:00:00Z",
    createdAt: "2026-04-14T00:00:00Z",
    updatedAt: "2026-04-14T00:00:00Z",
    createdByUserId: "u_admin",
  },
  {
    id: "c_2",
    slug: "second-entry",
    title: "Fixed the bell tone",
    body: "Less jangly.",
    tag: "FIX",
    publishedAt: "2026-04-15T00:00:00Z",
    createdAt: "2026-04-15T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
    createdByUserId: "u_admin",
  },
]

const SAMPLE_RESULT: ChangelogResult = {
  items: SAMPLE,
  total: SAMPLE.length,
}

describe("NotificationBell", () => {
  afterEach(() => {
    cleanup()
    getUnreadChangelog.mockReset()
    listPublishedChangelog.mockReset()
    markChangelogSeen.mockReset()
  })

  it("renders the unread badge when unreadCount > 0", async () => {
    getUnreadChangelog.mockResolvedValue({
      unreadCount: 3,
      latestPublishedAt: "2026-04-15T00:00:00Z",
    })

    renderBell()

    await waitFor(() => {
      expect(screen.getByTestId("whats-new-bell-badge").textContent).toBe("3")
    })
  })

  it("caps the badge at 9+ for large unread counts", async () => {
    getUnreadChangelog.mockResolvedValue({
      unreadCount: 42,
      latestPublishedAt: "2026-04-15T00:00:00Z",
    })

    renderBell()

    await waitFor(() => {
      expect(screen.getByTestId("whats-new-bell-badge").textContent).toBe("9+")
    })
  })

  it("hides the badge when there are no unread entries", async () => {
    getUnreadChangelog.mockResolvedValue({
      unreadCount: 0,
      latestPublishedAt: null,
    })

    renderBell()

    await waitFor(() => {
      expect(getUnreadChangelog).toHaveBeenCalled()
    })
    expect(screen.queryByTestId("whats-new-bell-badge")).toBeNull()
  })

  it("opens the modal on click and fires markChangelogSeen + lists entries", async () => {
    getUnreadChangelog.mockResolvedValue({
      unreadCount: 2,
      latestPublishedAt: "2026-04-15T00:00:00Z",
    })
    listPublishedChangelog.mockResolvedValue(SAMPLE_RESULT)
    markChangelogSeen.mockResolvedValue(undefined)

    renderBell()

    const bell = await screen.findByTestId("whats-new-bell")
    fireEvent.click(bell)

    await waitFor(() => {
      expect(screen.getByTestId("whats-new-modal")).toBeTruthy()
    })
    await waitFor(() => {
      expect(markChangelogSeen).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(
        screen.getByTestId("changelog-entry-first-entry"),
      ).toBeTruthy()
      expect(
        screen.getByTestId("changelog-entry-second-entry"),
      ).toBeTruthy()
    })
    // listPublishedChangelog should have been called with the limit hint.
    expect(listPublishedChangelog).toHaveBeenCalledWith({ limit: 20 })
  })
})
