// Sharing tab: lists share links from listShareLinks; the per-row
// Revoke button calls revokeShareLink.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ShareLink } from "@/api/types"

const listShareLinks = vi.fn()
const revokeShareLink = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({ listShareLinks, revokeShareLink }),
}))

import { SharingTab } from "@/components/share/SharingTab"

function makeShare(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: "sl_1",
    tenantId: "t_1",
    scope: "CRAWL_REPORT",
    targetId: "s_1",
    subResource: "redirects",
    token: "tok_abc",
    url: "https://app.example/shared/tok_abc",
    label: "Q3 audit",
    passwordProtected: false,
    createdAt: "2026-05-02T00:00:00Z",
    expiresAt: null,
    revokedAt: null,
    lastViewedAt: null,
    createdByUserId: null,
    createdByEmail: null,
    viewCount: 7,
    planLimit: null,
    planUsed: null,
    ...overrides,
  }
}

function renderTab() {
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
          <Route
            path="/t/:tenantId/settings"
            element={<SharingTab tenantId="t_1" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Sharing tab", () => {
  afterEach(() => {
    cleanup()
    listShareLinks.mockReset()
    revokeShareLink.mockReset()
  })

  it("lists share links and Revoke calls revokeShareLink", async () => {
    listShareLinks.mockResolvedValue([
      makeShare({ id: "sl_1", label: "Q3 audit" }),
      makeShare({
        id: "sl_2",
        label: "Site overview for Bob",
        scope: "SITE",
        subResource: null,
      }),
    ])
    revokeShareLink.mockResolvedValue(undefined)

    renderTab()

    await waitFor(() => {
      expect(screen.getByText("Q3 audit")).toBeTruthy()
    })
    expect(screen.getByText("Site overview for Bob")).toBeTruthy()

    // The Revoke button for sl_1 should call revokeShareLink with that id.
    const revoke = screen.getByTestId("share-revoke-sl_1")
    fireEvent.click(revoke)

    await waitFor(() => {
      expect(revokeShareLink).toHaveBeenCalledTimes(1)
    })
    expect(revokeShareLink.mock.calls[0]).toEqual(["t_1", "sl_1"])
  })
})
