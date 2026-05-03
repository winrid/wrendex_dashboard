// /shared/:token public route. Asserts:
//   1. 401 with passwordRequired=true renders the password form.
//   2. 200 SITE renders the read-only site overview WITHOUT the Run-audit
//      button.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/api/client"
import type { SharedLinkResult } from "@/api/types"

const resolveSharedLink = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({ resolveSharedLink }),
}))

import { SharedView } from "../SharedView"

function renderRoute(token: string = "tok_abc") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/shared/${token}`]}>
        <Routes>
          <Route path="/shared/:token" element={<SharedView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("SharedView", () => {
  afterEach(() => {
    cleanup()
    resolveSharedLink.mockReset()
  })

  it("renders the password form when the BE returns 401 passwordRequired", async () => {
    resolveSharedLink.mockRejectedValue(
      new ApiError(401, "Password required", { passwordRequired: true }),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("share-password-form")).toBeTruthy()
    })
    expect(screen.getByTestId("shared-password-input")).toBeTruthy()
    expect(screen.getByTestId("shared-password-submit")).toBeTruthy()
  })

  it("renders the read-only SITE overview WITHOUT a Run audit button", async () => {
    const result: SharedLinkResult = {
      share: {
        scope: "SITE",
        tenantName: "Acme Corp",
        siteDisplayName: "acme.example",
        expiresAt: null,
      },
      payload: {
        site: {
          id: "s_1",
          tenantId: "t_1",
          url: "https://acme.example",
          createdAt: "2026-04-30T00:00:00Z",
          lastCrawlAt: "2026-04-30T00:00:00Z",
          verifiedAt: "2026-04-30T00:00:00Z",
          cadence: "DAILY",
        },
        crawlRun: {
          id: "c_1",
          siteId: "s_1",
          startedAt: "2026-04-30T00:00:00Z",
          finishedAt: "2026-04-30T00:01:00Z",
          status: "completed",
          pagesDiscovered: 10,
          pagesCrawled: 10,
          healthScore: 92,
          errorCount: 1,
          warningCount: 2,
          noticeCount: 3,
        },
        healthScore: [
          {
            crawlRunId: "c_1",
            startedAt: "2026-04-30T00:00:00Z",
            healthScore: 92,
            errorCount: 1,
            warningCount: 2,
            noticeCount: 3,
          },
        ],
        issuesSummary: {
          totalIssues: 6,
          bySeverity: { ERROR: 1, WARNING: 2, NOTICE: 3 },
          byCategory: [
            {
              category: "Title",
              errorCount: 1,
              warningCount: 0,
              noticeCount: 0,
              byType: { TITLE_MISSING: 1 },
            },
          ],
        },
      },
    }
    resolveSharedLink.mockResolvedValue(result)

    renderRoute()

    // Banner appears with the tenant name.
    await waitFor(() => {
      expect(screen.getByTestId("shared-banner")).toBeTruthy()
    })
    expect(screen.getByText(/Read-only share from Acme Corp/i)).toBeTruthy()

    // The site display name renders.
    expect(screen.getByText("acme.example")).toBeTruthy()

    // The category from issuesSummary surfaces.
    expect(screen.getByText("Title")).toBeTruthy()

    // No Run-audit button - the action group from SiteDetail is owned by
    // SiteDetail itself, which we deliberately do NOT mount in the public
    // shared view (the public view renders its own read-only header).
    expect(screen.queryByText("Run audit now")).toBeNull()
    // No Settings link either.
    expect(screen.queryByText("Settings")).toBeNull()
  })
})
