// Public status page (plan section 16). Mounted at /status above the
// AppShell - no tenant scope, no auth. Polls GET /api/status every 30s and
// renders four component cards (API / Crawler / Scheduler / Mongo) with the
// current operational / degraded / down state plus a metric line.
//
// The endpoint is shipping in BE iter 3; if it 404s we render a "coming
// soon" placeholder so the link from the marketing trust strip never lands
// on a broken page.

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import { ApiError, isApiError } from "@/api/client"
import type { StatusComponent, StatusLevel, StatusResponse } from "@/api/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const REFRESH_MS = 30_000

const DEFAULT_COMPONENT_ORDER: Array<{ id: string; name: string }> = [
  { id: "api", name: "API" },
  { id: "crawler", name: "Crawler" },
  { id: "scheduler", name: "Scheduler" },
  { id: "mongo", name: "Mongo" },
]

function levelBadge(level: StatusLevel): {
  label: string
  className: string
} {
  switch (level) {
    case "operational":
      return {
        label: "Operational",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      }
    case "degraded":
      return {
        label: "Degraded",
        className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      }
    case "down":
      return {
        label: "Down",
        className: "bg-red-500/15 text-red-700 dark:text-red-300",
      }
    default:
      return {
        label: "Unknown",
        className: "bg-muted text-muted-foreground",
      }
  }
}

function rollupCopy(level: StatusLevel): string {
  switch (level) {
    case "operational":
      return "All systems operational"
    case "degraded":
      return "Partial degradation"
    case "down":
      return "Major outage"
    default:
      return "Status unknown"
  }
}

export function Status() {
  const client = useApiClient()
  const [now, setNow] = useState(() => new Date().toISOString())

  const statusQ = useQuery<StatusResponse | null>({
    queryKey: ["public-status"],
    queryFn: async () => {
      try {
        return await client.getStatus()
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false
      return count < 1
    },
  })

  // Tick the displayed clock every 30s so users can see the page is live
  // even if the metric values themselves haven't moved.
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(new Date().toISOString()),
      REFRESH_MS,
    )
    return () => window.clearInterval(id)
  }, [])

  const data = statusQ.data
  const isComingSoon = data === null && !statusQ.isError

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Wrendex status
        </h1>
        <p className="text-sm text-muted-foreground">
          Live status for the Wrendex API, crawler, scheduler, and database.
          Auto-refreshes every 30 seconds.
        </p>
      </header>

      {statusQ.isLoading ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading status...
        </div>
      ) : isComingSoon ? (
        <div
          className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground"
          data-testid="status-coming-soon"
        >
          Status page coming soon. The Wrendex SLA dashboard is in flight; in
          the meantime, please check{" "}
          <a
            className="underline"
            href="https://twitter.com/wrendex"
            rel="noreferrer noopener"
            target="_blank"
          >
            @wrendex
          </a>{" "}
          for incident updates.
        </div>
      ) : statusQ.isError || !data ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-destructive">
          Could not load status.
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusQ.refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <RenderStatus data={data} now={now} />
      )}
    </div>
  )
}

function RenderStatus({
  data,
  now,
}: {
  data: StatusResponse
  now: string
}) {
  const overall = levelBadge(data.status)
  // If the BE response is missing a component we still render the placeholder
  // card so the four-up grid stays stable.
  const byId: Record<string, StatusComponent> = {}
  for (const c of data.components ?? []) byId[c.id] = c
  const components = DEFAULT_COMPONENT_ORDER.map((slot) => {
    const found = byId[slot.id]
    return (
      found ?? {
        id: slot.id,
        name: slot.name,
        status: "operational" as StatusLevel,
        metric: null,
        updatedAt: null,
      }
    )
  })
  // Append any extra components the BE returned beyond the default four.
  for (const c of data.components ?? []) {
    if (!DEFAULT_COMPONENT_ORDER.find((slot) => slot.id === c.id)) {
      components.push(c)
    }
  }

  return (
    <div className="space-y-6" data-testid="status-cards">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-md border bg-card p-4",
        )}
      >
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide",
            overall.className,
          )}
        >
          {overall.label}
        </span>
        <span className="text-sm font-medium">{rollupCopy(data.status)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          As of {new Date(data.updatedAt || now).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {components.map((c) => {
          const b = levelBadge(c.status)
          return (
            <div
              key={c.id}
              className="rounded-md border bg-card p-4"
              data-testid={`status-card-${c.id}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{c.name}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                    b.className,
                  )}
                >
                  {b.label}
                </span>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {c.metric ?? ""}
              </div>
              {c.updatedAt ? (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Updated {new Date(c.updatedAt).toLocaleTimeString()}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
