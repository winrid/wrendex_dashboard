// Topbar bell + What's new badge (plan section 13).
//
// Polls getUnreadChangelog() every 60s. Renders a small numeric badge
// (capped at "9+") over the bell when unreadCount > 0. Clicking the bell
// opens the WhatsNewModal, which fires markChangelogSeen() once on first
// render so the badge clears the next time the poll fires.
//
// The query is silently disabled when the user is signed out (the route
// only mounts inside RequireAuth, but the test seam exposes the prop so we
// can mount the bell from a public surface in the future without it
// firing an authenticated request).

import { useState } from "react"
import { Bell } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/auth/AuthProvider"
import { WhatsNewModal } from "@/components/changelog/WhatsNewModal"
import { cn } from "@/lib/utils"

const UNREAD_REFRESH_MS = 60_000

function formatBadge(count: number): string {
  if (count <= 0) return ""
  if (count > 9) return "9+"
  return String(count)
}

export type NotificationBellProps = {
  /** Test seam: when set, overrides the auth-driven enable check. */
  enabled?: boolean
}

export function NotificationBell({ enabled }: NotificationBellProps) {
  const client = useApiClient()
  const { isAuthed } = useAuth()
  const [open, setOpen] = useState(false)

  const isEnabled = enabled ?? isAuthed

  const unreadQ = useQuery({
    queryKey: ["whats-new", "unread"],
    queryFn: () => client.getUnreadChangelog(),
    enabled: isEnabled,
    refetchInterval: isEnabled ? UNREAD_REFRESH_MS : false,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const unread = unreadQ.data?.unreadCount ?? 0
  const showBadge = unread > 0
  const badgeText = formatBadge(unread)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative"
        aria-label="What's new"
        data-testid="whats-new-bell"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" />
        {showBadge ? (
          <span
            className={cn(
              "pointer-events-none absolute -right-0.5 -top-0.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground",
              "h-[14px]",
            )}
            data-testid="whats-new-bell-badge"
          >
            {badgeText}
          </span>
        ) : null}
      </Button>
      <WhatsNewModal open={open} onOpenChange={setOpen} />
    </>
  )
}
