// Issue queue panel for the SiteDetail overview (plan section 2.4).
// Renders the IssuesSummary.byCategory shape with a colored severity dot
// per row. Each row links to a category drill-in page; that route is a
// stub until the category-detail iteration lands.

import { Link } from "react-router-dom"
import type { IssuesSummary } from "@/api/types"
import { useReadOnly } from "@/components/share/ReadOnlyContext"
import { cn } from "@/lib/utils"

export type IssueQueueProps = {
  tenantId: string
  crawlId: string
  summary: IssuesSummary
  /** Health score from the latest crawl - shown in the empty state. */
  healthScore: number
}

function dotClass(row: { errorCount: number; warningCount: number; noticeCount: number }) {
  if (row.errorCount > 0) return "bg-red-500"
  if (row.warningCount > 0) return "bg-amber-500"
  if (row.noticeCount > 0) return "bg-blue-500"
  return "bg-muted-foreground/40"
}

function totalFor(row: { errorCount: number; warningCount: number; noticeCount: number }) {
  return row.errorCount + row.warningCount + row.noticeCount
}

export function IssueQueue({
  tenantId,
  crawlId,
  summary,
  healthScore,
}: IssueQueueProps) {
  const readOnly = useReadOnly()
  const rows = [...summary.byCategory].sort(
    (a, b) => totalFor(b) - totalFor(a),
  )

  if (rows.length === 0 || summary.totalIssues === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        No issues found in this crawl. Health score {healthScore}/100.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-2 text-sm font-medium">
        Issues by category
      </div>
      <ul className="divide-y">
        {rows.map((row) => {
          const total = totalFor(row)
          return (
            <li
              key={row.category}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn("inline-block size-2 rounded-full", dotClass(row))}
                  aria-hidden
                />
                <span className="font-medium">{row.category}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {row.errorCount > 0 ? (
                    <span className="text-red-500">
                      {row.errorCount} err
                    </span>
                  ) : null}
                  {row.warningCount > 0 ? (
                    <span className="ml-2 text-amber-500">
                      {row.warningCount} warn
                    </span>
                  ) : null}
                  {row.noticeCount > 0 ? (
                    <span className="ml-2 text-blue-500">
                      {row.noticeCount} notice
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {total}
                </span>
                {readOnly ? null : (
                  <Link
                    className="text-xs font-medium text-primary hover:underline"
                    to={`/t/${tenantId}/crawls/${crawlId}/issues/category/${encodeURIComponent(row.category)}`}
                  >
                    View
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
