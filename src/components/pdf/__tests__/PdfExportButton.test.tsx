// Smoke test: clicking the PDF export button calls the download helper
// with the absolute BE URL the consumer supplied. We mock the helper so
// no network / DOM-anchor click is exercised.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const downloadPdfMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("@/lib/download", async () => {
  const actual = await vi.importActual<typeof import("@/lib/download")>(
    "@/lib/download",
  )
  return {
    ...actual,
    downloadPdf: (...args: unknown[]) => downloadPdfMock(...args),
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}))

import { PdfExportButton } from "../PdfExportButton"
import { DownloadError } from "@/lib/download"

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function renderButton(props: React.ComponentProps<typeof PdfExportButton>) {
  return render(
    <MemoryRouter>
      <PdfExportButton {...props} />
    </MemoryRouter>,
  )
}

describe("PdfExportButton", () => {
  it("calls downloadPdf with the resolved BE URL when clicked", async () => {
    downloadPdfMock.mockResolvedValueOnce(undefined)
    renderButton({
      path: "/api/crawls/c_1/pages/pdf",
      filename: "page-explorer-c_1.pdf",
      tenantId: "t_1",
    })
    fireEvent.click(screen.getByTestId("pdf-export-button"))
    await waitFor(() => {
      expect(downloadPdfMock).toHaveBeenCalledTimes(1)
    })
    const [url, filename] = downloadPdfMock.mock.calls[0]!
    expect(typeof url).toBe("string")
    expect(url).toMatch(/\/api\/crawls\/c_1\/pages\/pdf$/)
    expect(filename).toBe("page-explorer-c_1.pdf")
  })

  it("toasts the upgrade prompt when the BE returns 403", async () => {
    downloadPdfMock.mockRejectedValueOnce(
      new DownloadError(403, "Download failed (403 Forbidden)"),
    )
    renderButton({
      path: "/api/crawls/c_1/pages/pdf",
      filename: "page-explorer-c_1.pdf",
      tenantId: "t_1",
    })
    fireEvent.click(screen.getByTestId("pdf-export-button"))
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    })
    const [message] = toastErrorMock.mock.calls[0]!
    expect(message).toMatch(/Professional or Agency plan/i)
  })
})
