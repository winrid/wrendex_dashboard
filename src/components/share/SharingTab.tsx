// Sharing tab on /t/:tenantId/settings (plan section P3 iter 2 FE-B).
// Bound to listShareLinks(tenantId); each row exposes the URL + a copy
// button + a Revoke action. The "Show revoked" toggle re-fetches with
// includeRevoked=true so admins can audit historical access.

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { CheckIcon, CopyIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import type { ShareLink } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

function rowSummary(link: ShareLink): string {
  if (link.label && link.label.trim().length > 0) return link.label
  if (link.scope === "SITE") return "Site overview"
  if (link.scope === "PAGE_DETAIL") return "Page detail"
  if (link.subResource) {
    return `Crawl report: ${link.subResource}`
  }
  return "Crawl report"
}

function scopeBadgeClass(link: ShareLink): string {
  if (link.scope === "SITE")
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (link.scope === "PAGE_DETAIL")
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
}

function CopyUrlCell({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }
  return (
    <div className="flex max-w-[360px] items-center gap-2">
      <span
        className="block flex-1 truncate font-mono text-xs"
        title={url}
      >
        {url}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onCopy}
        aria-label="Copy share URL"
        data-testid="share-row-copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

export function SharingTab({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [includeRevoked, setIncludeRevoked] = useState(false)

  const sharesQ = useQuery<ShareLink[]>({
    queryKey: ["share-links", tenantId, { includeRevoked }],
    queryFn: () => client.listShareLinks(tenantId, { includeRevoked }),
    enabled: Boolean(tenantId),
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => client.revokeShareLink(tenantId, id),
    onSuccess: () => {
      toast.success("Share link revoked")
      void queryClient.invalidateQueries({
        queryKey: ["share-links", tenantId],
      })
    },
    onError: () => toast.error("Could not revoke share link"),
  })

  const links = sharesQ.data ?? []

  const columns = useMemo<ColumnDef<ShareLink>[]>(
    () => [
      {
        id: "summary",
        header: "Summary",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{rowSummary(row.original)}</div>
            <div className="flex items-center gap-1">
              <Badge className={cn("text-[10px]", scopeBadgeClass(row.original))}>
                {row.original.scope}
              </Badge>
              {row.original.subResource ? (
                <Badge
                  variant="outline"
                  className="text-[10px] capitalize"
                >
                  {row.original.subResource}
                </Badge>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "url",
        header: "URL",
        cell: ({ row }) => <CopyUrlCell url={row.original.url} />,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground"
            title={row.original.createdAt}
          >
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "expiresAt",
        header: "Expires",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground"
            title={row.original.expiresAt ?? undefined}
          >
            {row.original.expiresAt
              ? relativeTime(row.original.expiresAt)
              : "Never"}
          </span>
        ),
      },
      {
        id: "passwordProtected",
        header: "",
        cell: ({ row }) =>
          row.original.passwordProtected ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title="Password-protected"
            >
              <LockIcon className="size-3" />
              <span className="sr-only">Password protected</span>
            </span>
          ) : null,
      },
      {
        id: "viewCount",
        header: "Views",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.viewCount ?? 0}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.revokedAt ? (
            <Badge className="bg-muted text-muted-foreground">Revoked</Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Active
            </Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (row.original.revokedAt) {
            return null
          }
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={revokeMut.isPending}
              onClick={() => revokeMut.mutate(row.original.id)}
              data-testid={`share-revoke-${row.original.id}`}
            >
              Revoke
            </Button>
          )
        },
      },
    ],
    [revokeMut],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sharing</CardTitle>
        <CardDescription>
          Read-only public links into reports. Anyone with the link (and the
          password, when set) can view the report until you revoke it or the
          link expires.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {links.length} link{links.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Switch
              id="show-revoked"
              checked={includeRevoked}
              onCheckedChange={(v) => setIncludeRevoked(Boolean(v))}
              data-testid="show-revoked-toggle"
            />
            <Label htmlFor="show-revoked" className="text-xs">
              Show revoked
            </Label>
          </div>
        </div>
        <DataTable<ShareLink>
          columns={columns}
          data={links}
          isLoading={sharesQ.isLoading}
          emptyState={
            sharesQ.isError ? (
              <span className="text-red-600 dark:text-red-400">
                Could not load share links.
              </span>
            ) : (
              "No share links yet. Use the Share button on any report to create one."
            )
          }
        />
      </CardContent>
    </Card>
  )
}
