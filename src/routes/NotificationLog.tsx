// Notification delivery log (plan section 4A.5). Lands at
// /t/:tenantId/notifications/log.
//
// Reads listNotificationLog (BE iter 2 round 2). The endpoint may not be
// shipped yet at the moment this code lands; we surface a friendly empty
// state when the GET 404s so we degrade gracefully.
//
// Filters: channel single-select (EMAIL / SLACK / TEAMS / PAGERDUTY), status
// multi-select (QUEUED / SENT / FAILED), and a "since" preset (1d / 7d /
// 30d / all-time).
//
// NOTE: channel is single-select because the BE accepts a single value per
// param. Multi-channel filtering would require parallel queries + a
// client-side merge; revisit when product asks for it.
//
// Per-row Resend button calls resendNotification and toasts the new
// deliveryId so the user can correlate.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type {
  NotificationChannel,
  NotificationLogEntry,
  NotificationLogResult,
  NotificationStatus,
} from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Toaster } from "@/components/ui/sonner"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const CHANNELS: NotificationChannel[] = [
  "EMAIL",
  "SLACK",
  "TEAMS",
  "PAGERDUTY",
]
const STATUSES: NotificationStatus[] = ["QUEUED", "SENT", "FAILED"]

type SincePreset = "1d" | "7d" | "30d" | "all"

const SINCE_LABEL: Record<SincePreset, string> = {
  "1d": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
}

function sinceIso(preset: SincePreset): string | undefined {
  if (preset === "all") return undefined
  const days = preset === "1d" ? 1 : preset === "7d" ? 7 : 30
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

function channelBadge(channel: NotificationChannel): string {
  switch (channel) {
    case "EMAIL":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    case "SLACK":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300"
    case "TEAMS":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
    case "PAGERDUTY":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
  }
}

function statusBadge(status: NotificationStatus): string {
  switch (status) {
    case "QUEUED":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "SENT":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "FAILED":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
  }
}

export function NotificationLog() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const client = useApiClient()
  const queryClient = useQueryClient()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  // Channel is single-select (BE accepts one value per param). null = no
  // filter. See top-of-file note for the multi-channel rationale.
  const [channel, setChannel] = useState<NotificationChannel | null>(null)
  const [statuses, setStatuses] = useState<NotificationStatus[]>([])
  const [since, setSince] = useState<SincePreset>("7d")

  // sinceIso(since) returns a fresh ISO string per call; computing it inside
  // useMemo against the preset (rather than the resolved string) keeps the
  // memo stable across renders so react-query doesn't refetch on every
  // re-render. The "since" lower bound only needs to be precise to within
  // the active session.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      size: pagination.pageSize,
      channel: channel ?? undefined,
      status: statuses.length > 0 ? statuses.join(",") : undefined,
      since: sinceIso(since),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagination, channel, statuses, since],
  )

  const logQ = useQuery<NotificationLogResult | null>({
    queryKey: ["notification-log", tenantId, params],
    queryFn: async () => {
      try {
        return await client.listNotificationLog(tenantId, params)
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 1
    },
  })

  const resendMut = useMutation({
    mutationFn: ({
      deliveryId,
      channel,
    }: {
      deliveryId: string
      channel: NotificationChannel
    }) => client.resendNotification(tenantId, deliveryId, { channel }),
    onSuccess: (resp) => {
      toast.success(`Re-queued. New deliveryId: ${resp.newDeliveryId}`)
      void queryClient.invalidateQueries({ queryKey: ["notification-log"] })
    },
    onError: () => toast.error("Could not resend notification"),
  })

  const rows = logQ.data?.items ?? []
  const total = logQ.data?.total ?? 0
  const beNotShipped = !logQ.isLoading && logQ.data === null

  const columns = useMemo<ColumnDef<NotificationLogEntry>[]>(
    () => [
      {
        id: "queuedAt",
        header: "When",
        cell: ({ row }) => (
          <span title={row.original.queuedAt} className="text-xs">
            {relativeTime(row.original.queuedAt)}
          </span>
        ),
      },
      {
        id: "channel",
        header: "Channel",
        cell: ({ row }) => (
          <Badge className={cn(channelBadge(row.original.channel))}>
            {row.original.channel}
          </Badge>
        ),
      },
      {
        id: "recipient",
        header: "Recipient",
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate text-xs"
            title={row.original.recipient}
          >
            {row.original.recipient}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge className={cn(statusBadge(row.original.status))}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "alertType",
        header: "Alert",
        cell: ({ row }) => {
          const t = row.original.alertType
          if (!t) return <span className="text-xs text-muted-foreground">-</span>
          return (
            <Link
              to={`/t/${tenantId}/crawls/_/issues/type/${encodeURIComponent(String(t))}`}
              className="inline-flex items-center gap-1 text-xs hover:underline"
            >
              {String(t)}
              <ExternalLinkIcon className="size-3" />
            </Link>
          )
        },
      },
      {
        id: "attemptCount",
        header: "Attempts",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.attemptCount}
          </span>
        ),
      },
      {
        id: "error",
        header: "Last error",
        cell: ({ row }) => {
          const msg = row.original.lastErrorMessage
          if (!msg) return <span className="text-xs text-muted-foreground">-</span>
          const preview = msg.length > 60 ? msg.slice(0, 60) + "..." : msg
          return (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {preview}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96">
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {msg}
                </pre>
              </PopoverContent>
            </Popover>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={resendMut.isPending}
            onClick={() =>
              resendMut.mutate({
                deliveryId: row.original.id,
                channel: row.original.channel,
              })
            }
          >
            Resend
          </Button>
        ),
      },
    ],
    [tenantId, resendMut],
  )

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    )
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    )
  }

  const selectChannel = (c: NotificationChannel | null) => {
    setChannel(c)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const toggleStatus = (s: NotificationStatus, on: boolean) => {
    setStatuses((prev) =>
      on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
    )
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  return (
    <div className="space-y-4">
      <Toaster />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notification log
        </h1>
        <p className="text-sm text-muted-foreground">
          Every alert notification dispatch for this workspace.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Channel filter"
              data-testid="channel-filter"
            >
              Channel
              {channel ? (
                <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                  {channel}
                </span>
              ) : null}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Channel</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => selectChannel(null)}>
              All channels
            </DropdownMenuItem>
            {CHANNELS.map((c) => (
              <DropdownMenuItem
                key={c}
                onSelect={() => selectChannel(c)}
              >
                {c}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Status filter">
              Status
              {statuses.length > 0 ? (
                <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                  {statuses.length}
                </span>
              ) : null}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statuses.includes(s)}
                onCheckedChange={(v) => toggleStatus(s, Boolean(v))}
                onSelect={(e) => e.preventDefault()}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Since filter">
              {SINCE_LABEL[since]}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Since</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={since}
              onValueChange={(v) => {
                setSince(v as SincePreset)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
            >
              {(Object.keys(SINCE_LABEL) as SincePreset[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {SINCE_LABEL[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {beNotShipped ? (
        <div
          className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground"
          data-testid="notification-log-coming-soon"
        >
          The notification log is shipping shortly. Check back in a moment.
        </div>
      ) : (
        <DataTable<NotificationLogEntry>
          columns={columns}
          data={rows}
          rowCount={total}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          sorting={sorting}
          onSortingChange={onSortingChange}
          isLoading={logQ.isLoading}
          emptyState={
            logQ.isError ? (
              <span className="text-red-600 dark:text-red-400">
                Could not load notification log.
              </span>
            ) : (
              "No notifications match these filters."
            )
          }
        />
      )}
    </div>
  )
}
