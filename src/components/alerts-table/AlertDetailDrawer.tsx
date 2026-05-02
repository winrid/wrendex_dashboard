// Side-sheet that backs the inbox row click and the per-AlertType drill-in
// row click. Pulls catalog content for "why this matters" / "how to fix"
// and renders the raw backend message + detail underneath. Ignore /
// unignore actions are wired by the parent route via callback props so the
// query cache stays a single source of truth.

import { Link } from "react-router-dom"
import { ExternalLinkIcon, EyeOffIcon, EyeIcon } from "lucide-react"
import type { Alert } from "@/api/types"
import { getCheck } from "@/api/checkCatalog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type AlertDetailDrawerProps = {
  alert: Alert | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tenant + site context, used for "Open in page detail" deep links. */
  tenantId: string
  siteId: string
  onIgnore?: (alert: Alert) => void
  onUnignore?: (alert: Alert) => void
}

function severityBadgeClass(sev: Alert["severity"]): string {
  switch (sev) {
    case "ERROR":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    case "WARNING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "NOTICE":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  }
}

export function AlertDetailDrawer({
  alert,
  open,
  onOpenChange,
  tenantId,
  siteId,
  onIgnore,
  onUnignore,
}: AlertDetailDrawerProps) {
  const entry = alert ? getCheck(alert.type) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-0 sm:max-w-md">
        {alert ? (
          <div className="flex flex-col gap-4 p-4">
            <SheetHeader className="p-0">
              <div className="flex items-center gap-2">
                <Badge className={cn(severityBadgeClass(alert.severity))}>
                  {alert.severity}
                </Badge>
                <Badge variant="outline">{entry?.category ?? "Unknown"}</Badge>
              </div>
              <SheetTitle className="mt-1">
                {entry?.title ?? alert.type}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {alert.pageUrl}
              </SheetDescription>
            </SheetHeader>

            {entry ? (
              <>
                <Section title="Why this matters">{entry.description}</Section>
                <Section title="How to fix">{entry.howToFix}</Section>
              </>
            ) : null}

            {alert.message ? (
              <Section title="Message">{alert.message}</Section>
            ) : null}
            {alert.detail ? (
              <Section title="Detail">{alert.detail}</Section>
            ) : null}

            {alert.affectedUrls && alert.affectedUrls.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Affected URLs ({alert.affectedUrls.length})
                </div>
                <ul className="space-y-1">
                  {alert.affectedUrls.slice(0, 25).map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
                      >
                        {url}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Stat label="First seen" value={relativeTime(alert.createdAt)} />
              <Stat
                label="Last seen"
                value={relativeTime(alert.lastSeenAt ?? alert.createdAt)}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(alert.pageUrl)}`}
                >
                  Open in page detail
                </Link>
              </Button>
              {alert.status === "OPEN" && onIgnore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onIgnore(alert)}
                >
                  <EyeOffIcon />
                  <span>Ignore</span>
                </Button>
              ) : null}
              {alert.status === "IGNORED" && onUnignore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnignore(alert)}
                >
                  <EyeIcon />
                  <span>Unignore</span>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
