// Shared "Export CSV" button used by every report table (plan section 4.9).
// Wires the typed-client URL helper + the download.ts blob helper so each
// report just supplies its endpoint path + current filter params + a
// download filename.
//
// AGENTS.md note: this component does not construct a backend URL itself -
// the path comes from the calling route, which is the surface that already
// owns the typed-client method that hits that path. The CSV form is a
// content-negotiation flag; the BE returns the same data set with one
// extra `?format=csv` parameter.

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { csvUrl, downloadCsv } from "@/lib/download"

export type CsvExportButtonProps = {
  /** BE path the typed client already hits for the JSON form of this table.
   *  e.g. "/api/crawls/abc/pages/explore". */
  path: string
  /** Filter / pagination params already in the URL the user is viewing.
   *  Preserved so the CSV reflects the on-screen filters. */
  params?: Record<string, string | number | boolean | null | undefined>
  /** Suggested filename for the download. */
  filename: string
  /** Optional label override; defaults to "Export CSV". */
  label?: string
  /** When true, render a smaller variant suitable for inline placement. */
  compact?: boolean
  /** Disable the button (e.g. while a parent query is loading). */
  disabled?: boolean
}

export function CsvExportButton({
  path,
  params,
  filename,
  label = "Export CSV",
  compact,
  disabled,
}: CsvExportButtonProps) {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await downloadCsv(csvUrl(path, params), filename)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Could not export CSV: ${e.message}`
          : "Could not export CSV",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "xs" : "sm"}
      onClick={onClick}
      disabled={disabled || busy}
      data-testid="csv-export-button"
    >
      <DownloadIcon />
      {busy ? "Exporting..." : label}
    </Button>
  )
}
