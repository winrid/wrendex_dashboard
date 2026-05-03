// Duplicate Content report (plan section 4.6 - R.06). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/duplicates.
//
// Reads getDuplicates(crawlId) once, then filters the loaded clusters
// client-side by their `field` discriminator into three shadcn Tabs:
//   - "Title"        -> field === "title"
//   - "Description"  -> field === "metaDescription"
//   - "Body"         -> field === "content" (BE bucket for content-hash
//                       duplicates; the BE leaves `value` null and stamps
//                       the contentHash onto the `hash` field instead).
//
// Each cluster card shows the count, the discriminator value (or hash for
// body dups), and a severity badge based on cluster size. Expanding the
// card lists the duplicate URLs, each linking to PageDetail.
//
// NOTE: BE also emits "h1" duplicate groups; the plan scopes this view
// to the three tabs above so h1 groups are intentionally not surfaced
// here. Surface h1 in a future iteration if the spec opens up.

import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type { DuplicateGroup, DuplicatesResult } from "@/api/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge-fallback"
import { CsvExportButton } from "@/components/csv/CsvExportButton"
import { ShareButton } from "@/components/share/ShareButton"
import { cn } from "@/lib/utils"

type TabKind = "title" | "description" | "body"

const TAB_LABEL: Record<TabKind, string> = {
  title: "Title",
  description: "Description",
  body: "Body",
}

const TAB_EMPTY_LABEL: Record<TabKind, string> = {
  title: "title",
  description: "description",
  body: "body",
}

function fieldFor(tab: TabKind): string {
  if (tab === "title") return "title"
  if (tab === "description") return "metaDescription"
  return "content"
}

function severityClass(count: number): string {
  if (count >= 10) return "bg-red-500/15 text-red-700 dark:text-red-300"
  if (count >= 4) return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
}

function severityLabel(count: number): string {
  if (count >= 10) return "high"
  if (count >= 4) return "medium"
  return "low"
}

function clusterTitle(group: DuplicateGroup): string {
  if (group.value && group.value.trim().length > 0) return group.value
  if (group.hash && group.hash.trim().length > 0) {
    return `hash ${group.hash.slice(0, 12)}`
  }
  return "(unnamed cluster)"
}

function ClusterCard({
  group,
  index,
  tenantId,
  siteId,
  crawlId,
}: {
  group: DuplicateGroup
  index: number
  tenantId: string
  siteId: string
  crawlId: string
}) {
  const [open, setOpen] = useState(false)
  const count = group.urls.length
  const title = clusterTitle(group)
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
        <Badge className={cn("text-[10px]", severityClass(count))}>
          {severityLabel(count)} - {count} pages
        </Badge>
        <span
          className="truncate text-sm font-medium"
          title={title}
        >
          {title}
        </span>
      </button>
      {open ? (
        <ul className="divide-y border-t">
          {group.urls.map((url) => (
            <li key={url} className="px-3 py-2">
              <Link
                to={`/t/${tenantId}/sites/${siteId}/pages?url=${encodeURIComponent(url)}&crawlId=${encodeURIComponent(crawlId)}`}
                className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
              >
                {url}
                <ExternalLinkIcon className="size-3 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function DuplicatesReport() {
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
  const [tab, setTab] = useState<TabKind>("title")

  const dupQ = useQuery<DuplicatesResult>({
    queryKey: ["duplicates", crawlId],
    queryFn: () => client.getDuplicates(crawlId),
    enabled: Boolean(crawlId),
  })

  const groups = dupQ.data?.groups ?? []
  function filterFor(kind: TabKind): DuplicateGroup[] {
    const target = fieldFor(kind)
    return groups.filter((g) => g.field === target)
  }

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
          <span>Duplicates</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Duplicate content
          </h1>
          <div className="flex items-center gap-2">
            <CsvExportButton
              path={`/api/crawls/${crawlId}/duplicates`}
              filename={`duplicates-${crawlId}.csv`}
            />
            <ShareButton
              scope="CRAWL_REPORT"
              targetId={siteId}
              subResource="duplicates"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {dupQ.data?.totalDuplicateGroups ?? 0} clusters
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKind)}>
        <TabsList>
          <TabsTrigger value="title">{TAB_LABEL.title}</TabsTrigger>
          <TabsTrigger value="description">
            {TAB_LABEL.description}
          </TabsTrigger>
          <TabsTrigger value="body">{TAB_LABEL.body}</TabsTrigger>
        </TabsList>

        {(["title", "description", "body"] as TabKind[]).map((kind) => {
          const filtered = filterFor(kind)
          return (
            <TabsContent key={kind} value={kind} className="mt-4">
              {dupQ.isLoading ? (
                <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : dupQ.isError ? (
                <div className="rounded-md border bg-card p-6 text-sm text-red-600 dark:text-red-400">
                  Could not load duplicates.
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
                  No duplicate {TAB_EMPTY_LABEL[kind]} found in this crawl.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((group, idx) => (
                    <ClusterCard
                      key={`${group.field}-${group.hash ?? group.value ?? idx}`}
                      group={group}
                      index={idx}
                      tenantId={tenantId}
                      siteId={siteId}
                      crawlId={crawlId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
