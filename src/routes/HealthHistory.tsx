// Health Score History (plan section 4.1 - R.01). Lands at
// /t/:tenantId/sites/:siteId/health-history.
//
// Renders the per-site health score timeseries as a ComposedChart (line for
// healthScore on the left axis, stacked bars for errors / warnings / notices
// on the right axis) plus a DataTable below it with one row per crawl run.
// Deploy annotations (Phase 2 release-annotations endpoint) are overlaid as
// vertical pins on the chart and surface a sha + env + first 80 chars of
// the commit message on hover. The annotations endpoint is shipping in
// parallel - if listReleaseAnnotations 404s or 5xxs the page still renders
// the chart + table without annotations.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { ExternalLinkIcon } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { useApiClient } from "@/api/useApiClient"
import type {
  HealthScorePoint,
  ReleaseAnnotation,
  Site,
} from "@/api/types"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table/DataTable"
import { cn } from "@/lib/utils"
import { relativeTime, siteDisplayName } from "@/lib/format"

type RangeKey = "7" | "30" | "90"
const RANGE_BUTTONS: Array<{ key: RangeKey; label: string }> = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
]

type ChartRow = {
  crawlRunId: string
  startedAt: string
  ts: number
  healthScore: number
  errors: number
  warnings: number
  notices: number
}

type TableRow = HealthScorePoint & {
  delta: number | null
}

function rangeDays(range: RangeKey): number {
  return range === "7" ? 7 : range === "30" ? 30 : 90
}

function filterByRange(
  points: HealthScorePoint[],
  range: RangeKey,
): HealthScorePoint[] {
  const cutoff = Date.now() - rangeDays(range) * 24 * 60 * 60 * 1000
  return points.filter((p) => new Date(p.startedAt).getTime() >= cutoff)
}

function ChartTooltip({
  active,
  payload,
  annotationsByCrawlId,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
  annotationsByCrawlId: Map<string, ReleaseAnnotation>
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  const annotation = annotationsByCrawlId.get(row.crawlRunId)
  return (
    <div className="rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">
        {format(new Date(row.startedAt), "PPp")}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-emerald-600 dark:text-emerald-400">Score</span>
        <span className="text-right">{row.healthScore}</span>
        <span className="text-red-500">Errors</span>
        <span className="text-right">{row.errors}</span>
        <span className="text-amber-500">Warnings</span>
        <span className="text-right">{row.warnings}</span>
        <span className="text-blue-500">Notices</span>
        <span className="text-right">{row.notices}</span>
      </div>
      {annotation ? (
        <div className="mt-2 border-t pt-2">
          <div className="font-medium text-foreground">
            Deploy: {annotation.sha.slice(0, 7)}
            <span className="ml-1 text-muted-foreground">({annotation.env})</span>
          </div>
          {annotation.message ? (
            <div className="mt-0.5 max-w-[18rem] text-muted-foreground">
              {annotation.message.slice(0, 80)}
              {annotation.message.length > 80 ? "..." : ""}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function HealthHistory() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const client = useApiClient()
  const [range, setRange] = useState<RangeKey>("90")

  const siteQ = useQuery<Site>({
    queryKey: ["site", tenantId, siteId],
    queryFn: () => client.getSite(tenantId, siteId),
    enabled: Boolean(tenantId && siteId),
  })

  const healthQ = useQuery<HealthScorePoint[]>({
    queryKey: ["site-health", siteId],
    queryFn: () => client.getHealthScore(siteId),
    enabled: Boolean(siteId),
  })

  // Release annotations are best-effort. The BE endpoint is shipping in
  // parallel; we catch the 404 / 5xx and fall back to an empty list so the
  // chart still renders without pins.
  const annotationsQ = useQuery<ReleaseAnnotation[]>({
    queryKey: ["site-release-annotations", siteId],
    queryFn: async () => {
      try {
        return await client.listReleaseAnnotations(siteId)
      } catch (err) {
        // Soft-fail. Console-warn so it's visible in dev but never blocks
        // the page render.
        // eslint-disable-next-line no-console
        console.warn("listReleaseAnnotations failed; rendering without pins", err)
        return []
      }
    },
    enabled: Boolean(siteId),
    retry: false,
  })

  const sortedPoints = useMemo<HealthScorePoint[]>(() => {
    const points = healthQ.data ?? []
    return [...points].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
  }, [healthQ.data])

  const filteredPoints = useMemo<HealthScorePoint[]>(
    () => filterByRange(sortedPoints, range),
    [sortedPoints, range],
  )

  const chartData = useMemo<ChartRow[]>(
    () =>
      filteredPoints.map((p) => ({
        crawlRunId: p.crawlRunId,
        startedAt: p.startedAt,
        ts: new Date(p.startedAt).getTime(),
        healthScore: p.healthScore,
        errors: p.errorCount ?? 0,
        warnings: p.warningCount ?? 0,
        notices: p.noticeCount ?? 0,
      })),
    [filteredPoints],
  )

  const tableRows = useMemo<TableRow[]>(() => {
    // Newest first for the table; delta is computed against the immediately-
    // previous (older) crawl in the filtered window. We compute delta by
    // walking the chronological list, then reverse for display.
    const rows: TableRow[] = filteredPoints.map((p, idx) => {
      const prev = idx > 0 ? filteredPoints[idx - 1] : null
      const delta = prev ? p.healthScore - prev.healthScore : null
      return { ...p, delta }
    })
    return rows.reverse()
  }, [filteredPoints])

  // Build a quick lookup for the tooltip / pin rendering. Anchor each
  // annotation to its overlapping crawl so we can drop a vertical line at
  // that exact x-coordinate (no awkward midpoint guessing).
  const annotationsByCrawlId = useMemo(() => {
    const m = new Map<string, ReleaseAnnotation>()
    for (const a of annotationsQ.data ?? []) {
      m.set(a.crawlRunId, a)
    }
    return m
  }, [annotationsQ.data])

  // Pins to render. We only show pins whose crawl is in the visible range
  // (annotations outside the window would have no x-anchor on the chart).
  const visiblePins = useMemo<Array<ReleaseAnnotation & { ts: number }>>(() => {
    const visibleIds = new Set(chartData.map((c) => c.crawlRunId))
    const pins: Array<ReleaseAnnotation & { ts: number }> = []
    for (const a of annotationsQ.data ?? []) {
      if (!visibleIds.has(a.crawlRunId)) continue
      pins.push({ ...a, ts: new Date(a.startedAt).getTime() })
    }
    return pins
  }, [annotationsQ.data, chartData])

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        id: "startedAt",
        header: "Started",
        accessorKey: "startedAt",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.startedAt)}
          </span>
        ),
      },
      {
        id: "healthScore",
        header: "Score",
        accessorKey: "healthScore",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm font-medium">
            {row.original.healthScore}
          </span>
        ),
      },
      {
        id: "delta",
        header: "Delta",
        cell: ({ row }) => {
          const d = row.original.delta
          if (d == null) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          if (d === 0) {
            return (
              <span className="tabular-nums text-xs text-muted-foreground">
                0
              </span>
            )
          }
          return (
            <span
              className={cn(
                "tabular-nums text-xs font-medium",
                d > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {d > 0 ? `+${d}` : d}
            </span>
          )
        },
      },
      {
        id: "errorCount",
        header: "Errors",
        accessorKey: "errorCount",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.errorCount}
          </span>
        ),
      },
      {
        id: "warningCount",
        header: "Warnings",
        accessorKey: "warningCount",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.warningCount}
          </span>
        ),
      },
      {
        id: "noticeCount",
        header: "Notices",
        accessorKey: "noticeCount",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.noticeCount}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm">
            <Link
              to={`/t/${tenantId}/sites/${siteId}/crawls/${row.original.crawlRunId}`}
            >
              View
            </Link>
          </Button>
        ),
      },
    ],
    [tenantId, siteId],
  )

  const site = siteQ.data
  const noPoints = !healthQ.isLoading && filteredPoints.length === 0

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to={`/t/${tenantId}/sites/${siteId}`}
            className="hover:underline"
          >
            Site
          </Link>
          <span>/</span>
          <span>Health history</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Health score history
            </h1>
            {site ? (
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
              >
                {siteDisplayName(site.url)}
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Last {rangeDays(range)} days
            </p>
          </div>
          <div
            className="flex gap-1"
            role="group"
            aria-label="Compare range"
          >
            {RANGE_BUTTONS.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        className="rounded-md border bg-card p-4"
        data-testid="health-history-chart"
      >
        <div className="h-72 w-full">
          {healthQ.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading history...
            </div>
          ) : noPoints ? (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              No crawls in this window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="score"
                  orientation="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="counts"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      annotationsByCrawlId={annotationsByCrawlId}
                    />
                  }
                />
                <Bar
                  yAxisId="counts"
                  dataKey="errors"
                  stackId="counts"
                  fill="currentColor"
                  className="fill-red-500/50"
                  barSize={8}
                />
                <Bar
                  yAxisId="counts"
                  dataKey="warnings"
                  stackId="counts"
                  fill="currentColor"
                  className="fill-amber-500/50"
                  barSize={8}
                />
                <Bar
                  yAxisId="counts"
                  dataKey="notices"
                  stackId="counts"
                  fill="currentColor"
                  className="fill-blue-500/40"
                  barSize={8}
                />
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="healthScore"
                  stroke="currentColor"
                  className="stroke-emerald-500"
                  dot={{ r: 2 }}
                  strokeWidth={2}
                />
                {visiblePins.map((pin) => (
                  <ReferenceLine
                    key={`pin-${pin.crawlRunId}`}
                    yAxisId="score"
                    x={pin.ts}
                    stroke="currentColor"
                    className="stroke-violet-500"
                    strokeDasharray="2 2"
                    ifOverflow="extendDomain"
                    label={{
                      value: pin.sha.slice(0, 7),
                      position: "top",
                      fill: "currentColor",
                      fontSize: 10,
                    }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        {visiblePins.length > 0 ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="health-history-annotations"
          >
            <span>Deploys:</span>
            {visiblePins.map((pin) => (
              <Badge
                key={`badge-${pin.crawlRunId}`}
                variant="outline"
                title={`${pin.sha} (${pin.env}) - ${pin.message.slice(0, 80)}`}
              >
                {pin.sha.slice(0, 7)} - {pin.env}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <DataTable<TableRow>
        columns={columns}
        data={tableRows}
        emptyState={
          healthQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load health history.
            </span>
          ) : (
            "No crawls in this window."
          )
        }
        isLoading={healthQ.isLoading}
      />
    </div>
  )
}
