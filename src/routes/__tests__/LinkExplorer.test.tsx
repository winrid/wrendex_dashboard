// Smoke test for the Link Explorer. Mocks the typed client at the
// useApiClient module boundary. Asserts:
//   1. The type filter (All / Internal / External) drives the BE `type`
//      query param through to exploreLinks.
//   2. The nofollow rel filter narrows the rendered rows on the loaded
//      page (client-side filter).
//   3. Clicking the row "Detail" trigger opens the popover and surfaces
//      the canonical target URL.

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
import type { LinkEntry, LinkResult } from "@/api/types"

const exploreLinks = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    exploreLinks,
  }),
}))

import { LinkExplorer } from "../LinkExplorer"

function makeLink(
  source: string,
  target: string,
  external: boolean,
  nofollow: boolean,
  status = 200,
  anchor = "click here",
): LinkEntry {
  return {
    sourceUrl: source,
    targetUrl: target,
    anchorText: anchor,
    nofollow,
    context: "a",
    external,
    targetStatusCode: status,
  }
}

function makeResult(links: LinkEntry[]): LinkResult {
  return { links, total: links.length, page: 0, size: 50 }
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
      <MemoryRouter
        initialEntries={["/t/t_1/sites/s_1/crawls/c_1/links"]}
      >
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/links"
            element={<LinkExplorer />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("LinkExplorer", () => {
  afterEach(() => {
    cleanup()
    exploreLinks.mockReset()
  })

  it("type filter drives the BE `type` param through to exploreLinks", async () => {
    exploreLinks.mockResolvedValue(
      makeResult([
        makeLink(
          "https://acme.example/",
          "https://acme.example/about",
          false,
          false,
        ),
      ]),
    )

    renderRoute()

    await waitFor(() => {
      expect(exploreLinks).toHaveBeenCalled()
    })
    // First call passes type=undefined (All).
    expect(exploreLinks.mock.calls[0]?.[1]?.type).toBeUndefined()
    exploreLinks.mockClear()

    // Switch to Internal.
    const trigger = screen.getByRole("button", { name: /Type filter/ })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)
    const internal = await screen.findByRole("menuitemradio", {
      name: "Internal",
    })
    fireEvent.click(internal)

    await waitFor(() => {
      const last = exploreLinks.mock.calls.at(-1)
      expect(last?.[1]?.type).toBe("internal")
    })

    // And switch to External.
    exploreLinks.mockClear()
    const trigger2 = screen.getByRole("button", { name: /Type filter/ })
    fireEvent.pointerDown(trigger2, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger2)
    const external = await screen.findByRole("menuitemradio", {
      name: "External",
    })
    fireEvent.click(external)

    await waitFor(() => {
      const last = exploreLinks.mock.calls.at(-1)
      expect(last?.[1]?.type).toBe("external")
    })
  })

  it("nofollow filter narrows the rendered rows", async () => {
    exploreLinks.mockResolvedValue(
      makeResult([
        makeLink(
          "https://acme.example/",
          "https://acme.example/follow",
          false,
          false,
          200,
          "follow link",
        ),
        makeLink(
          "https://acme.example/",
          "https://acme.example/nofollow",
          false,
          true,
          200,
          "nofollow link",
        ),
      ]),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("https://acme.example/follow")).toBeTruthy()
    })
    expect(screen.getByText("https://acme.example/nofollow")).toBeTruthy()

    // Open the rel filter and toggle nofollow only.
    const trigger = screen.getByRole("button", { name: /Rel filter/ })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)
    const nofollow = await screen.findByRole("menuitemcheckbox", {
      name: /nofollow only/,
    })
    fireEvent.click(nofollow)

    await waitFor(() => {
      expect(
        screen.queryByText("https://acme.example/follow"),
      ).toBeNull()
    })
    expect(screen.getByText("https://acme.example/nofollow")).toBeTruthy()
  })

  it("row detail popover opens and surfaces the canonical target URL", async () => {
    exploreLinks.mockResolvedValue(
      makeResult([
        makeLink(
          "https://acme.example/",
          "https://acme.example/canonical-target",
          false,
          false,
          200,
          "anchor copy",
        ),
      ]),
    )

    renderRoute()

    const detailButton = await screen.findByRole("button", {
      name: /Open link detail/,
    })
    fireEvent.pointerDown(detailButton, { button: 0, pointerType: "mouse" })
    fireEvent.click(detailButton)

    // Popover surfaces the canonical target + anchor copy.
    await waitFor(() => {
      const matches = screen.getAllByText(
        "https://acme.example/canonical-target",
      )
      expect(matches.length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/anchor copy/).length).toBeGreaterThan(0)
  })
})
