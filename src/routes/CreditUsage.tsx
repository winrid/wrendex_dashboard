// Credit usage page: paginated ledger view + per-day rollup of debits and
// grants. Sourced from GET /api/tenants/{id}/billing/credit-ledger.

import { useMemo } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { useApiClient } from "@/api/useApiClient"
import type { CreditLedgerKind, CreditLedgerRow } from "@/api/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table/DataTable"

function kindLabel(kind: CreditLedgerKind): string {
  switch (kind) {
    case "DEBIT_HTTP":         return "Page (HTTP)"
    case "DEBIT_BROWSER":      return "Page (browser)"
    case "DEBIT_CHANGE_DETECT": return "Change detect"
    case "GRANT_CYCLE":        return "Cycle grant"
    case "GRANT_TOPUP":        return "Top-up"
    case "GRANT_MIGRATION":    return "Migration"
    case "GRANT_REFUND":       return "Refund"
    default:                   return kind
  }
}

function isDebit(kind: CreditLedgerKind): boolean {
  return kind.startsWith("DEBIT_")
}

function formatDateTime(value: string | null): string {
  if (!value) return ""
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

export function CreditUsage() {
  const { tenantId = "default" } = useParams()
  const client = useApiClient()

  const ledgerQ = useQuery({
    queryKey: ["credit-ledger", tenantId],
    queryFn: () => client.listCreditLedger(tenantId, { limit: 200 }),
    enabled: Boolean(tenantId),
  })

  const rows = useMemo<CreditLedgerRow[]>(
    () => ledgerQ.data?.items ?? [],
    [ledgerQ.data],
  )

  // Summary: total credits consumed (debits only) over the window.
  const totals = useMemo(() => {
    let debited = 0
    let granted = 0
    let httpCount = 0
    let browserCount = 0
    for (const r of rows) {
      if (isDebit(r.kind)) {
        debited += r.amount
        if (r.kind === "DEBIT_HTTP") httpCount++
        if (r.kind === "DEBIT_BROWSER") browserCount++
      } else {
        granted += r.amount
      }
    }
    return { debited, granted, httpCount, browserCount }
  }, [rows])

  const columns = useMemo<ColumnDef<CreditLedgerRow>[]>(
    () => [
      {
        id: "occurredAt",
        header: "When",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(row.original.occurredAt)}
          </span>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        cell: ({ row }) => (
          <span className="text-sm">{kindLabel(row.original.kind)}</span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const debit = isDebit(row.original.kind)
          return (
            <span
              className={
                "tabular-nums text-sm " +
                (debit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")
              }
            >
              {debit ? "-" : "+"}
              {row.original.amount}
            </span>
          )
        },
      },
      {
        id: "balanceAfter",
        header: "Balance",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.balanceAfter}
          </span>
        ),
      },
      {
        id: "url",
        header: "URL",
        cell: ({ row }) => (
          <span className="block max-w-md truncate text-xs text-muted-foreground">
            {row.original.url ?? "-"}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credit usage</h1>
        <p className="text-sm text-muted-foreground">
          Every credit movement -- debits from crawls and grants from cycle
          renewals and top-ups.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This window</CardTitle>
          <CardDescription>
            Showing up to the last 200 movements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Spent
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {totals.debited}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Granted
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {totals.granted}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                HTTP pages
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {totals.httpCount}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Browser pages
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {totals.browserCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            One row per credit movement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<CreditLedgerRow>
            columns={columns}
            data={rows}
            isLoading={ledgerQ.isLoading}
            emptyState={
              ledgerQ.isError ? (
                <span className="text-red-600 dark:text-red-400">
                  Could not load the ledger.
                </span>
              ) : (
                "No credit movements yet. Run a crawl to see usage appear here."
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
