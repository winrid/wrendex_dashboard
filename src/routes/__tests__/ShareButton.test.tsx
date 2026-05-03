// ShareButton: clicking opens the dialog; submitting calls
// createShareLink with the right scope/target/subResource.

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

const createShareLink = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({ createShareLink }),
}))

import { ShareButton } from "@/components/share/ShareButton"

function renderButton() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t_1/sites/s_1/crawls/c_1/redirects"]}>
        <Routes>
          <Route
            path="/t/:tenantId/sites/:siteId/crawls/:crawlId/redirects"
            element={
              <ShareButton
                scope="CRAWL_REPORT"
                targetId="s_1"
                subResource="redirects"
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("ShareButton", () => {
  afterEach(() => {
    cleanup()
    createShareLink.mockReset()
  })

  it("opens a dialog and submits createShareLink with the right scope/target", async () => {
    createShareLink.mockResolvedValue({
      id: "sl_1",
      tenantId: "t_1",
      scope: "CRAWL_REPORT",
      targetId: "s_1",
      subResource: "redirects",
      token: "tok_abc",
      url: "https://app.example/shared/tok_abc",
      passwordProtected: false,
      createdAt: "2026-05-02T00:00:00Z",
    })

    renderButton()

    // Click the trigger to open the dialog.
    const trigger = screen.getByTestId("share-button")
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByTestId("share-dialog")).toBeTruthy()
    })

    // Submit immediately - all dialog fields are optional.
    const submit = screen.getByTestId("share-submit")
    fireEvent.click(submit)

    await waitFor(() => {
      expect(createShareLink).toHaveBeenCalledTimes(1)
    })
    const args = createShareLink.mock.calls[0]
    expect(args[0]).toBe("t_1")
    expect(args[1]).toMatchObject({
      scope: "CRAWL_REPORT",
      targetId: "s_1",
      subResource: "redirects",
      expiresAt: null,
    })
    // No password / label supplied -> the create call should omit them.
    expect(args[1].password).toBeUndefined()
    expect(args[1].label).toBeUndefined()

    // The success view shows the share URL.
    await waitFor(() => {
      const input = screen.getByTestId("share-url-input") as HTMLInputElement
      expect(input.value).toBe("https://app.example/shared/tok_abc")
    })
  })

  it("forwards label, password and expiry from the form", async () => {
    createShareLink.mockResolvedValue({
      id: "sl_2",
      tenantId: "t_1",
      scope: "CRAWL_REPORT",
      targetId: "s_1",
      subResource: "redirects",
      token: "tok_xyz",
      url: "https://app.example/shared/tok_xyz",
      passwordProtected: true,
      createdAt: "2026-05-02T00:00:00Z",
    })

    renderButton()

    fireEvent.click(screen.getByTestId("share-button"))
    await waitFor(() => {
      expect(screen.getByTestId("share-dialog")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("share-label-input"), {
      target: { value: "Q3 audit for client X" },
    })
    fireEvent.change(screen.getByTestId("share-password-input"), {
      target: { value: "hunter2" },
    })

    fireEvent.click(screen.getByTestId("share-submit"))
    await waitFor(() => {
      expect(createShareLink).toHaveBeenCalledTimes(1)
    })
    const args = createShareLink.mock.calls[0]
    expect(args[1]).toMatchObject({
      scope: "CRAWL_REPORT",
      targetId: "s_1",
      subResource: "redirects",
      label: "Q3 audit for client X",
      password: "hunter2",
      expiresAt: null,
    })
  })
})
