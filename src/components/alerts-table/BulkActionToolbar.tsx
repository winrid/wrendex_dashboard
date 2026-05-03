// Bulk-action toolbar shown above the AlertsTable when one or more rows are
// selected (plan section 3). Backed by the typed-client bulk* methods. The
// toolbar collapses to nothing when `count === 0`.
//
// "Assign" surfaces the tenant member list when one is supplied; otherwise
// it falls back to assigning the alerts to the currently signed-in user only
// (the BE endpoint accepts userId=null to clear an assignment).

import type { Membership } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, XIcon } from "lucide-react"

export type BulkActionToolbarProps = {
  count: number
  /** Whether the current selection is in the Ignored bucket. Toggles the
   *  Ignore button to "Unignore". */
  ignoredBucket?: boolean
  onClear: () => void
  onIgnore?: () => void
  onUnignore?: () => void
  onSnooze: (durationHours: number) => void
  onSnoozeCustom?: () => void
  onAssign: (userId: string | null) => void
  /** Tenant members available for the Assign dropdown. When the BE has no
   *  membership endpoint, the parent passes the active-user-only fallback
   *  (one entry, current user). */
  members?: Array<{
    id: string
    label: string
  }>
  /** Disabled while a mutation is in-flight. */
  pending?: boolean
}

export function BulkActionToolbar({
  count,
  ignoredBucket,
  onClear,
  onIgnore,
  onUnignore,
  onSnooze,
  onSnoozeCustom,
  onAssign,
  members,
  pending,
}: BulkActionToolbarProps) {
  if (count === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2"
      data-testid="bulk-action-toolbar"
    >
      <span className="text-sm font-medium" data-testid="bulk-selected-count">
        {count} selected
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <XIcon />
      </Button>

      {ignoredBucket && onUnignore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUnignore}
          disabled={pending}
          data-testid="bulk-unignore"
        >
          Unignore {count}
        </Button>
      ) : onIgnore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onIgnore}
          disabled={pending}
          data-testid="bulk-ignore"
        >
          Ignore {count}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="bulk-snooze-trigger"
          >
            Snooze {count}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Snooze for</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onSnooze(24)
            }}
            data-testid="bulk-snooze-24h"
          >
            24 hours
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onSnooze(24 * 7)
            }}
            data-testid="bulk-snooze-7d"
          >
            7 days
          </DropdownMenuItem>
          {onSnoozeCustom ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onSnoozeCustom()
              }}
            >
              Custom...
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !members || members.length === 0}
            data-testid="bulk-assign-trigger"
          >
            Assign {count}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {members?.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onSelect={(e) => {
                e.preventDefault()
                onAssign(m.id)
              }}
              data-testid={`bulk-assign-${m.id}`}
            >
              {m.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onAssign(null)
            }}
            data-testid="bulk-assign-clear"
          >
            Clear assignment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Helper for parents that derive a member list from `useAuth().memberships`.
 *  Returns `[currentUser]` when no listTenantMembers endpoint is available so
 *  the dropdown still renders something useful in the BE-not-yet-shipped
 *  case. */
export function membershipsToMembers(
  membership: Membership | undefined,
  user: { id: string; email: string } | undefined,
): Array<{ id: string; label: string }> {
  if (!user) return []
  // The Membership type has no per-member list yet; the only known user is
  // the active session. Surface them so the menu is non-empty.
  return [
    {
      id: user.id,
      label: `${user.email}${
        membership ? ` (${membership.role.toLowerCase()})` : ""
      }`,
    },
  ]
}
