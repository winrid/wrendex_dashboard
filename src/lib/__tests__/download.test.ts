// Smoke test for the CSV download helper. Asserts that csvUrl preserves
// query params + appends format=csv, and that downloadCsv pipes the blob
// through a temporary anchor.

import { describe, expect, it, vi } from "vitest"
import { csvUrl, downloadCsv } from "../download"

describe("csvUrl", () => {
  it("appends format=csv and preserves provided params", () => {
    const url = csvUrl("/api/crawls/c1/pages/explore", {
      page: 0,
      size: 50,
      statusCode: 404,
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get("format")).toBe("csv")
    expect(parsed.searchParams.get("page")).toBe("0")
    expect(parsed.searchParams.get("size")).toBe("50")
    expect(parsed.searchParams.get("statusCode")).toBe("404")
    expect(parsed.pathname).toBe("/api/crawls/c1/pages/explore")
  })

  it("drops null / undefined / empty params", () => {
    const url = csvUrl("/api/crawls/c1/pages/explore", {
      page: 0,
      sort: undefined,
      dir: null,
      filter: "",
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.has("sort")).toBe(false)
    expect(parsed.searchParams.has("dir")).toBe(false)
    expect(parsed.searchParams.has("filter")).toBe(false)
    expect(parsed.searchParams.get("format")).toBe("csv")
  })
})

describe("downloadCsv", () => {
  it("authenticated-fetches the URL and triggers an anchor click", async () => {
    const blob = new Blob(["a,b,c"], { type: "text/csv" })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
    } as unknown as Response)

    const click = vi.fn()
    const append = vi.fn()
    const remove = vi.fn()
    const winImpl = {
      URL: {
        createObjectURL: vi.fn(() => "blob:mock-url"),
        revokeObjectURL: vi.fn(),
      },
      document: {
        createElement: vi.fn(() => ({
          click,
          set href(_: string) {},
          set download(_: string) {},
          set rel(_: string) {},
        })),
        body: { appendChild: append, removeChild: remove },
      },
      setTimeout: (cb: () => void) => cb(),
    } as unknown as typeof window

    await downloadCsv(
      "http://localhost:7070/api/foo?format=csv",
      "foo.csv",
      { fetchImpl, windowImpl: winImpl },
    )

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
  })

  it("rejects on non-2xx and surfaces a useful message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Error",
      blob: async () => new Blob(),
    } as unknown as Response)

    await expect(
      downloadCsv("http://localhost:7070/api/foo", "foo.csv", { fetchImpl }),
    ).rejects.toThrow(/Download failed/)
  })
})
