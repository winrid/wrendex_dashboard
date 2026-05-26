// Smoke test for the notification log (plan section 4A.5). Asserts:
//  1. Rows render from listNotificationLog.
//  2. Toggling the channel filter narrows the API params.
//  3. The Resend button calls resendNotification with the row's channel.

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
import type {
  NotificationLogEntry,
  NotificationLogResult,
} from "@/api/types"

const listNotificationLog = vi.fn()
const resendNotification = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listNotificationLog,
    resendNotification,
  }),
}))

import { NotificationLog } from "../NotificationLog"

function makeEntry(
  id: string,
  channel: NotificationLogEntry["channel"],
  status: NotificationLogEntry["status"] = "SENT",
): NotificationLogEntry {
  return {
    id,
    tenantId: "t_1",
    channel,
    recipient: `${channel.toLowerCase()}@example.com`,
    subject: `Alert: ${channel}`,
    status,
    alertType: "TITLE_MISSING",
    alertId: "alert_1",
    attemptCount: 1,
    lastErrorMessage: null,
    queuedAt: "2026-04-30T10:00:00Z",
    sentAt: "2026-04-30T10:00:01Z",
    siteId: "s_1",
  }
}

function makeResult(items: NotificationLogEntry[]): NotificationLogResult {
  return { items, total: items.length, page: 0, size: 25 }
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
      <MemoryRouter initialEntries={["/t/t_1/notifications/log"]}>
        <Routes>
          <Route
            path="/t/:tenantId/notifications/log"
            element={<NotificationLog />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("NotificationLog", () => {
  afterEach(() => {
    cleanup()
    listNotificationLog.mockReset()
    resendNotification.mockReset()
  })

  it("renders rows from listNotificationLog", async () => {
    listNotificationLog.mockResolvedValue(
      makeResult([
        makeEntry("d_1", "EMAIL"),
        makeEntry("d_2", "SLACK"),
      ]),
    )
    resendNotification.mockResolvedValue({ newDeliveryId: "d_99" })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("email@example.com")).toBeTruthy()
    })
    expect(screen.getByText("slack@example.com")).toBeTruthy()
    // Each row exposes a Resend button.
    expect(screen.getAllByRole("button", { name: "Resend" }).length).toBe(2)
  })

  it("narrows the API params when the channel filter is selected", async () => {
    listNotificationLog.mockResolvedValue(makeResult([]))

    renderRoute()

    await waitFor(() => {
      expect(listNotificationLog).toHaveBeenCalled()
    })
    listNotificationLog.mockClear()

    const trigger = screen.getByTestId("channel-filter")
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(trigger)
    const emailItem = await screen.findByRole("menuitem", { name: "EMAIL" })
    fireEvent.click(emailItem)
    await waitFor(() => {
      const last = listNotificationLog.mock.calls.at(-1)
      expect(last?.[1]?.channel).toBe("EMAIL")
    })
  })

  it("resend triggers the typed-client method with the row's channel", async () => {
    listNotificationLog.mockResolvedValue(
      makeResult([makeEntry("d_1", "EMAIL")]),
    )
    resendNotification.mockResolvedValue({ newDeliveryId: "d_99" })

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText("email@example.com")).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "Resend" }))
    await waitFor(() => {
      expect(resendNotification).toHaveBeenCalled()
    })
    expect(resendNotification.mock.calls[0][2]).toEqual({ channel: "EMAIL" })
  })

  it("renders the empty state when the BE 404s", async () => {
    const ApiErrorMod = await import("@/api/client")
    listNotificationLog.mockRejectedValue(
      new ApiErrorMod.ApiError(404, "Not Found", null),
    )

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId("notification-log-coming-soon")).toBeTruthy()
    })
  })
})
