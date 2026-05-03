// Resources Report (plan section 4.8 - R.08). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/resources.
//
// Reads getResources(crawlId). Three tabs - Images / Scripts / Stylesheets -
// filter the rows client-side by ResourceEntry.type. Bytes plumbing is on
// the BE TODO list (iter 2 BE-2), so size MAY be 0; we render "-" with a
// tooltip explaining the gap. renderBlocking and duplicateTracker flags are
// surfaced as small amber-tinted badges; rows with either flag get a subtle
// amber row tint.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import {
  ImageIcon,
  CodeIcon,
  PaletteIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type { ResourceEntry, ResourcesResult } from "@/api/types"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { PdfExportButton } from "@/components/pdf/PdfExportButton"
import { ShareButton } from "@/components/share/ShareButton"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/format"

type TabKey = "images" | "scripts" | "styles"

function matchesTab(entry: ResourceEntry, tab: TabKey): boolean {
  const t = entry.type.toLowerCase()
  if (tab === "images") {
    return t === "image" || t.startsWith("image/")
  }
  if (tab === "scripts") {
    return t === "script" || t === "js" || t.includes("javascript")
  }
  return t === "stylesheet" || t === "style" || t === "css" || t.includes("css")
}

function typeIcon(type: string) {
  const t = type.toLowerCase()
  if (t === "image" || t.startsWith("image/")) {
    return <ImageIcon className="size-3.5 shrink-0" />
  }
  if (t === "stylesheet" || t === "style" || t === "css" || t.includes("css")) {
    return <PaletteIcon className="size-3.5 shrink-0" />
  }
  return <CodeIcon className="size-3.5 shrink-0" />
}

// We sort by sizeBytes (when present) desc; fall back to sourcePageCount.
// The BE entry shape doesn't expose sizeBytes yet (the iter 2 TODO),
// so we read entry as a record to access an optional field without
// breaking the typed surface.
function entrySize(entry: ResourceEntry): number {
  const maybe = entry as unknown as { sizeBytes?: number | null }
  return typeof maybe.sizeBytes === "number" ? maybe.sizeBytes : 0
}

function highlightRow(entry: ResourceEntry): boolean {
  return Boolean(entry.renderBlocking) || Boolean(entry.duplicateTracker)
}

export function ResourcesReport() {
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
  const [tab, setTab] = useState<TabKey>("images")

  const resourcesQ = useQuery<ResourcesResult>({
    queryKey: ["resources", crawlId],
    queryFn: () => client.getResources(crawlId),
    enabled: Boolean(crawlId),
  })

  const allResources = resourcesQ.data?.resources ?? []
  const filtered = useMemo<ResourceEntry[]>(() => {
    const rows = allResources.filter((r) => matchesTab(r, tab))
    return rows.sort((a, b) => {
      const sizeDelta = entrySize(b) - entrySize(a)
      if (sizeDelta !== 0) return sizeDelta
      return b.sourcePageCount - a.sourcePageCount
    })
  }, [allResources, tab])

  const columns = useMemo<ColumnDef<ResourceEntry>[]>(
    () => [
      {
        id: "url",
        header: "URL",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {typeIcon(row.original.type)}
            <span
              className={cn(
                "block max-w-[420px] truncate font-mono text-xs",
                highlightRow(row.original) && "text-amber-700 dark:text-amber-300",
              )}
              title={row.original.url}
            >
              {row.original.url}
            </span>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.original.type}
          </span>
        ),
      },
      {
        id: "size",
        header: "Size",
        cell: ({ row }) => {
          const size = entrySize(row.original)
          if (size <= 0) {
            return (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                -
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex"
                      aria-label="Size not yet available"
                    >
                      <InfoIcon className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Resource sizes are not yet plumbed end to end.
                  </TooltipContent>
                </Tooltip>
              </span>
            )
          }
          return (
            <span className="tabular-nums text-xs">{formatBytes(size)}</span>
          )
        },
      },
      {
        id: "sourcePageCount",
        header: "Pages",
        cell: ({ row }) => (
          <SourcePageCell
            entry={row.original}
            tenantId={tenantId}
            siteId={siteId}
          />
        ),
      },
      {
        id: "flags",
        header: "Flags",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.renderBlocking ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                Render-blocking
              </Badge>
            ) : null}
            {row.original.duplicateTracker ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                Duplicate
              </Badge>
            ) : null}
            {!row.original.renderBlocking && !row.original.duplicateTracker ? (
              <span className="text-xs text-muted-foreground">-</span>
            ) : null}
          </div>
        ),
      },
    ],
    [tenantId, siteId],
  )

  const counts = {
    images: resourcesQ.data?.totalImages ?? 0,
    scripts: resourcesQ.data?.totalJs ?? 0,
    styles: resourcesQ.data?.totalCss ?? 0,
  }

  return (
    <TooltipProvider>
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
            <span>Resources</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
            <div className="flex items-center gap-2">
              <CsvExportButton
                path={`/api/crawls/${crawlId}/resources`}
                filename={`resources-${crawlId}.csv`}
              />
              <PdfExportButton
                path={`/api/crawls/${crawlId}/resources/pdf`}
                filename={`resources-${crawlId}.pdf`}
                tenantId={tenantId}
              />
              <ShareButton
                scope="CRAWL_REPORT"
                targetId={siteId}
                subResource="resources"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Images, scripts, and stylesheets discovered during the crawl.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="images">
              Images
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.images}
              </span>
            </TabsTrigger>
            <TabsTrigger value="scripts">
              Scripts
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.scripts}
              </span>
            </TabsTrigger>
            <TabsTrigger value="styles">
              Stylesheets
              <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                {counts.styles}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <ResourcesTable
              data={filtered}
              isLoading={resourcesQ.isLoading}
              isError={resourcesQ.isError}
              columns={columns}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

function ResourcesTable({
  data,
  columns,
  isLoading,
  isError,
}: {
  data: ResourceEntry[]
  columns: ColumnDef<ResourceEntry>[]
  isLoading: boolean
  isError: boolean
}) {
  // Apply the highlight class to flagged rows by overlaying a CSS rule via
  // a wrapper div + nth-child selectors. Easier: project a derived class list
  // alongside the data so we can hint the row through inline style. The
  // DataTable wrapper does not expose row-level className today; we settle
  // for highlighting the URL cell text plus a leading badge to make the
  // flagged rows scannable. The amber tint per row is applied by the
  // wrapping div via a data attribute and a corresponding global rule below.
  return (
    <div data-flagged-resources className="resources-report">
      <style>{`
        .resources-report tr[data-flagged="true"] {
          background-color: oklch(95% 0.06 90 / 0.18);
        }
      `}</style>
      <FlaggedRowMarker data={data} />
      <DataTable<ResourceEntry>
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyState={
          isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load resources.
            </span>
          ) : (
            "No resources of this type were found."
          )
        }
      />
    </div>
  )
}

// DataTable doesn't expose a per-row className hook, so we tag the rows after
// render via an effect-less DOM walk. We render this component above the
// table; on each commit it scans the sibling table for flagged URLs and
// stamps `data-flagged="true"` on the corresponding <tr>. Doing this in
// render rather than effect keeps the highlight in sync with virtualized
// reorderings.
function FlaggedRowMarker({ data }: { data: ResourceEntry[] }) {
  // Defer to a layout-effect via a callback ref on a hidden span so we run
  // after the sibling table has mounted into the DOM.
  return (
    <span
      ref={(node) => {
        if (!node) return
        const root = node.parentElement
        if (!root) return
        // Find every tbody tr inside the resources-report wrapper and stamp
        // by index. The DataTable renders rows in source order; data is the
        // same array.
        requestAnimationFrame(() => {
          const trs = root.querySelectorAll("tbody > tr")
          trs.forEach((tr, idx) => {
            const entry = data[idx]
            if (!entry) {
              tr.removeAttribute("data-flagged")
              return
            }
            if (highlightRow(entry)) {
              tr.setAttribute("data-flagged", "true")
            } else {
              tr.removeAttribute("data-flagged")
            }
          })
        })
      }}
      hidden
      aria-hidden
    />
  )
}

function SourcePageCell({
  entry,
  tenantId,
  siteId,
}: {
  entry: ResourceEntry
  tenantId: string
  siteId: string
}) {
  const sample = entry.originatingPages ?? []
  const count = entry.sourcePageCount
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  if (sample.length === 0) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {count}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Source pages
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {sample.map((url) => (
            <li key={url}>
              <Link
                to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(url)}`}
                className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
              >
                {url}
                <ExternalLinkIcon className="size-3 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
