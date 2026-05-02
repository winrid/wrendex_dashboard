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
