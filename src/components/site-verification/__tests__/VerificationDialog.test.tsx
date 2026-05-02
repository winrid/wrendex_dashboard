// Smoke test for the ownership verification dialog. We mock the typed API
// client at the useApiClient module boundary so the test never touches the
// network and can assert the rendered token + instructions after a click.

import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const requestSiteVerification = vi.fn()
const confirmSiteVerification = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    requestSiteVerification,
    confirmSiteVerification,
  }),
}))

import { VerificationDialog } from "../VerificationDialog"

function withQuery(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("VerificationDialog", () => {
  it("renders generated token + instructions after Generate token", async () => {
    requestSiteVerification.mockResolvedValueOnce({
      method: "DNS_TXT",
      token: "wrendex-verify=abc123",
      instructions:
        "Add a TXT record at _wrendex.example.com with value wrendex-verify=abc123",
    })

    render(
      withQuery(
        <VerificationDialog
          siteId="s_1"
          open={true}
          onOpenChange={() => {}}
        />,
      ),
    )

    expect(screen.getByText("Verify site ownership")).toBeTruthy()

    const generateBtn = screen.getAllByRole("button", {
      name: /generate token/i,
    })[0]!
    await act(async () => {
      fireEvent.click(generateBtn)
    })

    await waitFor(() => {
      expect(screen.getByText("wrendex-verify=abc123")).toBeTruthy()
    })
    expect(
      screen.getByText(/Add a TXT record at _wrendex\.example\.com/),
    ).toBeTruthy()
    expect(requestSiteVerification).toHaveBeenCalledWith("s_1", {
      method: "DNS_TXT",
    })
  })
})
