// Spot-audit launcher (plan section P4 iter 1, task 4). Lands at
// /t/:tenantId/sites/:siteId/spot-audit.
//
// One textarea + a "Upload .txt file" button (FileReader). The user pastes
// or uploads a list of URLs (one per line), we split + dedupe, and POST
// startSpotAudit. Validation is layered:
//
//   - URLs must be HTTP/HTTPS (client-side hard error)
//   - Cap at 1000 URLs (client-side hard error; matches BE cap)
//   - URLs that don't share the site's hostname are flagged inline as a
//     warning, not blocked (the BE 400s if any URL fails the hostname
//     check; we surface that response)
//
// On 202 we navigate to the queued crawl detail page; the existing
// crawl-history listing surfaces the run once the worker picks it up.

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { UploadIcon, ZapIcon } from "lucide-react"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type { Site } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { siteDisplayName } from "@/lib/format"

const MAX_URLS = 1000

type UrlPartition = {
  /** All non-empty trimmed lines, in original order, deduped. */
  all: string[]
  /** Lines that don't parse as HTTP/HTTPS URLs. */
  invalid: string[]
  /** URLs whose hostname doesn't match the site's hostname (warn, don't block). */
  offSite: string[]
}

export function splitUrls(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  )
}

function siteHostname(site: Site | undefined | null): string | null {
  if (!site) return null
  try {
    return new URL(site.url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function partitionUrls(urls: string[], expectedHost: string | null): UrlPartition {
  const invalid: string[] = []
  const offSite: string[] = []
  for (const u of urls) {
    let parsed: URL | null = null
    try {
      parsed = new URL(u)
    } catch {
      invalid.push(u)
      continue
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      invalid.push(u)
      continue
    }
    if (expectedHost) {
      const host = parsed.hostname.replace(/^www\./, "")
      if (host !== expectedHost) {
        offSite.push(u)
      }
    }
  }
  return { all: urls, invalid, offSite }
}

export function SpotAudit() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const client = useApiClient()
  const navigate = useNavigate()

  const [text, setText] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const siteQ = useQuery({
    queryKey: ["site", tenantId, siteId],
    queryFn: () => client.getSite(tenantId, siteId),
    enabled: Boolean(tenantId && siteId),
  })

  const expectedHost = siteHostname(siteQ.data)

  const urls = useMemo(() => splitUrls(text), [text])
  const partition = useMemo(
    () => partitionUrls(urls, expectedHost),
    [urls, expectedHost],
  )

  const tooMany = urls.length > MAX_URLS
  const hasInvalid = partition.invalid.length > 0
  const canSubmit = urls.length > 0 && !tooMany && !hasInvalid

  const startMut = useMutation({
    mutationFn: () => client.startSpotAudit(siteId, { urls }),
    onSuccess: (run) => {
      toast.success("Spot audit queued")
      navigate(`/t/${tenantId}/sites/${siteId}/crawls/${run.id}`)
    },
    onError: (e) => {
      if (isApiError(e)) {
        const msg =
          typeof e.body === "string"
            ? e.body
            : typeof (e.body as { message?: string } | null)?.message ===
                "string"
              ? (e.body as { message: string }).message
              : e.message
        if (e.status === 403) {
          setServerError(
            msg ||
              "This audit exceeds your plan's per-audit page cap. Upgrade in Billing.",
          )
          return
        }
        if (e.status === 400) {
          setServerError(msg || "One or more URLs were rejected by the server.")
          return
        }
        if (e.status === 404) {
          setServerError(
            "Spot-audit endpoint not yet available on this backend.",
          )
          return
        }
      }
      setServerError("Could not start spot audit.")
    },
  })

  // Reset the server error when the textarea changes so a stale error from
  // a previous submit doesn't linger after the user has fixed the input.
  useEffect(() => {
    setServerError(null)
  }, [text])

  const onUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        setText((prev) => (prev.trim().length > 0 ? prev + "\n" + result : result))
      }
    }
    reader.onerror = () => {
      toast.error("Could not read file")
    }
    reader.readAsText(file)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || startMut.isPending) return
    setServerError(null)
    startMut.mutate()
  }

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
          <span>Spot audit</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Spot audit</h1>
        <p className="text-sm text-muted-foreground">
          Audit a hand-picked list of URLs without waiting for the next
          scheduled crawl. Up to {MAX_URLS} URLs per run, all on{" "}
          <span className="font-medium">
            {expectedHost ?? siteDisplayName(siteQ.data?.url ?? "this site")}
          </span>
          .
        </p>
      </div>

      <form
        className="space-y-4 rounded-md border bg-card p-4"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="spot-audit-urls">URLs</Label>
            <div className="flex items-center gap-2">
              <input
                id="spot-audit-upload"
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0]
                  if (f) onUpload(f)
                  e.currentTarget.value = ""
                }}
                data-testid="spot-audit-upload-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.getElementById(
                    "spot-audit-upload",
                  ) as HTMLInputElement | null
                  input?.click()
                }}
                data-testid="spot-audit-upload-button"
              >
                <UploadIcon />
                <span>Upload .txt file</span>
              </Button>
            </div>
          </div>
          <Textarea
            id="spot-audit-urls"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"https://example.com/one\nhttps://example.com/two\nhttps://example.com/three"}
            rows={10}
            className="font-mono text-xs"
            data-testid="spot-audit-textarea"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="spot-audit-count">
              {urls.length} URL{urls.length === 1 ? "" : "s"}
              {tooMany ? (
                <span className="ml-1 text-destructive">
                  (max {MAX_URLS})
                </span>
              ) : null}
            </span>
            <span>One URL per line</span>
          </div>
        </div>

        {hasInvalid ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            data-testid="spot-audit-invalid"
          >
            {partition.invalid.length} URL
            {partition.invalid.length === 1 ? "" : "s"} are not valid HTTP /
            HTTPS URLs. Fix or remove them before submitting.
          </div>
        ) : null}

        {!hasInvalid && partition.offSite.length > 0 ? (
          <div
            className="rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            data-testid="spot-audit-offsite"
          >
            {partition.offSite.length} URL
            {partition.offSite.length === 1 ? "" : "s"} don't share the site's
            hostname ({expectedHost}). The server will reject them; remove
            them to be safe.
          </div>
        ) : null}

        {serverError ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            data-testid="spot-audit-server-error"
          >
            {serverError}
            {serverError.toLowerCase().includes("plan") ? (
              <>
                {" "}
                <Link
                  to={`/t/${tenantId}/billing`}
                  className="font-medium underline underline-offset-2"
                >
                  Open billing
                </Link>
                .
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/t/${tenantId}/sites/${siteId}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || startMut.isPending}
            data-testid="spot-audit-submit"
          >
            <ZapIcon />
            {startMut.isPending ? "Queueing..." : "Start spot audit"}
          </Button>
        </div>
      </form>
    </div>
  )
}

// Re-export internal helpers as named exports for tests.
export { partitionUrls }
// Keep ApiError re-export so unit tests don't need to reach into the
// internal client module path when asserting error branches.
export { ApiError as _SpotAuditApiError }
