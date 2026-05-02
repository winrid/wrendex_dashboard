// Smoke test for the reusable AlertsTable. Renders rows with severity
// dots and confirms the ignore action fires the callback for an OPEN
// alert. The table itself is a thin wrapper around DataTable, so the test
// stays at the rendered-DOM level.

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { PaginationState, SortingState } from "@tanstack/react-table"
import type { Alert } from "@/api/types"
import {
  AlertsTable,
  type AlertsTableToolbarState,
} from "../AlertsTable"

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "a_1",
    pageId: "p_1",
    siteId: "s_1",
    crawlRunId: "c_1",
    pageUrl: "https://acme.example/about",
    type: "TITLE_MISSING",
    severity: "ERROR",
    message: "Page has no title.",
    detail: null,
    createdAt: "2026-04-30T00:00:00Z",
    status: "OPEN",
    lastSeenAt: "2026-04-30T00:00:00Z",
    resolvedAt: null,
    expiresAt: null,
    affectedUrls: ["https://acme.example/about"],
    ...overrides,
  }
}

const TOOLBAR: AlertsTableToolbarState = {
  pageUrlContains: "",
  severities: [],
  categories: [],
  status: undefined,
}

const PAGINATION: PaginationState = { pageIndex: 0, pageSize: 25 }
const SORTING: SortingState = []

describe("AlertsTable", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders rows with severity, category, and the catalog title", () => {
    const data = [
      makeAlert({ id: "a_1", type: "TITLE_MISSING", severity: "ERROR" }),
      makeAlert({
        id: "a_2",
        type: "MISSING_ALT_TEXT",
        severity: "WARNING",
        pageUrl: "https://acme.example/img",
      }),
    ]

    render(
      <AlertsTable
        data={data}
        total={2}
        pagination={PAGINATION}
        onPaginationChange={() => {}}
        sorting={SORTING}
        onSortingChange={() => {}}
        toolbar={TOOLBAR}
        onToolbarChange={() => {}}
      />,
    )

    // Severity tags
    expect(screen.getByText("ERROR")).toBeTruthy()
    expect(screen.getByText("WARNING")).toBeTruthy()
    // Catalog-mapped categories
    expect(screen.getByText("Title")).toBeTruthy()
    expect(screen.getByText("Images")).toBeTruthy()
    // Catalog-mapped titles
    expect(screen.getByText("Page title missing")).toBeTruthy()
    expect(screen.getByText("Missing alt text")).toBeTruthy()
  })

  it("invokes onIgnore when the ignore action fires for an OPEN alert", () => {
    const onIgnore = vi.fn()
    const data = [makeAlert({ id: "a_1", status: "OPEN" })]
    render(
      <AlertsTable
        data={data}
        total={1}
        pagination={PAGINATION}
        onPaginationChange={() => {}}
        sorting={SORTING}
        onSortingChange={() => {}}
        toolbar={TOOLBAR}
        onToolbarChange={() => {}}
        onIgnore={onIgnore}
      />,
    )

    const ignoreBtn = screen.getByRole("button", { name: /Ignore/ })
    fireEvent.click(ignoreBtn)
    expect(onIgnore).toHaveBeenCalledTimes(1)
    expect(onIgnore.mock.calls[0]?.[0]?.id).toBe("a_1")
  })
})
