// Tiny CSV (or generic blob) download helper. Used by the per-report "Export
// CSV" buttons (plan section 4.9). The BE adds ?format=csv to every report
// endpoint; this helper appends the param to the current report URL,
// authenticated-fetches the response with the bearer header, and pipes the
// resulting blob through a temporary anchor so the browser triggers a
// download.
//
// Per AGENTS.md hard rule #1: no raw fetch in feature code. This helper IS a
// raw fetch, but it lives in src/lib (not feature code) and only ever
// downloads URLs the typed client knows how to construct. Feature code
// imports `downloadCsv` and `csvUrl` and never types a backend URL itself.

import { getAuthToken } from "@/api/useApiClient"

const DEFAULT_BASE_URL = "http://localhost:7070"

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv
  return DEFAULT_BASE_URL
}

/** Build a fully-qualified BE URL for `path` and any query params, then
 *  unconditionally tack on `?format=csv` (or merge with existing params).
 *  Path-only callers (e.g. when query params are already in `params`) pass
 *  no extras; preserves any existing pagination / filter params. */
export function csvUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>): string {
  const base = resolveBaseUrl().replace(/\/$/, "")
  const u = new URL(base + path)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue
      u.searchParams.set(k, String(v))
    }
  }
  u.searchParams.set("format", "csv")
  return u.toString()
}

export type DownloadCsvOptions = {
  /** Override the default fetch (for tests). */
  fetchImpl?: typeof fetch
  /** Override window (for tests so we can inspect URL.createObjectURL). */
  windowImpl?: typeof window
}

/**
 * Authenticated download of a server-generated file (CSV by default).
 * Fetches the URL with the global Bearer token, reads the response as a
 * blob, then triggers a browser download via a temporary anchor.
 *
 * Returns nothing; rejects on a non-2xx response so the caller can toast.
 */
export async function downloadCsv(
  url: string,
  filename: string,
  opts: DownloadCsvOptions = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const win = opts.windowImpl ?? (typeof window !== "undefined" ? window : undefined)

  const headers: Record<string, string> = {
    Accept: "text/csv, application/octet-stream, */*",
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchImpl(url, { method: "GET", headers })
  if (!res.ok) {
    throw new Error(
      `Download failed (${res.status} ${res.statusText || "error"})`,
    )
  }

  const blob = await res.blob()
  if (!win) {
    // Non-browser environment (SSR / tests without a DOM). Caller can still
    // observe success without an actual download being triggered.
    return
  }

  const objectUrl = win.URL.createObjectURL(blob)
  try {
    const a = win.document.createElement("a")
    a.href = objectUrl
    a.download = filename
    a.rel = "noopener"
    // Some browsers require the anchor to be in the document for the click
    // to dispatch.
    win.document.body.appendChild(a)
    a.click()
    win.document.body.removeChild(a)
  } finally {
    // Free the object URL on the next tick so the click had time to land.
    win.setTimeout(() => win.URL.revokeObjectURL(objectUrl), 0)
  }
}
