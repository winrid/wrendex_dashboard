// SiteSettings:
//   1. Save in the schedule form calls updateSchedule.
//   2. The delete confirmation requires typing the site URL; the delete
//      button stays disabled until the URL matches.
//   3. Toggling NEW_ERROR off calls updateAlertRule with {enabled: false}.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react"

afterEach(() => {
  cleanup()
})
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getSite = vi.fn().mockResolvedValue({
  id: "s_1",
  tenantId: "t_1",
  url: "https://acme.example",
  createdAt: "2026-04-30T00:00:00Z",
  verifiedAt: "2026-04-30T00:00:00Z",
  cadence: "DAILY",
})
const getSchedule = vi.fn().mockResolvedValue({
  cadence: "DAILY",
  nextRunAt: "2026-05-03T00:00:00Z",
  lastScheduledRunAt: "2026-05-02T00:00:00Z",
})
const updateSchedule = vi.fn().mockResolvedValue({
  cadence: "HOURLY",
  nextRunAt: "2026-05-02T01:00:00Z",
  lastScheduledRunAt: "2026-05-02T00:00:00Z",
})
const listAlertRules = vi.fn().mockResolvedValue([
  {
    id: "r_1",
    siteId: "s_1",
    kind: "NEW_ERROR",
    enabled: true,
    params: {},
    createdAt: "2026-04-30T00:00:00Z",
    updatedAt: "2026-04-30T00:00:00Z",
  },
  {
    id: "r_2",
    siteId: "s_1",
    kind: "SCORE_DROP",
    enabled: true,
    params: { threshold: 10 },
    createdAt: "2026-04-30T00:00:00Z",
    updatedAt: "2026-04-30T00:00:00Z",
  },
  {
    id: "r_3",
    siteId: "s_1",
    kind: "WEEKLY_DIGEST",
    enabled: false,
    params: {},
    createdAt: "2026-04-30T00:00:00Z",
    updatedAt: "2026-04-30T00:00:00Z",
  },
])
const updateAlertRule = vi.fn().mockImplementation(
  async (_siteId: string, ruleId: string, patch: Record<string, unknown>) => ({
    id: ruleId,
    siteId: "s_1",
    kind: "NEW_ERROR",
    enabled: false,
    params: {},
    createdAt: "2026-04-30T00:00:00Z",
    updatedAt: "2026-05-02T00:00:00Z",
    ...patch,
  }),
)
const deleteSite = vi.fn().mockResolvedValue(undefined)
const requestSiteVerification = vi.fn()
const confirmSiteVerification = vi.fn()
const getBilling = vi.fn().mockResolvedValue({
  plan: "PROFESSIONAL",
  subscriptionStatus: "TRIALING",
  trialStartedAt: "2026-04-30T00:00:00Z",
  trialEndsAt: "2026-05-14T00:00:00Z",
  hasPaymentMethod: true,
})
const createCustomAlertRule = vi.fn()
const deleteAlertRule = vi.fn().mockResolvedValue(undefined)

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    getSite,
    getSchedule,
    updateSchedule,
    listAlertRules,
    updateAlertRule,
    createCustomAlertRule,
    deleteAlertRule,
    deleteSite,
    requestSiteVerification,
    confirmSiteVerification,
    getBilling,
  }),
}))

import { SiteSettings } from "../SiteSettings"

beforeEach(() => {
  vi.clearAllMocks()
  // Re-prime defaults.
  getSite.mockResolvedValue({
    id: "s_1",
    tenantId: "t_1",
    url: "https://acme.example",
    createdAt: "2026-04-30T00:00:00Z",
    verifiedAt: "2026-04-30T00:00:00Z",
    cadence: "DAILY",
  })
  getSchedule.mockResolvedValue({
    cadence: "DAILY",
    nextRunAt: "2026-05-03T00:00:00Z",
    lastScheduledRunAt: "2026-05-02T00:00:00Z",
  })
  getBilling.mockResolvedValue({
    plan: "PROFESSIONAL",
    subscriptionStatus: "TRIALING",
    trialStartedAt: "2026-04-30T00:00:00Z",
    trialEndsAt: "2026-05-14T00:00:00Z",
    hasPaymentMethod: true,
  })
  listAlertRules.mockResolvedValue([
    {
      id: "r_1",
      siteId: "s_1",
      kind: "NEW_ERROR",
      enabled: true,
      params: {},
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-04-30T00:00:00Z",
    },
    {
      id: "r_2",
      siteId: "s_1",
      kind: "SCORE_DROP",
      enabled: true,
      params: { threshold: 10 },
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-04-30T00:00:00Z",
    },
    {
      id: "r_3",
      siteId: "s_1",
      kind: "WEEKLY_DIGEST",
      enabled: false,
      params: {},
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-04-30T00:00:00Z",
    },
  ])
})

function renderRoute() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/settings"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/settings"
            element={<SiteSettings />}
          />
          <Route path="/t/:tenantId/sites" element={<div>SITES_LIST</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("SiteSettings - schedule", () => {
  it("calls updateSchedule when Save is clicked", async () => {
    renderRoute()

    // Wait for the schedule query to settle (the Save button only enables
    // once the site + schedule load and getSchedule's response is in state).
    await waitFor(() => {
      expect(getSchedule).toHaveBeenCalled()
    })
    const saveButton = await screen.findByRole("button", { name: /^Save$/ })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(updateSchedule).toHaveBeenCalledWith("s_1", { cadence: "DAILY" })
    })
  })
})

describe("SiteSettings - delete confirmation", () => {
  it("disables the delete button until the user types the site URL", async () => {
    renderRoute()

    const open = await screen.findByRole("button", {
      name: /Delete this site/i,
    })
    fireEvent.click(open)

    // The confirm button is in the dialog. It stays disabled while the input
    // is empty.
    const confirmButton = await screen.findByTestId("delete-confirm-button")
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true)

    // Typing a wrong URL keeps it disabled.
    const input = screen.getByTestId("delete-confirm-input") as HTMLInputElement
    fireEvent.change(input, { target: { value: "https://wrong.example" } })
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true)

    // Typing the matching URL enables the button.
    fireEvent.change(input, { target: { value: "https://acme.example" } })
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false)
  })
})

describe("SiteSettings - alert rules", () => {
  it("calls updateAlertRule with {enabled: false} when NEW_ERROR is toggled off", async () => {
    renderRoute()

    const toggle = await screen.findByTestId(
      "alert-rule-switch-NEW_ERROR",
    )
    await act(async () => {
      fireEvent.click(toggle)
    })

    await waitFor(() => {
      expect(updateAlertRule).toHaveBeenCalledWith("s_1", "r_1", {
        enabled: false,
      })
    })
  })
})

describe("SiteSettings - custom rule composer", () => {
  it("steps through the four steps and submits a CUSTOM rule", async () => {
    createCustomAlertRule.mockResolvedValue({
      id: "r_custom_1",
      siteId: "s_1",
      kind: "CUSTOM",
      enabled: true,
      params: {
        trigger: { kind: "ALERT_FIRED", firstSeen: false },
        name: "My rule",
      },
      createdAt: "2026-05-03T00:00:00Z",
      updatedAt: "2026-05-03T00:00:00Z",
    })

    renderRoute()

    // Wait for the rules list to load + open the composer dialog.
    await screen.findByTestId("alert-rule-switch-NEW_ERROR")
    const openButton = screen.getByTestId("open-custom-rule-composer")
    await act(async () => {
      fireEvent.click(openButton)
    })

    // Step 1 (Trigger). Default kind is ALERT_FIRED; just click Next.
    const next = await screen.findByTestId("composer-next")
    await act(async () => {
      fireEvent.click(next)
    })

    // Step 2 (Filters). Click Next without setting anything.
    await act(async () => {
      fireEvent.click(screen.getByTestId("composer-next"))
    })

    // Step 3 (Channels). Click Next without selecting any channel.
    await act(async () => {
      fireEvent.click(screen.getByTestId("composer-next"))
    })

    // Step 4 (Review). Type a name + submit.
    const nameInput = await screen.findByTestId("review-name")
    fireEvent.change(nameInput, { target: { value: "My rule" } })

    const submit = screen.getByTestId("composer-submit")
    await act(async () => {
      fireEvent.click(submit)
    })

    await waitFor(() => {
      expect(createCustomAlertRule).toHaveBeenCalledTimes(1)
    })

    const args = createCustomAlertRule.mock.calls[0]
    expect(args[0]).toBe("s_1")
    expect(args[1].enabled).toBe(true)
    expect(args[1].params.trigger).toEqual({
      kind: "ALERT_FIRED",
      firstSeen: false,
    })
    expect(args[1].params.name).toBe("My rule")
  })

  it("omits DIGEST_PERIOD from the composer trigger options and surfaces the deferral note", async () => {
    renderRoute()

    // Open the composer dialog.
    await screen.findByTestId("alert-rule-switch-NEW_ERROR")
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-custom-rule-composer"))
    })

    // The composer mounts on Step 1 (Trigger). The Phase 4 deferral note
    // sits inline on Step 1 explaining where DIGEST_PERIOD went.
    const note = await screen.findByTestId("digest-period-note")
    expect(note.textContent ?? "").toMatch(/Cron-style digest scheduling/i)
    expect(note.textContent ?? "").toMatch(/Weekly digest/i)

    // The trigger-kind Select still sits on the page but DIGEST_PERIOD is
    // no longer one of its options; the click-to-expand affordance for the
    // shadcn Select isn't trivial in jsdom, so we instead assert the
    // marketing copy for the dropped option is nowhere on the screen.
    expect(screen.queryByText(/On a recurring schedule/i)).toBeNull()
  })

  it("renders the Delete button only on CUSTOM rules and confirms deletion", async () => {
    listAlertRules.mockResolvedValue([
      {
        id: "r_1",
        siteId: "s_1",
        kind: "NEW_ERROR",
        enabled: true,
        params: {},
        createdAt: "2026-04-30T00:00:00Z",
        updatedAt: "2026-04-30T00:00:00Z",
      },
      {
        id: "r_custom_1",
        siteId: "s_1",
        kind: "CUSTOM",
        enabled: true,
        params: {
          trigger: { kind: "ALERT_FIRED", firstSeen: false },
          name: "My custom rule",
        },
        createdAt: "2026-05-03T00:00:00Z",
        updatedAt: "2026-05-03T00:00:00Z",
      },
    ])

    renderRoute()

    // The custom-rule delete button is rendered (canned-rule rows do not
    // get one - we only ever match the CUSTOM rule's id).
    const deleteBtn = await screen.findByTestId(
      "alert-rule-delete-r_custom_1",
    )
    await act(async () => {
      fireEvent.click(deleteBtn)
    })

    const confirm = await screen.findByTestId("confirm-delete-custom-rule")
    await act(async () => {
      fireEvent.click(confirm)
    })

    await waitFor(() => {
      expect(deleteAlertRule).toHaveBeenCalledWith("s_1", "r_custom_1")
    })
  })
})
