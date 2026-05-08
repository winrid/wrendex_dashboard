// Sites list (plan section 1.1 + 1.2). Lives in /t/:tenantId/sites; reads
// the tenant's sites from the typed client and joins each row to the most
// recent completed CrawlRun for the health score column. The "Add site"
// dialog wraps createSite + startCrawlAsync so the user lands on a site
// detail page that's already polling its first crawl.

import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { isApiError } from "@/api/client"
import type { CrawlRun, Site } from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VerificationDialog } from "@/components/site-verification/VerificationDialog"
import { Plus } from "lucide-react"
import { relativeTime, siteDisplayName } from "@/lib/format"
import { cn } from "@/lib/utils"
import { WrenMark } from "@/components/brand/WrenMark"

// Display row pulls health from a per-site crawl query so the column matches
// what SiteDetail renders. Keep `Site` bound to the API contract; layer the
// UI extras as a row type.
type SiteRow = Site & {
  displayName: string
  /** Health from the latest completed CrawlRun, or null while the per-row
   *  query is in flight. */
  healthScore: number | null
}

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 65) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function HealthCell({ siteId }: { siteId: string }) {
  const client = useApiClient()
  const q = useQuery({
    queryKey: ["site-runs", siteId],
    queryFn: () => client.listCrawlsBySite(siteId),
  })
  const completed = useMemo<CrawlRun | null>(() => {
    const runs = q.data
    if (!runs || runs.length === 0) return null
    return (
      runs
        .filter((r) => r.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        )[0] ?? null
    )
  }, [q.data])
  if (q.isLoading) return <span className="text-xs text-muted-foreground">...</span>
  if (!completed)
    return (
      <span className="text-xs text-muted-foreground">No crawl yet</span>
    )
  const score = completed.healthScore
  return (
    <Badge variant="outline" className={cn(scoreColor(score), "tabular-nums")}>
      {score}
    </Badge>
  )
}

function AddSiteDialog({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const client = useApiClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const site = await client.createSite(tenantId, { url: trimmed })
      try {
        await client.startCrawlAsync(site.id)
      } catch (err) {
        // 409 = already running; that's fine. Other errors fall through.
        if (!(isApiError(err) && err.status === 409)) {
          // eslint-disable-next-line no-console
          console.warn("startCrawlAsync after createSite failed", err)
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["sites", tenantId] })
      toast.success("Site added; crawl started")
      onOpenChange(false)
      setUrl("")
      navigate(`/t/${tenantId}/sites/${site.id}`)
    } catch (err) {
      const msg =
        isApiError(err) && typeof err.body === "string"
          ? err.body
          : "Could not add site"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a site</DialogTitle>
            <DialogDescription>
              We'll start the first crawl right away so you have a baseline
              health score in a few minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="site-url">Site URL</Label>
            <Input
              id="site-url"
              type="url"
              required
              autoFocus
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? "Adding..." : "Add site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Sites() {
  const navigate = useNavigate()
  const { tenantId = "default" } = useParams()
  const client = useApiClient()
  const [addOpen, setAddOpen] = useState(false)
  const [verifySiteId, setVerifySiteId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const sitesQ = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: () => client.listSitesByTenant(tenantId),
    enabled: Boolean(tenantId),
  })

  const rows: SiteRow[] = useMemo(
    () =>
      (sitesQ.data ?? []).map((s) => ({
        ...s,
        displayName: siteDisplayName(s.url),
        healthScore: null,
      })),
    [sitesQ.data],
  )

  const columns: ColumnDef<SiteRow>[] = [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <button
          className="font-medium hover:underline"
          onClick={() => navigate(`/t/${tenantId}/sites/${row.original.id}`)}
        >
          {row.original.displayName}
        </button>
      ),
    },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.url}</span>
      ),
    },
    {
      accessorKey: "lastCrawlAt",
      header: "Last crawl",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {relativeTime(row.original.lastCrawlAt)}
        </span>
      ),
    },
    {
      id: "verification",
      header: "Verification",
      cell: ({ row }) =>
        row.original.verifiedAt ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            Verified
          </Badge>
        ) : (
          <button
            type="button"
            onClick={() => setVerifySiteId(row.original.id)}
            className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          >
            Unverified
          </button>
        ),
    },
    {
      id: "healthScore",
      header: "Health",
      cell: ({ row }) => <HealthCell siteId={row.original.id} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Monitor crawl health across every site under this tenant.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          <span>Add site</span>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={sitesQ.isLoading}
        emptyState={
          sitesQ.isError ? (
            "Could not load sites."
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <WrenMark className="size-16 opacity-60" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No sites yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Click Add site to start monitoring one.
                </p>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus />
                <span>Add your first site</span>
              </Button>
            </div>
          )
        }
      />
      <AddSiteDialog
        tenantId={tenantId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      {verifySiteId ? (
        <VerificationDialog
          siteId={verifySiteId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setVerifySiteId(null)
          }}
          onVerified={() => {
            void queryClient.invalidateQueries({
              queryKey: ["sites", tenantId],
            })
          }}
        />
      ) : null}
    </div>
  )
}
