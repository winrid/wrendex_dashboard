// Structured Data report (plan section 4.7 - R.07). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/structured-data.
//
// Reads getStructuredData(crawlId) for the per-page entries (url +
// scriptCount + types[]), then merges in JSON_LD_* alerts from
// listCrawlAlerts(crawlId) so each row can show passed / errors /
// warnings counts and split Schema.org-only errors (JSON_LD_*) from
// Google-Rich-Results errors (JSON_LD_GOOGLE_*) per the R.07 spec.
//
// Raw JSON-LD is fetched lazily on expand via getPageByUrl(crawlId, url)
// so the initial paint doesn't have to round-trip the full Page model
// for every entry.
//
// Filter bar:
//   - All
//   - With errors
//   - Google-eligible only

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type {
  Alert,
  AlertType,
  Page,
  StructuredDataEntry,
  StructuredDataResult,
} from "@/api/types"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FilterKind = "all" | "with-errors" | "google-eligible"

const SCHEMA_ALERT_TYPES = new Set<AlertType>([
  "JSON_LD_PARSE_ERROR",
  "JSON_LD_MISSING_TYPE",
  "JSON_LD_INVALID_TYPE",
  "JSON_LD_INVALID_PROPERTY",
  "JSON_LD_UNEXPECTED_PROPERTY_TYPE",
  "JSON_LD_UNEXPECTED_PROPERTY",
  "JSON_LD_INVALID_VALUE",
  "JSON_LD_DUPLICATE_PROPERTY",
  "JSON_LD_DEPRECATED_TYPE",
  "JSON_LD_DEPRECATED_PROPERTY",
])

const GOOGLE_ALERT_TYPES = new Set<AlertType>([
  "JSON_LD_GOOGLE_MISSING_REQUIRED",
  "JSON_LD_GOOGLE_MISSING_ONE_OF_REQUIRED",
  "JSON_LD_GOOGLE_PROPERTY_MISSING_TYPE",
  "JSON_LD_GOOGLE_MISSING_IMAGE",
  "JSON_LD_GOOGLE_INVALID_DATE",
  "JSON_LD_GOOGLE_UNRECOGNIZED_PROPERTY",
  "JSON_LD_GOOGLE_UNRESOLVED_ID",
  "JSON_LD_GOOGLE_EMPTY_FIELD",
  "JSON_LD_GOOGLE_INVALID_VALUE",
])

function isSchemaAlert(t: AlertType): boolean {
  return SCHEMA_ALERT_TYPES.has(t)
}
function isGoogleAlert(t: AlertType): boolean {
  return GOOGLE_ALERT_TYPES.has(t)
}

type EntryStats = {
  schemaErrors: number
  schemaWarnings: number
  googleErrors: number
  googleWarnings: number
  alerts: Alert[]
}

function emptyStats(): EntryStats {
  return {
    schemaErrors: 0,
    schemaWarnings: 0,
    googleErrors: 0,
    googleWarnings: 0,
    alerts: [],
  }
}

function buildAlertIndex(alerts: Alert[]): Map<string, EntryStats> {
  const idx = new Map<string, EntryStats>()
  for (const a of alerts) {
    if (!a.pageUrl) continue
    const isSchema = isSchemaAlert(a.type)
    const isGoogle = isGoogleAlert(a.type)
    if (!isSchema && !isGoogle) continue
    let stats = idx.get(a.pageUrl)
    if (!stats) {
      stats = emptyStats()
      idx.set(a.pageUrl, stats)
    }
    stats.alerts.push(a)
    const sev = a.severity
    if (isSchema) {
      if (sev === "ERROR") stats.schemaErrors += 1
      else if (sev === "WARNING") stats.schemaWarnings += 1
    } else {
      if (sev === "ERROR") stats.googleErrors += 1
      else if (sev === "WARNING") stats.googleWarnings += 1
    }
  }
  return idx
}

function severityClass(severity: string): string {
  if (severity === "ERROR")
    return "bg-red-500/15 text-red-700 dark:text-red-300"
  if (severity === "WARNING")
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
}

function numberLines(text: string): string {
  return text
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3, " ")}  ${line}`)
    .join("\n")
}

function EntryCard({
  entry,
  stats,
  tenantId,
  siteId,
  crawlId,
}: {
  entry: StructuredDataEntry
  stats: EntryStats
  tenantId: string
  siteId: string
  crawlId: string
}) {
  const [open, setOpen] = useState(false)
  const client = useApiClient()
  const pageQ = useQuery<Page>({
    queryKey: ["page-by-url", crawlId, entry.url],
    queryFn: () => client.getPageByUrl(crawlId, entry.url),
    enabled: open && Boolean(crawlId && entry.url),
  })

  const totalErrors = stats.schemaErrors + stats.googleErrors
  const totalWarnings = stats.schemaWarnings + stats.googleWarnings
  const passed = entry.scriptCount > 0 && totalErrors === 0

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex flex-wrap items-center gap-1">
          {entry.types.length === 0 ? (
            <Badge variant="outline" className="text-[10px]">
              (no @type)
            </Badge>
          ) : (
            entry.types.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))
          )}
        </span>
        <span
          className="ml-1 truncate font-mono text-xs text-foreground/80"
          title={entry.url}
        >
          {entry.url}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {passed ? (
            <Badge className={cn("text-[10px]", severityClass("NOTICE"))}>
              passed
            </Badge>
          ) : null}
          {totalErrors > 0 ? (
            <Badge className={cn("text-[10px]", severityClass("ERROR"))}>
              {totalErrors} errors
            </Badge>
          ) : null}
          {totalWarnings > 0 ? (
            <Badge className={cn("text-[10px]", severityClass("WARNING"))}>
              {totalWarnings} warnings
            </Badge>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(entry.url)}&crawlId=${encodeURIComponent(crawlId)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open page detail
              <ExternalLinkIcon className="size-3" />
            </Link>
            <span className="text-muted-foreground">
              {entry.scriptCount} JSON-LD script{entry.scriptCount === 1 ? "" : "s"}
            </span>
          </div>

          {stats.alerts.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Validation issues
              </div>
              <ul className="divide-y rounded-md border">
                {stats.alerts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs">
                    <Badge className={cn("text-[10px]", severityClass(a.severity))}>
                      {a.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {isSchemaAlert(a.type) ? "Schema.org" : "Google"}
                    </Badge>
                    <span className="font-mono text-[11px]">{a.type}</span>
                    <span className="text-muted-foreground">{a.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No validation issues recorded for this page.
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Raw JSON-LD
            </div>
            {pageQ.isLoading ? (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                Loading...
              </div>
            ) : pageQ.isError ? (
              <div className="rounded-md border p-3 text-xs text-red-600 dark:text-red-400">
                Could not load page payload.
              </div>
            ) : (pageQ.data?.jsonLdScripts ?? []).length === 0 ? (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                No JSON-LD blocks captured.
              </div>
            ) : (
              <div className="space-y-2">
                {(pageQ.data?.jsonLdScripts ?? []).map((script, idx) => (
                  <div key={idx} className="rounded-md border bg-muted/30">
                    <div className="border-b px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      JSON-LD #{idx + 1}
                    </div>
                    <pre className="max-h-96 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
                      <code>{numberLines(script)}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StructuredDataReport() {
  const {
    tenantId = "default",
    siteId = "",
    crawlId = "",
  } = useParams<{
    tenantId: string
    siteId: string
    crawlId: string
  }>()
  const client = useApiClient()
  const [filter, setFilter] = useState<FilterKind>("all")

  const sdQ = useQuery<StructuredDataResult>({
    queryKey: ["structured-data", crawlId],
    queryFn: () => client.getStructuredData(crawlId),
    enabled: Boolean(crawlId),
  })

  // Pull a single batch of crawl alerts (size capped at 500) and split
  // by JSON_LD_* / JSON_LD_GOOGLE_* client-side. Cheaper than firing one
  // request per AlertType and keeps the wire shape simple.
  const alertsQ = useQuery({
    queryKey: ["crawl-jsonld-alerts", crawlId],
    queryFn: () => client.listCrawlAlerts(crawlId, { size: 500 }),
    enabled: Boolean(crawlId),
  })

  const alertIndex = useMemo(
    () => buildAlertIndex(alertsQ.data?.items ?? []),
    [alertsQ.data],
  )

  const entries = sdQ.data?.entries ?? []

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const stats = alertIndex.get(e.url) ?? emptyStats()
      const totalErrors = stats.schemaErrors + stats.googleErrors
      if (filter === "with-errors") return totalErrors > 0
      if (filter === "google-eligible") {
        // "Google-eligible" = the page emits at least one JSON-LD script
        // AND has no Google-rich-results errors. Errors at the Schema.org
        // layer alone do not disqualify Google rich results.
        return e.scriptCount > 0 && stats.googleErrors === 0
      }
      return true
    })
  }, [entries, alertIndex, filter])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to={`/t/${tenantId}/sites/${siteId}`}
            className="hover:underline"
          >
            Site
          </Link>
          <span>/</span>
          <Link
            to={`/t/${tenantId}/sites/${siteId}/crawls`}
            className="hover:underline"
          >
            Crawls
          </Link>
          <span>/</span>
          <span>Structured data</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Structured data
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {sdQ.data?.totalPagesWithStructuredData ?? 0} pages
          </Badge>
          <Badge variant="outline">
            {sdQ.data?.totalScripts ?? 0} JSON-LD scripts
          </Badge>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1 rounded-md border bg-card p-1"
        role="group"
        aria-label="Filter entries"
      >
        {(
          [
            { value: "all", label: "All" },
            { value: "with-errors", label: "With errors" },
            { value: "google-eligible", label: "Google-eligible only" },
          ] as { value: FilterKind; label: string }[]
        ).map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter(opt.value)}
            aria-pressed={filter === opt.value}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {sdQ.isLoading ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : sdQ.isError ? (
        <div className="rounded-md border bg-card p-6 text-sm text-red-600 dark:text-red-400">
          Could not load structured-data report.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          {entries.length === 0
            ? "No JSON-LD captured in this crawl yet."
            : "No entries match the current filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.url}
              entry={entry}
              stats={alertIndex.get(entry.url) ?? emptyStats()}
              tenantId={tenantId}
              siteId={siteId}
              crawlId={crawlId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
