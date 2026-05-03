// What's new modal (plan section 13). Opened from the topbar bell in
// AppShell. On open the modal calls listPublishedChangelog({limit:20}) and
// fires markChangelogSeen() once on first render so the bell badge clears.
//
// react-markdown is intentionally NOT a dependency (see AGENTS.md - no
// new deps for v1). The body is rendered as plain text with whitespace
// preserved via `whitespace-pre-line`; the BE-supplied markdown reads
// fine at this scale.
//
// The footer link routes the user to the public /changelog page.

import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import type { ChangelogEntry, ChangelogTag } from "@/api/types"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function tagBadgeClasses(tag: ChangelogTag): string {
  switch (tag) {
    case "NEW":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "IMPROVED":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    case "FIX":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "BREAKING":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Draft"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Draft"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export type ChangelogEntryRowProps = {
  entry: ChangelogEntry
}

export function ChangelogEntryRow({ entry }: ChangelogEntryRowProps) {
  return (
    <div
      className="border-b py-4 last:border-b-0"
      data-testid={`changelog-entry-${entry.slug}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(entry.publishedAt)}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            tagBadgeClasses(entry.tag),
          )}
          data-testid="changelog-entry-tag"
        >
          {entry.tag}
        </span>
        <h3 className="text-sm font-semibold">{entry.title}</h3>
      </div>
      {entry.body ? (
        <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
          {entry.body}
        </p>
      ) : null}
    </div>
  )
}

export type WhatsNewModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhatsNewModal({ open, onOpenChange }: WhatsNewModalProps) {
  const client = useApiClient()
  const didMarkSeen = useRef(false)

  const listQ = useQuery({
    queryKey: ["whats-new", "published", 20],
    queryFn: () => client.listPublishedChangelog({ limit: 20 }),
    enabled: open,
    staleTime: 30_000,
  })

  // Fire markChangelogSeen exactly once per modal open. The BE clears the
  // unread cursor; the bell-badge poll picks it up on the next tick.
  useEffect(() => {
    if (!open) {
      didMarkSeen.current = false
      return
    }
    if (didMarkSeen.current) return
    didMarkSeen.current = true
    void client.markChangelogSeen().catch(() => {
      // Best-effort. If the BE 4xxs we leave the badge alone; the user can
      // re-open the modal once the BE settles.
    })
  }, [open, client])

  const items = listQ.data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="whats-new-modal"
      >
        <DialogHeader>
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>
            Recent changes shipped to Wrendex.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {listQ.isLoading ? (
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-testid="whats-new-loading"
            >
              Loading recent changes...
            </div>
          ) : items.length === 0 ? (
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-testid="whats-new-empty"
            >
              No changelog entries yet.
            </div>
          ) : (
            <div data-testid="whats-new-list">
              {items.map((entry) => (
                <ChangelogEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" asChild>
            <Link to="/changelog" onClick={() => onOpenChange(false)}>
              View full changelog
            </Link>
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
