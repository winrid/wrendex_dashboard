// Sidebar -> route handoff for the "Saved views" sidebar group (plan section
// P4 iter 1, task 3). The sidebar resolves a clicked SavedView into its
// React Router URL, stashes the parsed filterJson in sessionStorage under a
// well-known key, and navigates to the route. The destination route reads
// the key on mount via consumePendingSavedView() and applies it to its
// state, then clears the slot so a refresh doesn't re-apply.

const KEY = "wrendex.pendingSavedView"

type Pending = {
  id: string
  route: string
  filter: unknown
}

export function stashPendingSavedView(input: Pending): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(input))
  } catch {
    // ignore quota / disabled storage
  }
}

/** Reads + clears the pending handoff. Returns null when none is set or
 *  when the route doesn't match (so a stale handoff for a different surface
 *  doesn't leak into a fresh navigation). */
export function consumePendingSavedView(route: string): unknown | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Pending
    window.sessionStorage.removeItem(KEY)
    if (parsed.route !== route) return null
    return parsed.filter
  } catch {
    try {
      window.sessionStorage.removeItem(KEY)
    } catch {
      // ignore
    }
    return null
  }
}
