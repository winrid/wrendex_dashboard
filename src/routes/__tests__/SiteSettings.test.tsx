// SiteSettings:
//   1. Save in the schedule form calls updateSchedule.
//   2. The delete confirmation requires typing the site URL; the delete
//      button stays disabled until the URL matches.
//   3. Toggling NEW_ERROR off calls updateAlertRule with {enabled: false}.

import React from "react"
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

// Radix Select doesn't open in jsdom (no real PointerEvents / popover layer),
// so we replace it with a tiny native <select>-backed implementation for these
// tests. The mock keeps the same API surface used by SiteSettings (Root,
// Trigger, Content, Item, Value) plus a forwarded data-testid on Trigger so
// the existing tests that read Trigger by testid keep working.
vi.mock("@/components/ui/select", () => {
  type ItemDescriptor = { value: string; label: React.ReactNode }
  function collectItems(node: React.ReactNode, out: ItemDescriptor[]): void {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      const c = child as React.ReactElement<{
        value?: string
        children?: React.ReactNode
      }>
      if (
        typeof c.type === "function" &&
        (c.type as { displayName?: string }).displayName === "SelectItem"
      ) {
        if (typeof c.props.value === "string") {
          out.push({ value: c.props.value, label: c.props.children })
        }
        return
      }
      if (c.props && c.props.children !== undefined) {
        collectItems(c.props.children, out)
      }
    })
  }
  function Select({
    value,
    defaultValue,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string
    defaultValue?: string
    onValueChange?: (next: string) => void
    children?: React.ReactNode
    disabled?: boolean
  }) {
    const items: ItemDescriptor[] = []
    collectItems(children, items)
    let triggerProps: Record<string, unknown> = {}
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      const c = child as React.ReactElement<Record<string, unknown>>
      if (
        typeof c.type === "function" &&
        (c.type as { displayName?: string }).displayName === "SelectTrigger"
      ) {
        triggerProps = { ...c.props }
      }
    })
    const id =
      typeof triggerProps.id === "string" ? triggerProps.id : undefined
    const testid =
      typeof triggerProps["data-testid"] === "string"
        ? (triggerProps["data-testid"] as string)
        : undefined
    return (
      <select
        id={id}
        data-testid={testid}
        value={value ?? defaultValue ?? items[0]?.value ?? ""}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {typeof it.label === "string" ? it.label : it.value}
          </option>
        ))}
      </select>
    )
  }
  function SelectTrigger(_: { children?: React.ReactNode }) {
    return null
  }
  ;(SelectTrigger as { displayName?: string }).displayName = "SelectTrigger"
  function SelectContent({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  }
  function SelectItem({ children }: { children?: React.ReactNode; value: string }) {
    return <>{children}</>
  }
  ;(SelectItem as { displayName?: string }).displayName = "SelectItem"
  function SelectValue() {
    return null
  }
  function SelectGroup({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  }
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup }
})

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

  it("submits a DIGEST_PERIOD CUSTOM rule with the chosen cron when the trigger kind is switched", async () => {
    createCustomAlertRule.mockResolvedValue({
      id: "r_custom_digest",
      siteId: "s_1",
      kind: "CUSTOM",
      enabled: true,
      params: {
        trigger: { kind: "DIGEST_PERIOD", cron: "WEEKLY" },
      },
      createdAt: "2026-05-03T00:00:00Z",
      updatedAt: "2026-05-03T00:00:00Z",
    })

    renderRoute()

    // Open the composer dialog.
    await screen.findByTestId("alert-rule-switch-NEW_ERROR")
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-custom-rule-composer"))
    })

    // Step 1 - switch the trigger kind to DIGEST_PERIOD. The shared mocked
    // Select (defined at module scope above) renders as a native <select>
    // that exposes the data-testid we hand to SelectTrigger.
    const triggerKind = (await screen.findByTestId(
      "trigger-kind-select",
    )) as HTMLSelectElement
    await act(async () => {
      fireEvent.change(triggerKind, { target: { value: "DIGEST_PERIOD" } })
    })

    // The cron sub-Select renders only when DIGEST_PERIOD is the active kind.
    const cronSelect = await screen.findByTestId("trigger-digest-cron")
    expect(cronSelect).toBeTruthy()

    // Step 1 -> Step 2 -> Step 3 -> Step 4. Take the defaults at each step
    // (the cron defaults to WEEKLY).
    await act(async () => {
      fireEvent.click(screen.getByTestId("composer-next"))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId("composer-next"))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId("composer-next"))
    })

    const submit = await screen.findByTestId("composer-submit")
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
      kind: "DIGEST_PERIOD",
      cron: "WEEKLY",
    })
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
