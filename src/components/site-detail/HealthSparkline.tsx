// Trend sparkline for the SiteDetail overview (plan section 2.3).
// ComposedChart so we can stack a Bar series (notices) behind a Line series
// (errors) on the same time axis. The hovered tooltip surfaces exact counts
// + the crawl timestamp; clicking a point links to the crawl detail page.

import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import type { HealthScorePoint } from "@/api/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type HealthSparklineProps = {
  points: HealthScorePoint[]
  tenantId: string
  siteId: string
  className?: string
}

type RangeKey = "7d" | "30d" | "90d" | "12"
const RANGE_BUTTONS: Array<{ key: RangeKey; label: string }> = [
  { key: "12", label: "Last 12" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
]

function filterByRange(
  points: HealthScorePoint[],
  range: RangeKey,
): HealthScorePoint[] {
  if (range === "12") return points.slice(-12)
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return points.filter((p) => new Date(p.startedAt).getTime() >= cutoff)
}

type SparkRow = {
  crawlRunId: string
  startedAt: string
  ts: number
  errors: number
  warnings: number
  notices: number
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: SparkRow }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">
        {format(new Date(row.startedAt), "PPp")}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-red-500">Errors</span>
        <span className="text-right">{row.errors}</span>
        <span className="text-amber-500">Warnings</span>
        <span className="text-right">{row.warnings}</span>
        <span className="text-blue-500">Notices</span>
        <span className="text-right">{row.notices}</span>
      </div>
    </div>
  )
}

export function HealthSparkline({
  points,
  tenantId,
  siteId,
  className,
}: HealthSparklineProps) {
  const navigate = useNavigate()
  const [range, setRange] = useState<RangeKey>("12")

  const data = useMemo<SparkRow[]>(() => {
    const sorted = [...points].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
    return filterByRange(sorted, range).map((p) => ({
      crawlRunId: p.crawlRunId,
      startedAt: p.startedAt,
      ts: new Date(p.startedAt).getTime(),
      errors: p.errorCount ?? 0,
      warnings: p.warningCount ?? 0,
      notices: p.noticeCount ?? 0,
    }))
  }, [points, range])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Issues over time</h3>
        <div className="flex gap-1">
          {RANGE_BUTTONS.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-44 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            No crawl history in this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(e) => {
                const ap = (e as { activePayload?: Array<{ payload?: SparkRow }> })
                  ?.activePayload
                const row = ap?.[0]?.payload
                if (row) {
                  navigate(
                    `/t/${tenantId}/sites/${siteId}/crawls/${row.crawlRunId}`,
                  )
                }
              }}
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
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="notices"
                fill="currentColor"
                className="fill-blue-500/40"
                barSize={8}
              />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="currentColor"
                className="stroke-red-500"
                dot={{ r: 2 }}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
