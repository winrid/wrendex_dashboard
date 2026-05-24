// Billing page under the credit-based billing model. Renders the
// credit-balance snapshot, the auto-top-up settings card, a manual-top-up
// dialog, the Stripe billing portal link, and the invoice history table.
//
// Stripe is never called from the FE directly; the BE creates the checkout /
// portal / payment-intent and we redirect or relay the result. Credit balance
// updates flow back via the Stripe webhook (payment_intent.succeeded /
// invoice.paid), so the UI just polls the billing snapshot on focus.

import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  AutoTopUpSettings,
  BillingSnapshot,
  CreditPackSku,
  Invoice,
  ListInvoicesResult,
  SubscriptionStatus,
} from "@/api/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge-fallback"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table/DataTable"
import { Toaster } from "@/components/ui/sonner"
import { ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Pack catalog. The credit counts and prices mirror BillingConfig on the BE.
// Keep these in lockstep with marketing-site pricing-calculator.js.
// ---------------------------------------------------------------------------

type Pack = {
  sku: CreditPackSku
  credits: number
  price: string
  perCreditCents: number
  label: string
}

const PACKS: Pack[] = [
  { sku: "PACK_5K",   credits: 5_000,   price: "$4.99",  perCreditCents: 0.0998, label: "5,000 credits" },
  { sku: "PACK_25K",  credits: 25_000,  price: "$19.99", perCreditCents: 0.0800, label: "25,000 credits" },
  { sku: "PACK_100K", credits: 100_000, price: "$69.99", perCreditCents: 0.0700, label: "100,000 credits" },
]

function packBySku(sku: CreditPackSku | null | undefined): Pack | null {
  if (!sku) return null
  return PACKS.find((p) => p.sku === sku) ?? null
}

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "TRIALING":   return "Trial"
    case "ACTIVE":     return "Active"
    case "PAST_DUE":   return "Past due"
    case "CANCELLED":  return "Cancelled"
    case "INCOMPLETE": return "Incomplete"
    case "NONE":
    default:           return "No subscription"
  }
}

function statusVariant(status: SubscriptionStatus): "default" | "outline" {
  return status === "ACTIVE" || status === "TRIALING" ? "default" : "outline"
}

function trialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const now = Date.now()
  if (end <= now) return 0
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24))
}

function formatDate(value: string | null): string {
  if (!value) return ""
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return value
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined).format(n)
}

const TRIAL_ACTIVE_FIRED_KEY_PREFIX = "wrendex.trialActiveFired."

function trialActiveFiredKey(tenantId: string): string {
  return TRIAL_ACTIVE_FIRED_KEY_PREFIX + tenantId
}

function hasFiredTrialActive(tenantId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(trialActiveFiredKey(tenantId)) === "1"
  } catch {
    return false
  }
}

function markTrialActiveFired(tenantId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(trialActiveFiredKey(tenantId), "1")
  } catch {
    // ignore quota / disabled storage
  }
}

export function Billing() {
  const { tenantId = "default" } = useParams()
  const client = useApiClient()
  const auth = useAuth()

  const billingQ = useQuery({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
  })

  // Funnel telemetry: trial_active fires once per (tenant, browser) when
  // the snapshot shows TRIALING.
  useEffect(() => {
    const data = billingQ.data
    if (!data || data.subscriptionStatus !== "TRIALING") return
    if (hasFiredTrialActive(tenantId)) return
    markTrialActiveFired(tenantId)
    void client.sendTelemetry([
      {
        event: "trial_active",
        properties: {
          tenantId,
          plan: data.plan,
          userId: auth.user?.id,
        },
      },
    ])
  }, [billingQ.data, client, tenantId, auth.user?.id])

  const portalMut = useMutation({
    mutationFn: () =>
      client.createPortalSession(tenantId, {
        returnUrl: window.location.origin + window.location.pathname,
      }),
    onSuccess: (res) => {
      window.location.href = res.url
    },
    onError: () => {
      toast.error("Could not open the billing portal. Please try again.")
    },
  })

  const data = billingQ.data
  const trialDays = data ? trialDaysRemaining(data.trialEndsAt) : null

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Wrendex grows with you. Pay $4.99/month for 5,000 crawl credits and
          top up at any time as you scale.
        </p>
      </div>

      <CreditBalanceCard
        snapshot={data ?? null}
        loading={billingQ.isLoading}
        trialDays={trialDays}
      />

      <AutoTopUpCard
        tenantId={tenantId}
        snapshot={data ?? null}
        loading={billingQ.isLoading}
      />

      <ManualTopUpCard
        tenantId={tenantId}
        snapshot={data ?? null}
        loading={billingQ.isLoading}
      />

      <Card>
        <CardHeader>
          <CardTitle>Manage subscription</CardTitle>
          <CardDescription>
            Update payment method, download invoices, and cancel from the
            Stripe billing portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={!data?.hasPaymentMethod || portalMut.isPending}
            onClick={() => portalMut.mutate()}
          >
            {portalMut.isPending ? "Opening..." : "Open billing portal"}
          </Button>
          {!data?.hasPaymentMethod ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Available once you start a paid plan.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <InvoicesCard tenantId={tenantId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Credit balance card -- the headline number, cycle window, and trial banner.
// ---------------------------------------------------------------------------

function CreditBalanceCard({
  snapshot,
  loading,
  trialDays,
}: {
  snapshot: BillingSnapshot | null
  loading: boolean
  trialDays: number | null
}) {
  const balance = snapshot?.creditBalance ?? 0
  const granted = snapshot?.creditsGrantedThisCycle ?? 0
  const pct = granted > 0 ? Math.max(0, Math.min(100, (balance / granted) * 100)) : 0

  return (
    <Card data-testid="credit-balance-card">
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>
          1 credit = 1 page crawl. Real-browser rendering uses 2 credits per page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !snapshot ? (
          <p className="text-sm text-muted-foreground">
            Could not load billing snapshot.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <div className="text-3xl font-semibold tabular-nums">
                {formatNumber(balance)}
              </div>
              <div className="text-sm text-muted-foreground">
                of {formatNumber(granted)} credits this cycle
              </div>
              <Badge variant={statusVariant(snapshot.subscriptionStatus)}>
                {statusLabel(snapshot.subscriptionStatus)}
              </Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
                data-testid="credit-balance-bar"
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {snapshot.cycleStartedAt ? (
                <span>Cycle started {formatDate(snapshot.cycleStartedAt)}</span>
              ) : null}
              {snapshot.cycleEndsAt ? (
                <span>Renews {formatDate(snapshot.cycleEndsAt)}</span>
              ) : null}
              {snapshot.subscriptionStatus === "TRIALING" && trialDays != null ? (
                <span>
                  Trial ends in {trialDays} {trialDays === 1 ? "day" : "days"}
                </span>
              ) : null}
              <span>
                Payment method: {snapshot.hasPaymentMethod ? "on file" : "not on file"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Auto top-up card -- toggle + pack picker + threshold input.
// ---------------------------------------------------------------------------

function AutoTopUpCard({
  tenantId,
  snapshot,
  loading,
}: {
  tenantId: string
  snapshot: BillingSnapshot | null
  loading: boolean
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const current: AutoTopUpSettings = snapshot?.autoTopUp ?? {
    enabled: false,
    packSku: "PACK_5K",
    thresholdCredits: 1000,
  }

  const [enabled, setEnabled] = useState(current.enabled)
  const [packSku, setPackSku] = useState<CreditPackSku>(
    (current.packSku as CreditPackSku) || "PACK_5K",
  )
  const [threshold, setThreshold] = useState(current.thresholdCredits || 1000)

  useEffect(() => {
    setEnabled(current.enabled)
    setPackSku((current.packSku as CreditPackSku) || "PACK_5K")
    setThreshold(current.thresholdCredits || 1000)
  }, [snapshot])

  const saveMut = useMutation({
    mutationFn: () =>
      client.patchAutoTopUp(tenantId, {
        enabled,
        packSku,
        thresholdCredits: threshold,
      }),
    onSuccess: () => {
      toast.success("Auto top-up updated.")
      void queryClient.invalidateQueries({ queryKey: ["billing", tenantId] })
    },
    onError: () => {
      toast.error("Could not update auto top-up. Please try again.")
    },
  })

  const disabled = loading || !snapshot?.hasPaymentMethod || saveMut.isPending

  return (
    <Card data-testid="auto-top-up-card">
      <CardHeader>
        <CardTitle>Auto top-up</CardTitle>
        <CardDescription>
          When credits drop below your threshold, we'll buy another pack on
          your default payment method so crawls never pause.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={disabled}
              className="size-4 rounded border"
              data-testid="auto-top-up-enabled"
            />
            <span>Enable auto top-up</span>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Pack
              </span>
              <select
                value={packSku}
                onChange={(e) => setPackSku(e.target.value as CreditPackSku)}
                disabled={disabled || !enabled}
                className="mt-1 block w-full rounded border bg-background px-3 py-2 text-sm"
                data-testid="auto-top-up-pack"
              >
                {PACKS.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.label} {p.price}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Threshold (credits)
              </span>
              <input
                type="number"
                min={0}
                max={100000}
                step={100}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                disabled={disabled || !enabled}
                className="mt-1 block w-full rounded border bg-background px-3 py-2 text-sm tabular-nums"
                data-testid="auto-top-up-threshold"
              />
            </label>
          </div>
          {!snapshot?.hasPaymentMethod ? (
            <p className="text-xs text-muted-foreground">
              Add a payment method first to enable auto top-up.
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={disabled}
              data-testid="auto-top-up-save"
            >
              {saveMut.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Manual top-up -- one-off pack purchase. Reuses the same Stripe off-session
// charge path as auto top-up; credits are granted by the webhook.
// ---------------------------------------------------------------------------

function ManualTopUpCard({
  tenantId,
  snapshot,
  loading,
}: {
  tenantId: string
  snapshot: BillingSnapshot | null
  loading: boolean
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [packSku, setPackSku] = useState<CreditPackSku>("PACK_5K")
  const disabled = loading || !snapshot?.hasPaymentMethod

  const buyMut = useMutation({
    mutationFn: () => client.manualTopUp(tenantId, { packSku }),
    onSuccess: () => {
      toast.success("Top-up charged. Credits will appear shortly.")
      // Credits land via the webhook; poll the snapshot to reflect.
      void queryClient.invalidateQueries({ queryKey: ["billing", tenantId] })
    },
    onError: () => {
      toast.error("Top-up failed. Check your payment method and try again.")
    },
  })

  return (
    <Card data-testid="manual-top-up-card">
      <CardHeader>
        <CardTitle>Buy credits</CardTitle>
        <CardDescription>
          One-time pack. Charges your default payment method; credits are
          added once Stripe confirms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Pack
            </span>
            <select
              value={packSku}
              onChange={(e) => setPackSku(e.target.value as CreditPackSku)}
              disabled={disabled}
              className="mt-1 block min-w-56 rounded border bg-background px-3 py-2 text-sm"
              data-testid="manual-top-up-pack"
            >
              {PACKS.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.label} {p.price}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => buyMut.mutate()}
            disabled={disabled || buyMut.isPending}
            data-testid="manual-top-up-buy"
          >
            {buyMut.isPending ? "Charging..." : `Buy ${packBySku(packSku)?.label}`}
          </Button>
        </div>
        {!snapshot?.hasPaymentMethod ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Add a payment method first to buy credits.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Invoices list -- unchanged from pre-credit-model. The credit-pack one-time
// invoices show up here alongside the recurring base subscription invoices.
// ---------------------------------------------------------------------------

function formatAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amountCents / 100)
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "open":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "uncollectible":
    case "void":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    case "draft":
    default:
      return "bg-muted text-muted-foreground"
  }
}

function formatDateShort(value?: string | null): string {
  if (!value) return "-"
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return value
  }
}

function InvoicesCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const invoicesQ = useQuery<ListInvoicesResult>({
    queryKey: ["invoices", tenantId],
    queryFn: () => client.listInvoices(tenantId, { limit: 20 }),
    enabled: Boolean(tenantId),
  })

  const items = useMemo<Invoice[]>(
    () => invoicesQ.data?.items ?? [],
    [invoicesQ.data],
  )

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        id: "number",
        header: "Invoice",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.number ?? row.original.id}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatAmount(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
              statusBadgeClass(row.original.status),
            )}
            data-testid={`invoice-status-${row.original.id}`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "period",
        header: "Period",
        cell: ({ row }) => {
          const start = formatDateShort(row.original.periodStart)
          const end = formatDateShort(row.original.periodEnd)
          if (start === "-" && end === "-") {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <span className="text-xs text-muted-foreground tabular-nums">
              {start} - {end}
            </span>
          )
        },
      },
      {
        id: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateShort(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {row.original.hostedInvoiceUrl ? (
              <a
                href={row.original.hostedInvoiceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                data-testid={`invoice-view-${row.original.id}`}
              >
                View
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : null}
            {row.original.invoicePdfUrl ? (
              <a
                href={row.original.invoicePdfUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                data-testid={`invoice-pdf-${row.original.id}`}
              >
                PDF
              </a>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <Card data-testid="invoices-card">
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Past Stripe invoices for this workspace, including credit-pack
          top-ups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable<Invoice>
          columns={columns}
          data={items}
          isLoading={invoicesQ.isLoading}
          emptyState={
            invoicesQ.isError ? (
              <span className="text-red-600 dark:text-red-400">
                Could not load invoices.
              </span>
            ) : (
              "No invoices yet. Your first invoice will appear after your trial converts."
            )
          }
        />
      </CardContent>
    </Card>
  )
}
