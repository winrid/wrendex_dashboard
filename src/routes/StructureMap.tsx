// Site Structure Map (plan section 4.4 - R.04). Lands at
// /t/:tenantId/sites/:siteId/crawls/:crawlId/structure.
//
// Reads getStructure(crawlId) and renders a directory tree grouped by URL
// path prefix. Each row is a collapsible directory with a child list of the
// status-code badges the BE rolls up per directory. Click a leaf URL to
// navigate to PageDetail with crawlId pinned. Below the tree, the "Orphan
// pages" section fetches listCrawlAlerts(crawlId, type=ORPHAN_PAGE) and
// renders the URLs the BE flagged as not linked from any crawled page.
//
// Note: the BE's StructureExplorer.build returns a flat list of
// DirectoryNode entries keyed on the parent path (e.g. "/", "/blog/",
// "/docs/api/"). The tree below is hand-built client-side from that
// flat list so we can render the indented hierarchy without requiring a
// new BE endpoint.

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import type { DirectoryNode } from "@/api/types"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TreeNode = {
  segment: string
  fullPath: string
  depth: number
  data: DirectoryNode | null
  children: TreeNode[]
}

function buildTree(nodes: DirectoryNode[]): TreeNode {
  const root: TreeNode = {
    segment: "/",
    fullPath: "/",
    depth: 0,
    data: null,
    children: [],
  }
  const byPath = new Map<string, TreeNode>()
  byPath.set("/", root)

  // Ensure deterministic order (BE already returns a TreeMap-sorted list,
  // but we re-sort defensively after splitting into segments).
  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path))

  for (const node of sorted) {
    const path = node.path
    if (path === "/") {
      root.data = node
      continue
    }
    // BE always emits a trailing slash on directory paths. Strip the
    // leading + trailing slash and walk the segments.
    const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "")
    const segments = trimmed.length === 0 ? [] : trimmed.split("/")
    let parent = root
    let cumulative = "/"
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i]!
      cumulative = cumulative + seg + "/"
      let existing = byPath.get(cumulative)
      if (!existing) {
        existing = {
          segment: seg,
          fullPath: cumulative,
          depth: i + 1,
          data: null,
          children: [],
        }
        byPath.set(cumulative, existing)
        parent.children.push(existing)
      }
      parent = existing
      if (i === segments.length - 1) {
        parent.data = node
      }
    }
  }
  return root
}

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (code >= 300 && code < 400)
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (code >= 400 && code < 500)
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  if (code >= 500) return "bg-red-500/15 text-red-700 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function TreeRow({
  node,
  expandedPaths,
  toggle,
  tenantId,
  siteId,
  crawlId,
}: {
  node: TreeNode
  expandedPaths: Set<string>
  toggle: (path: string) => void
  tenantId: string
  siteId: string
  crawlId: string
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedPaths.has(node.fullPath)
  const indentPx = node.depth * 16
  const data = node.data
  const statusEntries = data
    ? Object.entries(data.statusCodeCounts ?? {})
    : []
  // BE's DirectoryNode is keyed on directory path (not per-page URL), so
  // a leaf row's "click to drill in" navigates to the Page Explorer for
  // this crawl rather than directly into Page Detail. Page Detail still
  // opens via the orphan list below or via the Page Explorer.
  const isLeafWithData = !hasChildren && data != null

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center gap-2 py-1.5 pr-3 text-sm"
        style={{ paddingLeft: `${8 + indentPx}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.fullPath)}
            className="inline-flex size-5 items-center justify-center rounded hover:bg-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-block size-5" />
        )}
        {isLeafWithData ? (
          <Link
            to={`/t/${tenantId}/sites/${siteId}/crawls/${crawlId}/pages`}
            className="truncate font-mono text-xs text-primary hover:underline"
            title={node.fullPath}
          >
            {node.segment === "/" ? "/" : node.segment + "/"}
          </Link>
        ) : (
          <span
            className="truncate font-mono text-xs"
            title={node.fullPath}
          >
            {node.segment === "/" ? "/" : node.segment + "/"}
          </span>
        )}
        <Badge variant="outline" className="text-[10px]">
          depth {node.depth}
        </Badge>
        {data ? (
          <Badge variant="outline" className="text-[10px]">
            {data.pageCount} {data.pageCount === 1 ? "page" : "pages"}
          </Badge>
        ) : null}
        {statusEntries.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            {statusEntries.map(([code, count]) => (
              <Badge
                key={code}
                className={cn("text-[10px]", statusBadgeClass(Number(code)))}
              >
                {code} x{count}
              </Badge>
            ))}
          </span>
        ) : null}
      </div>
      {hasChildren && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.fullPath}
              node={child}
              expandedPaths={expandedPaths}
              toggle={toggle}
              tenantId={tenantId}
              siteId={siteId}
              crawlId={crawlId}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function StructureMap() {
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

  const structureQ = useQuery<DirectoryNode[]>({
    queryKey: ["structure", crawlId],
    queryFn: () => client.getStructure(crawlId),
    enabled: Boolean(crawlId),
  })

  // ORPHAN_PAGE alerts surface pages with no incoming internal links.
  // Wrapped in its own query so a 4xx/5xx on the alerts endpoint does
  // not blank the whole report; the section just falls back to an
  // empty state.
  const orphansQ = useQuery({
    queryKey: ["crawl-orphan-alerts", crawlId],
    queryFn: () =>
      client.listCrawlAlerts(crawlId, { type: "ORPHAN_PAGE", size: 200 }),
    enabled: Boolean(crawlId),
  })

  const tree = useMemo(
    () => buildTree(structureQ.data ?? []),
    [structureQ.data],
  )

  // Default-expand the first two tree levels for orientation; deeper
  // directories stay collapsed so the surface area is manageable on
  // first paint.
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    initial.add("/")
    return initial
  })

  // Re-seed the expansion set when fresh data arrives so the homepage
  // and its immediate children are visible by default.
  useEffect(() => {
    if (!structureQ.data) return
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      next.add("/")
      for (const child of tree.children) {
        next.add(child.fullPath)
      }
      return next
    })
  }, [structureQ.data, tree])

  const toggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const orphanUrls = useMemo(() => {
    const items = orphansQ.data?.items ?? []
    return items.map((a) => a.pageUrl).filter((u): u is string => Boolean(u))
  }, [orphansQ.data])

  const isEmpty =
    !structureQ.isLoading &&
    (!structureQ.data || structureQ.data.length === 0)

  return (
    <div className="space-y-6">
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
          <span>Structure</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Site structure
        </h1>
        <p className="text-sm text-muted-foreground">
          Use the{" "}
          <Link
            to={`/t/${tenantId}/sites/${siteId}/crawls/${crawlId}/pages`}
            className="text-primary hover:underline"
          >
            Page Explorer
          </Link>{" "}
          for sortable, filterable views.
        </p>
      </div>

      <section className="rounded-md border bg-card">
        <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Directory tree
        </div>
        {structureQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : structureQ.isError ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">
            Could not load site structure.
          </div>
        ) : isEmpty ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No directories captured for this crawl yet.
          </div>
        ) : (
          <div>
            <TreeRow
              node={tree}
              expandedPaths={expandedPaths}
              toggle={toggle}
              tenantId={tenantId}
              siteId={siteId}
              crawlId={crawlId}
            />
          </div>
        )}
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Orphan pages
          </span>
          <Badge variant="outline">
            {orphansQ.isLoading ? "..." : `${orphanUrls.length} orphans`}
          </Badge>
        </div>
        {orphansQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : orphansQ.isError ? (
          <div className="p-6 text-sm text-muted-foreground">
            Orphan-page check has not run for this crawl.
          </div>
        ) : orphanUrls.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No orphan pages found - every crawled page is reachable from at
            least one internal link.
          </div>
        ) : (
          <ul className="divide-y">
            {orphanUrls.map((url) => (
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
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/t/${tenantId}/sites/${siteId}/crawls/${crawlId}/pages`}>
            Open Page Explorer
          </Link>
        </Button>
      </div>
    </div>
  )
}
