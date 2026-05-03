// Public shared-view route (plan section P3 iter 2 FE-B). Mounted above
// RequireAuth at /shared/:token. The recipient hits the page with no
// session; the route resolves the share via POST /api/shared/{token}
// (skipAuth) and dispatches on share.scope into the matching read-only
// renderer:
//
//   SITE          -> SiteDetail header + ring + sparkline + issue queue.
//   CRAWL_REPORT  -> matching report (PageExplorer / LinkExplorer / Redirects
//                    / Duplicates / Resources / StructuredData) wrapped in
//                    the ReadOnlyProvider so action buttons hide.
//   PAGE_DETAIL   -> Page detail tabs.
//
// We mount the existing report components under a ReadOnlyProvider so we
// don't have to fork them; the few action buttons that would mutate state
// (Run audit, Pause, Settings, Ignore / Unignore) check useReadOnly() and
// hide themselves.
//
// Banner: small strip at the top with "Read-only share from <tenantName>.
// Expires <relative>." plus the Wrendex logo. No sidebar, no tenant
// switcher.

import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type {
  SharedLinkInfo,
  SharedLinkPayload,
  SharedLinkResult,
} from "@/api/types"
import { ReadOnlyProvider } from "@/components/share/ReadOnlyContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge-fallback"
import { HealthRing } from "@/components/health-ring/HealthRing"
import { HealthSparkline } from "@/components/site-detail/HealthSparkline"
import { IssueQueue } from "@/components/site-detail/IssueQueue"
import { relativeTime, siteDisplayName } from "@/lib/format"
import { ExternalLinkIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when the BE returned the documented 401 password-prompt body. The
 *  ApiError body shape is `{passwordRequired: true}` per the wire contract. */
function isPasswordRequired(e: unknown): boolean {
  if (!isApiError(e)) return false
  if (e.status !== 401) return false
  const body = e.body as { passwordRequired?: boolean } | null | undefined
  return Boolean(body?.passwordRequired)
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function Banner({ info }: { info: SharedLinkInfo }) {
  const expiresLabel = info.expiresAt
    ? `Expires ${relativeTime(info.expiresAt)}.`
    : "No expiry."
  // Apply white-label branding (plan section 12.3) when the BE supplied it
  // on the resolve payload. Defaults to the Wrendex logo + brand mark when
  // missing; the BE-C agent extends SharedLinkInfo with these fields.
  return (
    <header
      className="border-b bg-card"
      data-testid="shared-banner"
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          {info.logoDataUrl ? (
            <img
              src={info.logoDataUrl}
              alt={`${info.tenantName} logo`}
              className="h-7 w-auto max-w-[10rem] object-contain"
              data-testid="shared-branded-logo"
            />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              W
            </div>
          )}
          <div className="text-sm">
            {info.logoDataUrl ? null : (
              <span className="font-medium">Wrendex</span>
            )}
            <span className={info.logoDataUrl ? "text-muted-foreground" : "ml-2 text-muted-foreground"}>
              Read-only share from {info.tenantName}.
            </span>
            <span className="ml-1 text-muted-foreground">{expiresLabel}</span>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          Read-only
        </Badge>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Password prompt
// ---------------------------------------------------------------------------

function PasswordPrompt({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (password: string) => void
  pending: boolean
  error: string | null
}) {
  const [password, setPassword] = useState("")
  return (
    <div className="mx-auto mt-12 max-w-sm rounded-md border bg-card p-6">
      <h2 className="text-lg font-semibold">Password required</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This share link is password-protected. Enter the password the sender
        gave you.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(password)
        }}
        data-testid="share-password-form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="shared-password">Password</Label>
          <Input
            id="shared-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoFocus
            data-testid="shared-password-input"
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={pending || password.length === 0}
          data-testid="shared-password-submit"
        >
          {pending ? "Checking..." : "Unlock"}
        </Button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SITE renderer (overview + ring + sparkline + issue queue)
// ---------------------------------------------------------------------------

function SiteSharedView({
  info,
  payload,
}: {
  info: SharedLinkInfo
  payload: SharedLinkPayload
}) {
  const site = payload.site
  if (!site) {
    return <EmptyPayload reason="The share is missing site data." />
  }
  const sortedHealth = useMemo(() => {
    const points = payload.healthScore ?? []
    if (points.length === 0) return { latest: null, previous: null }
    const sorted = [...points].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
    return {
      latest: sorted[sorted.length - 1] ?? null,
      previous: sorted.length >= 2 ? sorted[sorted.length - 2]! : null,
    }
  }, [payload.healthScore])

  const ringScore = sortedHealth.latest?.healthScore ?? 0
  const ringDelta =
    sortedHealth.latest && sortedHealth.previous
      ? sortedHealth.latest.healthScore - sortedHealth.previous.healthScore
      : null
  const crawl = payload.crawlRun
  const ringSample = crawl?.pagesCrawled ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {info.siteDisplayName ?? siteDisplayName(site.url)}
          </h1>
          <a
            href={site.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            {site.url}
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="rounded-md border bg-card p-4">
          {sortedHealth.latest ? (
            <HealthRing
              score={ringScore}
              delta={ringDelta}
              sample={ringSample}
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground">
              No score yet
            </div>
          )}
        </div>
        <div className="rounded-md border bg-card p-4">
          <HealthSparkline
            points={payload.healthScore ?? []}
            tenantId="shared"
            siteId={site.id}
          />
        </div>
      </div>

      {payload.issuesSummary && crawl ? (
        <IssueQueue
          tenantId="shared"
          crawlId={crawl.id}
          summary={payload.issuesSummary}
          healthScore={ringScore}
        />
      ) : (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No issues attached to this share.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CRAWL_REPORT renderer (delegates to the matching report component, but
// renders the relevant slice from the prefetched payload to avoid a second
// authenticated round-trip the recipient cannot make).
// ---------------------------------------------------------------------------

function CrawlReportSharedView({
  info,
  payload,
}: {
  info: SharedLinkInfo
  payload: SharedLinkPayload
}) {
  const sub = info.subResource
  const heading =
    sub === "redirects"
      ? "Redirect chains"
      : sub === "duplicates"
        ? "Duplicate content"
        : sub === "structured-data"
          ? "Structured data"
          : sub === "links"
            ? "Link explorer"
            : sub === "pages"
              ? "Page explorer"
              : sub === "resources"
                ? "Resources"
                : sub === "issues"
                  ? "Issues"
                  : "Crawl report"

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          Read-only snapshot from {info.tenantName}.
        </p>
      </div>
      <SubResourceBody payload={payload} sub={sub ?? null} />
    </div>
  )
}

function SubResourceBody({
  payload,
  sub,
}: {
  payload: SharedLinkPayload
  sub: SharedLinkInfo["subResource"]
}) {
  if (sub === "pages") {
    return <PagesPanel payload={payload} />
  }
  if (sub === "links") {
    return <LinksPanel payload={payload} />
  }
  if (sub === "redirects") {
    return <RedirectsPanel payload={payload} />
  }
  if (sub === "duplicates") {
    return <DuplicatesPanel payload={payload} />
  }
  if (sub === "resources") {
    return <ResourcesPanel payload={payload} />
  }
  if (sub === "structured-data") {
    return <StructuredDataPanel payload={payload} />
  }
  return <EmptyPayload reason="This share targets an unsupported report." />
}

function EmptyPayload({ reason }: { reason: string }) {
  return (
    <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
      {reason}
    </div>
  )
}

function PagesPanel({ payload }: { payload: SharedLinkPayload }) {
  const pages = payload.pages?.pages ?? []
  if (pages.length === 0) return <EmptyPayload reason="No pages in this share." />
  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {pages.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span
                className="block truncate font-mono text-xs"
                title={p.url}
              >
                {p.url}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">HTTP {p.statusCode}</Badge>
              <span className="tabular-nums text-muted-foreground">
                {p.responseTimeMs}ms
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LinksPanel({ payload }: { payload: SharedLinkPayload }) {
  const links = payload.links?.links ?? []
  if (links.length === 0) return <EmptyPayload reason="No links in this share." />
  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {links.map((l, idx) => (
          <li
            key={`${l.sourceUrl}-${l.targetUrl}-${idx}`}
            className="px-3 py-2 text-sm"
          >
            <div className="grid gap-1 md:grid-cols-2">
              <span
                className="truncate font-mono text-xs"
                title={l.sourceUrl}
              >
                {l.sourceUrl}
              </span>
              <span
                className="truncate font-mono text-xs"
                title={l.targetUrl}
              >
                {l.targetUrl}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RedirectsPanel({ payload }: { payload: SharedLinkPayload }) {
  const entries = payload.redirects?.entries ?? []
  if (entries.length === 0)
    return <EmptyPayload reason="No redirect chains in this share." />
  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.sourceUrl} className="px-3 py-2 text-sm">
            <div className="font-mono text-xs">{e.sourceUrl}</div>
            <div className="font-mono text-xs text-muted-foreground">
              -&gt; {e.finalUrl} ({e.chainLength} hops, status {e.statusCode})
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DuplicatesPanel({ payload }: { payload: SharedLinkPayload }) {
  const groups = payload.duplicates?.groups ?? []
  if (groups.length === 0)
    return <EmptyPayload reason="No duplicate clusters in this share." />
  return (
    <div className="space-y-2">
      {groups.map((g, idx) => (
        <div
          key={`${g.field}-${g.hash ?? g.value ?? idx}`}
          className="rounded-md border bg-card p-3"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {g.field}
            </Badge>
            <span>{g.urls.length} pages</span>
          </div>
          <ul className="divide-y">
            {g.urls.map((u) => (
              <li key={u} className="py-1 font-mono text-xs">
                {u}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ResourcesPanel({ payload }: { payload: SharedLinkPayload }) {
  const resources = payload.resources?.resources ?? []
  if (resources.length === 0)
    return <EmptyPayload reason="No resources in this share." />
  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {resources.map((r) => (
          <li
            key={r.url}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="block truncate font-mono text-xs" title={r.url}>
              {r.url}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {r.type}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StructuredDataPanel({ payload }: { payload: SharedLinkPayload }) {
  const entries = payload.structuredData?.entries ?? []
  if (entries.length === 0)
    return <EmptyPayload reason="No structured-data entries in this share." />
  return (
    <div className="rounded-md border bg-card">
      <ul className="divide-y">
        {entries.map((e) => (
          <li
            key={e.url}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="block truncate font-mono text-xs" title={e.url}>
              {e.url}
            </span>
            <span className="text-xs text-muted-foreground">
              {e.scriptCount} scripts, {e.types.length} types
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE_DETAIL renderer
// ---------------------------------------------------------------------------

function PageDetailSharedView({ payload }: { payload: SharedLinkPayload }) {
  const page = payload.page
  if (!page) {
    return <EmptyPayload reason="The share is missing page data." />
  }
  const alerts = payload.pageAlerts ?? []
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight break-all">
          {page.title || page.url}
        </h1>
        <a
          href={page.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 break-all font-mono text-xs text-muted-foreground hover:underline"
        >
          {page.url}
          <ExternalLinkIcon className="size-3" />
        </a>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">HTTP {page.statusCode}</Badge>
          <span className="tabular-nums text-muted-foreground">
            Response {page.responseTimeMs}ms
          </span>
          <span className="tabular-nums text-muted-foreground">
            TTFB {page.ttfbMs}ms
          </span>
          <span className="tabular-nums text-muted-foreground">
            {page.wordCount} words
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Kv label="Title" value={page.title} />
        <Kv label="Meta description" value={page.metaDescription} />
        <Kv label="H1" value={page.h1} />
        <Kv label="Canonical" value={page.canonicalUrl} />
        <Kv label="Robots" value={page.robotsMeta} />
        <Kv label="Lang" value={page.lang} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Alerts ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            No alerts on this page.
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {a.severity}
                    </Badge>
                    <span className="font-medium">{a.type}</span>
                  </div>
                  {a.message ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.message}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Kv({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm">
        {value && value.trim().length > 0 ? value : (
          <span className="text-muted-foreground">(empty)</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function SharedView() {
  const { token = "" } = useParams<{ token: string }>()
  const client = useApiClient()
  const queryClient = useQueryClient()

  // Initial GET of the share. We use the POST resolver with no password to
  // surface the password-prompt 401 in the same code path; on success the
  // result lands in the query cache and we never re-fetch.
  const initialQ = useQuery<SharedLinkResult, ApiError>({
    queryKey: ["shared-link", token, { password: null }],
    queryFn: () => client.resolveSharedLink(token, {}),
    enabled: Boolean(token),
    retry: false,
  })

  const [passwordError, setPasswordError] = useState<string | null>(null)

  const unlockMut = useMutation({
    mutationFn: (password: string) =>
      client.resolveSharedLink(token, { password }),
    onSuccess: (result) => {
      // Mirror the unlocked result onto the initial query key so the rest of
      // the component reads through one source of truth.
      queryClient.setQueryData<SharedLinkResult>(
        ["shared-link", token, { password: null }],
        result,
      )
      setPasswordError(null)
    },
    onError: (e) => {
      if (isPasswordRequired(e)) {
        setPasswordError("Wrong password. Try again.")
      } else if (isApiError(e) && e.status === 404) {
        setPasswordError("This share link is no longer available.")
      } else {
        setPasswordError("Could not unlock the share. Try again.")
      }
    },
  })

  // Reset password error when the user navigates to a different token (rare
  // but possible if they paste a new URL into the same tab).
  useEffect(() => {
    setPasswordError(null)
  }, [token])

  const result = initialQ.data
  const initialErr = initialQ.error
  const isPasswordPath =
    !result &&
    (isPasswordRequired(initialErr) ||
      isPasswordRequired(unlockMut.error) ||
      passwordError != null)

  if (initialQ.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto mt-12 max-w-md text-center text-sm text-muted-foreground">
          Loading share...
        </div>
        <Toaster />
      </div>
    )
  }

  // 404 - link revoked / expired.
  if (
    !result &&
    initialErr instanceof ApiError &&
    initialErr.status === 404
  ) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto mt-12 max-w-md rounded-md border bg-card p-6 text-center text-sm">
          <h1 className="text-base font-semibold">Share unavailable</h1>
          <p className="mt-2 text-muted-foreground">
            This share link is no longer available.
          </p>
        </div>
        <Toaster />
      </div>
    )
  }

  // 401 password-required.
  if (isPasswordPath) {
    return (
      <div className="min-h-screen bg-background">
        <PasswordPrompt
          onSubmit={(p) => unlockMut.mutate(p)}
          pending={unlockMut.isPending}
          error={passwordError}
        />
        <Toaster />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto mt-12 max-w-md rounded-md border bg-card p-6 text-center text-sm">
          <h1 className="text-base font-semibold">Could not load share</h1>
          <p className="mt-2 text-muted-foreground">
            Please refresh the page or contact the sender for a new link.
          </p>
        </div>
        <Toaster />
      </div>
    )
  }

  const { share, payload } = result

  return (
    <ReadOnlyProvider value={true}>
      <SharedBrandingApplier info={share} />
      <div className="min-h-screen bg-background">
        <Banner info={share} />
        <main className="mx-auto max-w-screen-2xl p-6">
          {share.scope === "SITE" ? (
            <SiteSharedView info={share} payload={payload} />
          ) : share.scope === "PAGE_DETAIL" ? (
            <PageDetailSharedView payload={payload} />
          ) : (
            <CrawlReportSharedView info={share} payload={payload} />
          )}
        </main>
        {share.hidePoweredBy ? null : (
          <footer
            className="border-t bg-card py-3 text-center text-xs text-muted-foreground"
            data-testid="shared-powered-by"
          >
            Powered by Wrendex
          </footer>
        )}
        <Toaster />
      </div>
    </ReadOnlyProvider>
  )
}

/** Applies the shared link's accent colour to document.documentElement
 *  while the shared view is mounted. Cleans up on unmount so navigating
 *  back to a tenant-scoped page restores the (auth-driven) branding.
 *  Plan section 12.3. */
function SharedBrandingApplier({ info }: { info: SharedLinkInfo }) {
  useEffect(() => {
    if (typeof document === "undefined") return
    const accent = info.accentColor
    if (!accent) return
    const previous = document.documentElement.style.getPropertyValue(
      "--brand-accent",
    )
    document.documentElement.style.setProperty("--brand-accent", accent)
    return () => {
      if (previous) {
        document.documentElement.style.setProperty(
          "--brand-accent",
          previous,
        )
      } else {
        document.documentElement.style.removeProperty("--brand-accent")
      }
    }
  }, [info.accentColor])
  return null
}
