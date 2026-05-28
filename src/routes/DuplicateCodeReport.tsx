// Duplicate Code report. Lands at /t/:tenantId/crawls/:crawlId/duplicate-code.
//
// Reads getDuplicateCode(crawlId) once and renders:
//   - per-language summary cards (Total / Avg / Max) from result.stats
//   - tabs JS | CSS, listing per-page DuplicateCodeEntry rows sorted by
//     tokenCount desc, expandable for the matched snippet.
//
// The byte values shown in the summary cards are derived from CPD's
// tokenCount via formatTokenBytes (tokens * 5); see lib/format.ts.

import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type {
  DuplicateCodeEntry,
  DuplicateCodeLanguageStats,
  DuplicateCodeResult,
} from "@/api/generated/wrendex-models"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge-fallback"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { formatTokenBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

type LangKey = "js" | "css"

const LANG_LABEL: Record<LangKey, string> = {
  js: "JavaScript",
  css: "CSS",
}

function severityClass(tokens: number | null): string {
  if (tokens == null || tokens <= 0)
    return "bg-muted text-muted-foreground"
  if (tokens >= 500) return "bg-red-500/15 text-red-700 dark:text-red-300"
  if (tokens >= 150) return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border bg-card/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function LanguageStatsCard({
  label,
  stats,
}: {
  label: string
  stats: DuplicateCodeLanguageStats
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-3 py-2 text-sm font-medium">{label}</div>
      <div className="grid grid-cols-4 gap-2 p-3">
        <StatCard label="Alerts" value={stats.alertCount.toLocaleString()} />
        <StatCard label="Total" value={formatTokenBytes(stats.totalTokens)} />
        <StatCard label="Avg" value={formatTokenBytes(stats.avgTokens)} />
        <StatCard label="Max" value={formatTokenBytes(stats.maxTokens)} />
      </div>
    </div>
  )
}

function EntryRow({
  entry,
  index,
}: {
  entry: DuplicateCodeEntry
  index: number
}) {
  const [open, setOpen] = useState(false)
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
        <Badge variant="outline" className="text-[10px]">
          #{index + 1}
        </Badge>
        <Badge className={cn("text-[10px]", severityClass(entry.tokenCount))}>
          {entry.tokenCount == null
            ? "size unknown"
            : `${formatTokenBytes(entry.tokenCount)} shared`}
        </Badge>
        <span className="truncate text-sm font-medium" title={entry.pageUrl}>
          {entry.pageUrl}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t px-3 py-2 text-xs">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Source A: </span>
              <span className="break-all font-mono">{entry.sourceA}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Source B: </span>
              <span className="break-all font-mono">{entry.sourceB}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Message: </span>
            <span>{entry.message}</span>
          </div>
          {entry.snippet ? (
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
              {entry.snippet}
            </pre>
          ) : null}
          <div>
            <a
              href={entry.pageUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open page
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DuplicateCodeReport() {
  const { tenantId = "default", crawlId = "" } = useParams<{
    tenantId: string
    crawlId: string
  }>()
  const client = useApiClient()
  const [tab, setTab] = useState<LangKey>("js")

  const q = useQuery<DuplicateCodeResult>({
    queryKey: ["duplicate-code", crawlId],
    queryFn: () => client.getDuplicateCode(crawlId),
    enabled: Boolean(crawlId),
  })

  const entries = q.data?.entries ?? []
  const stats = q.data?.stats ?? null

  function entriesFor(kind: LangKey): DuplicateCodeEntry[] {
    const target = kind === "js" ? "JS" : "CSS"
    return entries.filter((e) => e.language === target)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/t/${tenantId}`} className="hover:underline">
            Dashboard
          </Link>
          <span>/</span>
          <span>Duplicate Code</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Duplicate code
          </h1>
          <div className="flex items-center gap-2">
            <CsvExportButton
              path={`/api/crawls/${crawlId}/duplicate-code`}
              filename={`duplicate-code-${crawlId}.csv`}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Page-weighted duplicate JS / CSS detected across the crawl. Sizes
          are estimated from CPD token counts.
        </p>
      </div>

      {q.isLoading ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : q.isError ? (
        <div className="rounded-md border bg-card p-6 text-sm text-red-600 dark:text-red-400">
          Could not load duplicate code.
        </div>
      ) : !stats || entries.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No duplicate code detected in this crawl.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <LanguageStatsCard label={LANG_LABEL.js} stats={stats.js} />
            <LanguageStatsCard label={LANG_LABEL.css} stats={stats.css} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as LangKey)}>
            <TabsList>
              <TabsTrigger value="js">
                {LANG_LABEL.js} ({stats.js.alertCount})
              </TabsTrigger>
              <TabsTrigger value="css">
                {LANG_LABEL.css} ({stats.css.alertCount})
              </TabsTrigger>
            </TabsList>

            {(["js", "css"] as LangKey[]).map((kind) => {
              const filtered = entriesFor(kind)
              return (
                <TabsContent key={kind} value={kind} className="mt-4">
                  {filtered.length === 0 ? (
                    <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
                      No duplicate {LANG_LABEL[kind]} alerts.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((entry, idx) => (
                        <EntryRow
                          key={entry.alertId}
                          entry={entry}
                          index={idx}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </>
      )}
    </div>
  )
}
