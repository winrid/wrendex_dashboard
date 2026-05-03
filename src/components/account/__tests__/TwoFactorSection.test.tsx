// 2FA setup wizard + disable dialog (P4 iter 2). Both code paths drive
// off the typed client; we mock useApiClient and walk through each step.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const get2faStatus = vi.fn()
const setup2fa = vi.fn()
const verify2fa = vi.fn()
const disable2fa = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    get2faStatus,
    setup2fa,
    verify2fa,
    disable2fa,
  }),
}))

// QRCode rendering returns a tiny stub data URL; we don't care what it
// looks like, just that the wizard advances past the scan step.
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub"),
  },
}))

import { TwoFactorSection } from "../TwoFactorSection"

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <TwoFactorSection />
    </QueryClientProvider>,
  )
}

describe("TwoFactorSection setup wizard", () => {
  afterEach(() => {
    cleanup()
    get2faStatus.mockReset()
    setup2fa.mockReset()
    verify2fa.mockReset()
    disable2fa.mockReset()
  })

  it("walks through setup -> verify and shows the backup codes", async () => {
    get2faStatus.mockResolvedValue({
      enabled: false,
      backupCodesRemaining: 0,
    })
    setup2fa.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUrl:
        "otpauth://totp/Wrendex:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Wrendex",
    })
    verify2fa.mockResolvedValue({
      backupCodes: [
        "ABCD1234",
        "EFGH5678",
        "IJKL9012",
        "MNOP3456",
        "QRST7890",
        "UVWX1234",
        "YZAB5678",
        "CDEF9012",
        "GHIJ3456",
        "KLMN7890",
      ],
    })

    renderSection()

    // Off state shows the Enable button.
    await waitFor(() => {
      expect(screen.getByTestId("two-factor-off")).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId("two-factor-enable"))

    // Step 1: intro -> Continue
    await waitFor(() => {
      expect(screen.getByTestId("two-factor-wizard")).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId("two-factor-continue"))

    // Step 2: scan QR + secret. setup2fa returns; secret + Next button render.
    await waitFor(() => {
      expect(setup2fa).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(
        (screen.getByTestId("two-factor-secret") as HTMLInputElement).value,
      ).toBe("JBSWY3DPEHPK3PXP")
    })

    fireEvent.click(screen.getByTestId("two-factor-scanned"))

    // Step 3: enter code + Verify.
    await waitFor(() => {
      expect(screen.getByTestId("two-factor-verify-code")).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId("two-factor-verify-code"), {
      target: { value: "123456" },
    })
    fireEvent.click(screen.getByTestId("two-factor-verify-submit"))

    await waitFor(() => {
      expect(verify2fa).toHaveBeenCalledWith("123456")
    })

    // Backup codes panel renders.
    await waitFor(() => {
      expect(screen.getByTestId("two-factor-backup-codes")).toBeTruthy()
    })
    const backupList = screen.getByTestId("two-factor-backup-codes")
    expect(backupList.textContent).toContain("ABCD1234")
    expect(backupList.textContent).toContain("KLMN7890")
  })
})

describe("TwoFactorSection disable dialog", () => {
  afterEach(() => {
    cleanup()
    get2faStatus.mockReset()
    setup2fa.mockReset()
    verify2fa.mockReset()
    disable2fa.mockReset()
  })

  it("submits the entered code via disable2fa", async () => {
    get2faStatus.mockResolvedValue({
      enabled: true,
      enabledAt: "2026-04-01T00:00:00Z",
      backupCodesRemaining: 7,
    })
    disable2fa.mockResolvedValue(undefined)

    renderSection()

    await waitFor(() => {
      expect(screen.getByTestId("two-factor-on")).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId("two-factor-disable-open"))

    await waitFor(() => {
      expect(screen.getByTestId("two-factor-disable-dialog")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("two-factor-disable-code"), {
      target: { value: "654321" },
    })
    fireEvent.click(screen.getByTestId("two-factor-disable-submit"))

    await waitFor(() => {
      expect(disable2fa).toHaveBeenCalledWith("654321")
    })
  })
})
