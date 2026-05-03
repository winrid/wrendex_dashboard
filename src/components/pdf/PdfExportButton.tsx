// Shared "Export PDF" button used by every report toolbar (plan section
// 12.2). Sits next to the existing CsvExportButton and pipes the BE's
// application/pdf response through the download.ts blob helper.
//
// The PDF endpoints are plan-gated to PROFESSIONAL or AGENCY tiers; the
// BE returns 403 for STARTER tenants. We catch that here and toast an
// upgrade prompt with a link to the tenant's Billing page so the user can
// recover in two clicks.
//
// AGENTS.md note: this component does not construct a backend URL itself.
// Callers pass the absolute path the BE serves the PDF from (e.g.
// "/api/crawls/{crawlId}/pages/pdf") and we hand it to the typed-client
// base URL resolver in src/lib/download.ts. There is no JSON form to
// content-negotiate against; the PDF endpoints are dedicated.

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DownloadError, downloadPdf } from "@/lib/download"

const DEFAULT_BASE_URL = "http://localhost:7070"

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv
  return DEFAULT_BASE_URL
}

/** Build a fully-qualified BE URL for the supplied path. The PDF endpoints
 *  do not take any query params today; we still URL-encode the join so a
 *  trailing slash on the base doesn't double-up. */
function pdfUrl(path: string): string {
  const base = resolveBaseUrl().replace(/\/$/, "")
  return base + path
}

export type PdfExportButtonProps = {
  /** BE path (relative to the API base URL) of the PDF endpoint. e.g.
   *  `/api/crawls/{crawlId}/pages/pdf`. The component handles base-URL
   *  resolution + the bearer header. */
  path: string
  /** Suggested filename for the browser download dialog. */
  filename: string
  /** Tenant id for the upgrade-prompt toast link. When omitted the toast
   *  surfaces the prompt copy without a Billing link (callers should still
   *  pass it in normal use). */
  tenantId?: string
  /** Optional label override; defaults to "Export PDF". */
  label?: string
  /** When true, render a smaller variant suitable for inline placement. */
  compact?: boolean
  /** Disable the button (e.g. while a parent query is loading). */
  disabled?: boolean
}

export function PdfExportButton({
  path,
  filename,
  tenantId,
  label = "Export PDF",
  compact,
  disabled,
}: PdfExportButtonProps) {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await downloadPdf(pdfUrl(path), filename)
    } catch (e) {
      if (e instanceof DownloadError && e.status === 403) {
        toast.error(
          "PDF exports require Professional or Agency plan. Upgrade in Billing.",
          tenantId
            ? {
                action: {
                  label: "Upgrade",
                  onClick: () => {
                    // Navigate via location.href so we work outside any
                    // <Link>-aware ancestor (sonner renders into a portal).
                    window.location.href = `/t/${tenantId}/billing`
                  },
                },
              }
            : undefined,
        )
        return
      }
      toast.error(
        e instanceof Error
          ? `Could not export PDF: ${e.message}`
          : "Could not export PDF",
      )
    } finally {
      setBusy(false)
    }
  }

  // We render a tiny invisible <Link> only as a SEO / a11y target for crawl
  // tools; the visible affordance is the button. Kept here so screen-reader
  // users can deep-link to /billing if they prefer the hyperlink path.
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "xs" : "sm"}
        onClick={onClick}
        disabled={disabled || busy}
        data-testid="pdf-export-button"
      >
        <DownloadIcon />
        {busy ? "Exporting..." : label}
      </Button>
      {tenantId ? (
        <Link to={`/t/${tenantId}/billing`} className="sr-only" aria-hidden>
          Billing
        </Link>
      ) : null}
    </>
  )
}
