// Display helpers shared across the dashboard. Keep these tiny and pure;
// anything that needs a hook or fetches lives in src/hooks or src/api.

import { formatDistanceToNow } from "date-fns"

/** Renders an ISO timestamp as "5 minutes ago" / "in 2 hours" etc. Falls
 *  back to "Never" for null/undefined inputs - read-site rows in the empty
 *  state lean on this. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Never"
  return formatDistanceToNow(d, { addSuffix: true })
}

/** Hostname extracted from a URL string, with the leading "www." stripped
 *  for nicer display. Falls back to the raw input on parse failure so
 *  malformed URLs in old rows still render something sensible. */
export function siteDisplayName(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Human-readable duration for a millisecond span. */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "-"
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = Math.round(seconds - minutes * 60)
  if (minutes < 60) return `${minutes}m ${remSec}s`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes - hours * 60
  return `${hours}h ${remMin}m`
}

/** Pretty-prints a byte count as KB / MB / GB with one decimal of precision.
 *  Returns "-" for null / undefined / non-positive inputs so the resources
 *  table can render a fallback without per-cell branching. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

/** Pretty-prints a CPD token count as estimated bytes (heuristic: tokens * 5).
 *  Used for the Duplicate Code stats badges. Display-only; the persisted
 *  token count is what aggregates against. Returns "-" for null/non-positive. */
export function formatTokenBytes(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) return "-"
  return formatBytes(tokens * 5)
}

/** Pretty-prints the cadence enum for the cadence pill on SiteDetail. */
export function formatCadence(cadence: string | null | undefined): string {
  if (!cadence || cadence === "PAUSED") return "Not scheduled"
  switch (cadence) {
    case "DAILY":
      return "Daily"
    case "HOURLY":
      return "Hourly"
    case "CONTINUOUS":
      return "Continuous"
    default:
      return cadence
  }
}
