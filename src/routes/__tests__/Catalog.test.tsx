// Smoke tests for the Catalog explorer (plan section 6 / sec 0.3e iter 2).
// Mocks the typed client at the boundary so we can exercise:
//   1. BE catalog hydration -> entries render.
//   2. The search bar narrows visible entries.
//   3. The category sidebar narrows visible entries.

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
import type { PublicCatalogEntry } from "@/api/types"
import { resetHydrationState } from "@/api/checkCatalog"

const getPublicCatalog = vi.fn()
const listSitesByTenant = vi.fn()
const listSiteAlerts = vi.fn()
const listCrawlsBySite = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getPublicCatalog,
    listSitesByTenant,
    listSiteAlerts,
    listCrawlsBySite,
  }),
}))

import { Catalog } from "../Catalog"

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/catalog"]}>
        <Routes>
          <Route path="/t/:tenantId/catalog" element={<Catalog />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE_BE_CATALOG: PublicCatalogEntry[] = [
  {
    type: "TITLE_MISSING",
    category: "Title",
    severityDefault: "ERROR",
    title: "Page title missing",
    description: "BE description for missing title",
    howToFix: "Add a title tag.",
    marketingId: "title.missing",
  },
  {
    type: "MISSING_ALT_TEXT",
    category: "Images",
    severityDefault: "WARNING",
    title: "Missing alt text",
    description: "BE description for missing alt",
    howToFix: "Add alt text.",
    marketingId: "img.alt-missing",
  },
]

describe("Catalog explorer", () => {
  afterEach(() => {
    cleanup()
    getPublicCatalog.mockReset()
    listSitesByTenant.mockReset()
    listSiteAlerts.mockReset()
    listCrawlsBySite.mockReset()
    // Reset the module-level hydration cache so each test re-fetches.
    resetHydrationState()
  })

  it("renders catalog entries hydrated from the BE", async () => {
    getPublicCatalog.mockResolvedValue(SAMPLE_BE_CATALOG)
    listSitesByTenant.mockResolvedValue([])
    listCrawlsBySite.mockResolvedValue([])

    renderRoute()

    await waitFor(() => {
      // Static entries always render even before BE hydration; hitting the
      // BE-flavoured title proves the merge is wired.
      expect(screen.getByTestId("catalog-entry-TITLE_MISSING")).toBeTruthy()
      expect(screen.getByTestId("catalog-entry-MISSING_ALT_TEXT")).toBeTruthy()
    })
  })

  it("filters entries via the search bar", async () => {
    getPublicCatalog.mockResolvedValue([])
    listSitesByTenant.mockResolvedValue([])
    listCrawlsBySite.mockResolvedValue([])

    renderRoute()

    // wait for first render
    await screen.findByText(/Check catalog/)

    const search = screen.getByLabelText("Search catalog") as HTMLInputElement
    fireEvent.change(search, { target: { value: "viewport" } })

    await waitFor(() => {
      // The static catalog has a "Missing viewport meta" check.
      expect(screen.getByText(/Missing viewport meta/i)).toBeTruthy()
    })
    // And TITLE_MISSING (which doesn't match "viewport") should be gone.
    expect(screen.queryByTestId("catalog-entry-TITLE_MISSING")).toBeNull()
  })

  it("narrows entries when a category is picked from the sidebar", async () => {
    getPublicCatalog.mockResolvedValue([])
    listSitesByTenant.mockResolvedValue([])
    listCrawlsBySite.mockResolvedValue([])

    renderRoute()

    // Click the "Title" category in the sidebar.
    const titleBtn = await screen.findByTestId("catalog-cat-Title")
    fireEvent.click(titleBtn)

    await waitFor(() => {
      // Title-only entries should still be there.
      expect(screen.getByTestId("catalog-entry-TITLE_MISSING")).toBeTruthy()
      // An Images-category entry should be filtered out.
      expect(screen.queryByTestId("catalog-entry-MISSING_ALT_TEXT")).toBeNull()
    })
  })

  it("defaults the 'Show only firing' toggle to ON when a site is selected and hides zero-count rows", async () => {
    getPublicCatalog.mockResolvedValue(SAMPLE_BE_CATALOG)
    listSitesByTenant.mockResolvedValue([
      { id: "s_1", url: "https://acme.example/", tenantId: "t_1" } as never,
    ])
    listCrawlsBySite.mockResolvedValue([])

    // Per-type listSiteAlerts call: TITLE_MISSING fires (total=3),
    // MISSING_ALT_TEXT does not (total=0). Anything else returns 0 too.
    listSiteAlerts.mockImplementation(
      async (
        _siteId: string,
        opts: { type?: string },
      ) => {
        const total = opts.type === "TITLE_MISSING" ? 3 : 0
        return { items: [], total, page: 0, size: 1 }
      },
    )

    renderRoute()

    // Toggle is rendered and ON by default once a site is selected (the
    // useEffect auto-picks the first site after sitesQ resolves).
    const toggle = await screen.findByTestId("catalog-firing-toggle")
    await waitFor(() => {
      expect(toggle.getAttribute("data-state")).toBe("checked")
    })

    // Wait for the firing-count badge on TITLE_MISSING to land. Once it's
    // rendered every other row's count query has also resolved (they all
    // resolve to 0 via the mock).
    await waitFor(() => {
      expect(screen.getByTestId("catalog-firing-TITLE_MISSING")).toBeTruthy()
    })

    // The zero-count row is hidden when the toggle is ON.
    await waitFor(() => {
      expect(screen.queryByTestId("catalog-entry-MISSING_ALT_TEXT")).toBeNull()
    })
    // The firing row is visible.
    expect(screen.getByTestId("catalog-entry-TITLE_MISSING")).toBeTruthy()
  })

  it("reveals zero-count rows after toggling 'Show only firing' OFF", async () => {
    getPublicCatalog.mockResolvedValue(SAMPLE_BE_CATALOG)
    listSitesByTenant.mockResolvedValue([
      { id: "s_1", url: "https://acme.example/", tenantId: "t_1" } as never,
    ])
    listCrawlsBySite.mockResolvedValue([])
    listSiteAlerts.mockImplementation(
      async (
        _siteId: string,
        opts: { type?: string },
      ) => {
        const total = opts.type === "TITLE_MISSING" ? 3 : 0
        return { items: [], total, page: 0, size: 1 }
      },
    )

    renderRoute()

    // Wait for the default-ON state to settle (zero-count row hidden).
    await waitFor(() => {
      expect(screen.queryByTestId("catalog-entry-MISSING_ALT_TEXT")).toBeNull()
      expect(screen.getByTestId("catalog-entry-TITLE_MISSING")).toBeTruthy()
    })

    // Toggle OFF.
    const toggle = await screen.findByTestId("catalog-firing-toggle")
    fireEvent.click(toggle)

    // Zero-count row reappears.
    await waitFor(() => {
      expect(screen.getByTestId("catalog-entry-MISSING_ALT_TEXT")).toBeTruthy()
    })
    expect(screen.getByTestId("catalog-entry-TITLE_MISSING")).toBeTruthy()
  })
})
