// Billing page (plan section 11). Reads the read-only BillingSnapshot,
// surfaces three plan-tier cards (pricing copy lifted from the marketing
// site sec.08), wires the Subscribe + Open billing portal CTAs through
// createCheckoutSession + createPortalSession.
//
// Stripe never gets called from the FE directly; the BE creates the
// Checkout Session and we redirect to the URL it returns. The "Open
// billing portal" button stays disabled until the tenant has a Stripe
// customer (BillingSnapshot.hasPaymentMethod). Invoice history is a
// "Coming soon" stub - the BE doesn't expose an invoice list yet.

import { useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  BillingSnapshot,
  Invoice,
  ListInvoicesResult,
  Plan,
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
import { CheckIcon, ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Plan copy (lifted verbatim from /home/winrid/dev/wrendex/wrendex_marketing
// /index_v2.html sec.08). Keep prices + bullets in lockstep with that page.
// ---------------------------------------------------------------------------

type PlanCard = {
  tier: Plan
  name: string
  pitch: string
  price: string
  period: string
  note: string
  bullets: string[]
  featured?: boolean
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: "STARTER",
    name: "Starter",
    pitch: "For one site. Solo operators, in-house SEOs.",
    price: "$49",
    period: "/month",
    note: "$39/mo billed annually",
    bullets: [
      "1 site",
      "Up to 5,000 pages per audit",
      "Daily monitoring",
      "Email alerts",
      "30-day audit history",
      "All 170+ checks, no add-ons",
      "PDF and CSV export",
    ],
  },
  {
    tier: "PROFESSIONAL",
    name: "Professional",
    pitch: "For growing sites and marketing teams.",
    price: "$199",
    period: "/month",
    note: "$159/mo billed annually",
    featured: true,
    bullets: [
      "Up to 5 sites",
      "Up to 50,000 pages per audit",
      "Hourly monitoring and deploy triggers",
      "Slack, email, and Teams alerts",
      "1-year audit history and diffs",
      "5 team seats included",
      "Priority support",
    ],
  },
  {
    tier: "AGENCY",
    name: "Agency",
    pitch: "For teams auditing client sites at scale.",
    price: "$599",
    period: "/month",
    note: "Custom pricing above 25 sites",
    bullets: [
      "25 sites, unlimited pages",
      "Continuous monitoring",
      "White-label client reports",
      "PagerDuty and all alert channels",
      "Unlimited history and audit diffs",
      "Unlimited team seats",
      "Dedicated CSM and onboarding",
    ],
  },
]

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "TRIALING":
      return "Trial"
    case "ACTIVE":
      return "Active"
    case "PAST_DUE":
      return "Past due"
    case "CANCELLED":
      return "Cancelled"
    case "INCOMPLETE":
      return "Incomplete"
    case "NONE":
    default:
      return "No subscription"
  }
}

function statusVariant(status: SubscriptionStatus): "default" | "outline" {
  return status === "ACTIVE" || status === "TRIALING" ? "default" : "outline"
}

function planLabel(plan: Plan): string {
  switch (plan) {
    case "STARTER":
      return "Starter"
    case "PROFESSIONAL":
      return "Professional"
    case "AGENCY":
      return "Agency"
    default:
      return plan
  }
}

function trialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const now = Date.now()
  if (end <= now) return 0
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24))
}

function formatTrialEnd(trialEndsAt: string | null): string {
  if (!trialEndsAt) return ""
  try {
    const d = new Date(trialEndsAt)
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return trialEndsAt
  }
}

// Per-tenant localStorage key for the trial_active dedup. We migrate the
// previous in-memory ref guard to localStorage so a refresh / navigation
// out and back doesn't re-fire the event for the same tenant.
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
    // ignore quota / disabled storage; worst case the event re-fires
    // once per surface visit.
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
  })

  // Funnel telemetry: trial_active fires once per (tenant, browser) when
  // the snapshot shows TRIALING. The fire-state lives in localStorage so a
  // refresh / nav-away-and-back doesn't re-fire the event.
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

  const checkoutMut = useMutation({
    mutationFn: (priceTier: Plan) =>
      client.createCheckoutSession(tenantId, {
        priceTier,
        returnUrl: window.location.origin + window.location.pathname,
        trialDays: 14,
      }),
    onSuccess: (res) => {
      window.location.href = res.url
    },
    onError: () => {
      toast.error("Could not start checkout. Please try again.")
    },
  })

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
          Manage your plan, payment method, and invoice history.
        </p>
      </div>

      {/* Plan snapshot */}
      <PlanSnapshotCard
        snapshot={data ?? null}
        loading={billingQ.isLoading}
        trialDays={trialDays}
      />

      {/* Choose your plan */}
      <Card>
        <CardHeader>
          <CardTitle>Choose your plan</CardTitle>
          <CardDescription>
            Every plan includes the full 170+ checks. Cancel any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_CARDS.map((p) => (
              <PlanTierCard
                key={p.tier}
                plan={p}
                onSubscribe={() => checkoutMut.mutate(p.tier)}
                disabled={checkoutMut.isPending}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manage subscription via Stripe portal */}
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

      {/* Invoices */}
      <InvoicesCard tenantId={tenantId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invoices list (plan section 11). Bound to listInvoices(tenantId, {limit}).
// Renders the Stripe invoice rows in DataTable; empty state explains the
// "trial -> first invoice" lifecycle.
// ---------------------------------------------------------------------------

function formatAmount(amountCents: number, currency: string): string {
  // Stripe amounts are in the smallest currency unit (cents for USD, etc.).
  // Use Intl.NumberFormat for currency-aware grouping + symbol; fall back to
  // a raw cents/100 string when the currency code isn't supported.
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
          Past Stripe invoices for this workspace.
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

function PlanSnapshotCard({
  snapshot,
  loading,
  trialDays,
}: {
  snapshot: BillingSnapshot | null
  loading: boolean
  trialDays: number | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current plan</CardTitle>
        <CardDescription>
          A snapshot of your subscription state.
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
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Plan
              </div>
              <div className="text-base font-medium">
                {planLabel(snapshot.plan)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <Badge variant={statusVariant(snapshot.subscriptionStatus)}>
                {statusLabel(snapshot.subscriptionStatus)}
              </Badge>
            </div>
            {snapshot.subscriptionStatus === "TRIALING" && trialDays != null ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Trial
                </div>
                <div className="text-sm">
                  Trial ends in {trialDays}{" "}
                  {trialDays === 1 ? "day" : "days"}
                  {snapshot.trialEndsAt
                    ? `, on ${formatTrialEnd(snapshot.trialEndsAt)}`
                    : ""}
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Payment method
              </div>
              <div className="text-sm">
                {snapshot.hasPaymentMethod ? "On file" : "Not on file"}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PlanTierCard({
  plan,
  onSubscribe,
  disabled,
}: {
  plan: PlanCard
  onSubscribe: () => void
  disabled: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-md border bg-card p-4",
        plan.featured ? "border-primary ring-1 ring-primary/20" : "",
      )}
      data-testid={`plan-card-${plan.tier}`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.featured ? (
          <Badge variant="default">Most popular</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{plan.pitch}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">
          {plan.price}
        </span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{plan.note}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex-1" />
      <Button
        type="button"
        className="mt-4 w-full"
        variant={plan.featured ? "default" : "outline"}
        onClick={onSubscribe}
        disabled={disabled}
        data-testid={`subscribe-${plan.tier}`}
      >
        Subscribe
      </Button>
    </div>
  )
}
