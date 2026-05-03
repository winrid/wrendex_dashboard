// Smoke test for the public /changelog page (plan section 13). Asserts:
//   1. Entries from listPublishedChangelog render.
//   2. The empty state surfaces when the list is empty.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ChangelogEntry } from "@/api/types"

const listPublishedChangelog = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listPublishedChangelog,
  }),
}))

import { Changelog } from "../Changelog"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/changelog"]}>
        <Changelog />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ENTRIES: ChangelogEntry[] = [
  {
    id: "c_1",
    slug: "ship-it",
    title: "Shipped a thing",
    body: "Description of thing.",
    tag: "NEW",
    publishedAt: "2026-04-29T00:00:00Z",
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
    createdByUserId: "u_admin",
  },
]

describe("Public Changelog page", () => {
  afterEach(() => {
    cleanup()
    listPublishedChangelog.mockReset()
  })

  it("renders entries from listPublishedChangelog", async () => {
    listPublishedChangelog.mockResolvedValue({
      items: ENTRIES,
      total: ENTRIES.length,
    })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("changelog-entry-ship-it")).toBeTruthy()
    })
    expect(screen.getByText(/Wrendex changelog/)).toBeTruthy()
    expect(screen.getByText(/Shipped a thing/)).toBeTruthy()
  })

  it("renders the empty state when there are no entries", async () => {
    listPublishedChangelog.mockResolvedValue({ items: [], total: 0 })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("public-changelog-empty")).toBeTruthy()
    })
  })
})
