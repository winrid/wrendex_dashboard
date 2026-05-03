// Smoke tests for the staff-only changelog admin route (plan section 13).
// Asserts:
//   1. STAFF gate: 403 from listAdminChangelog renders "You don't have
//      access" and hides the New entry button.
//   2. Happy path: rows render; the New-entry dialog calls
//      createChangelogEntry with the typed input.
//   3. Duplicate slug surfaces the 409 inline against the slug field.

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
import type { ChangelogEntry } from "@/api/types"
import { ApiError } from "@/api/client"

const listAdminChangelog = vi.fn()
const createChangelogEntry = vi.fn()
const updateChangelogEntry = vi.fn()
const deleteChangelogEntry = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listAdminChangelog,
    createChangelogEntry,
    updateChangelogEntry,
    deleteChangelogEntry,
  }),
}))

import { AdminChangelog } from "../AdminChangelog"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/changelog"]}>
        <AdminChangelog />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE: ChangelogEntry[] = [
  {
    id: "c_1",
    slug: "first-entry",
    title: "First entry",
    body: "Body text",
    tag: "NEW",
    publishedAt: "2026-04-14T00:00:00Z",
    createdAt: "2026-04-14T00:00:00Z",
    updatedAt: "2026-04-14T00:00:00Z",
    createdByUserId: "u_admin",
  },
  {
    id: "c_2",
    slug: "draft-entry",
    title: "Draft entry",
    body: "Not published yet",
    tag: "IMPROVED",
    publishedAt: null,
    createdAt: "2026-04-15T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
    createdByUserId: "u_admin",
  },
]

describe("AdminChangelog", () => {
  afterEach(() => {
    cleanup()
    listAdminChangelog.mockReset()
    createChangelogEntry.mockReset()
    updateChangelogEntry.mockReset()
    deleteChangelogEntry.mockReset()
  })

  it("renders 'You don't have access' when the BE 403s", async () => {
    listAdminChangelog.mockRejectedValue(new ApiError(403, "Forbidden", null))

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("changelog-no-access")).toBeTruthy()
    })
    expect(screen.queryByTestId("changelog-new-entry-button")).toBeNull()
  })

  it("renders entries from listAdminChangelog with includeDrafts", async () => {
    listAdminChangelog.mockResolvedValue(SAMPLE)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("first-entry")).toBeTruthy()
      expect(screen.getByText("draft-entry")).toBeTruthy()
    })
    expect(listAdminChangelog).toHaveBeenCalledWith({ includeDrafts: true })
    // The draft entry's publishedAt cell renders the literal "Draft".
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
  })

  it("calls createChangelogEntry from the New-entry dialog", async () => {
    listAdminChangelog.mockResolvedValue(SAMPLE)
    createChangelogEntry.mockResolvedValue({
      ...SAMPLE[0],
      id: "c_new",
      slug: "new-thing",
    })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("changelog-new-entry-button")).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId("changelog-new-entry-button"))

    const slug = await screen.findByTestId("changelog-slug-input")
    fireEvent.change(slug, { target: { value: "new-thing" } })
    fireEvent.change(screen.getByTestId("changelog-title-input"), {
      target: { value: "New thing" },
    })
    fireEvent.change(screen.getByTestId("changelog-body-input"), {
      target: { value: "Wrote a new thing." },
    })

    fireEvent.click(screen.getByTestId("changelog-submit-button"))

    await waitFor(() => {
      expect(createChangelogEntry).toHaveBeenCalledTimes(1)
    })
    const call = createChangelogEntry.mock.calls[0][0]
    expect(call.slug).toBe("new-thing")
    expect(call.title).toBe("New thing")
    expect(call.body).toBe("Wrote a new thing.")
    expect(call.tag).toBe("NEW")
    // No publish toggle / no datetime: publishedAt should be null (draft).
    expect(call.publishedAt).toBeNull()
  })

  it("surfaces a 409 duplicate-slug error inline against the slug field", async () => {
    listAdminChangelog.mockResolvedValue(SAMPLE)
    createChangelogEntry.mockRejectedValue(
      new ApiError(409, "Slug taken", { error: "duplicate-slug" }),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("changelog-new-entry-button")).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId("changelog-new-entry-button"))

    const slug = await screen.findByTestId("changelog-slug-input")
    fireEvent.change(slug, { target: { value: "first-entry" } })
    fireEvent.change(screen.getByTestId("changelog-title-input"), {
      target: { value: "Conflicting title" },
    })

    fireEvent.click(screen.getByTestId("changelog-submit-button"))

    await waitFor(() => {
      expect(screen.getByTestId("changelog-slug-error").textContent).toMatch(
        /already taken/i,
      )
    })
    // Dialog stays open so the user can retry with a different slug.
    expect(screen.getByTestId("changelog-entry-dialog")).toBeTruthy()
  })
})
