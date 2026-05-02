// Per-site settings page (plan section 14.3 + 8.1). Three Card sections:
//
//   1. Schedule  - cadence editor (PAUSED / DAILY / HOURLY / CONTINUOUS).
//                  Disabled when the site is unverified; an inline link
//                  opens the existing VerificationDialog.
//   2. Alert rules - the 3 canned rules from listAlertRules. Each row has
//                    an enabled Switch; SCORE_DROP also has a threshold input.
//                    Save-on-change.
//   3. Danger zone - delete this site, with a type-the-URL confirmation.

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import type {
  AlertRule,
  AlertRuleKind,
  SiteCadence,
  SiteSchedule,
} from "@/api/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Toaster } from "@/components/ui/sonner"
import { VerificationDialog } from "@/components/site-verification/VerificationDialog"
import { relativeTime, siteDisplayName } from "@/lib/format"

// Per-rule copy. Keyed by AlertRuleKind so the FE can render a stable
// description for each canned rule even if the BE returns one we don't yet
// know about (shows the kind verbatim as a fallback).
const RULE_DESCRIPTIONS: Record<AlertRuleKind, { name: string; description: string }> = {
  NEW_ERROR: {
    name: "New error",
    description:
      "Email me whenever a new ERROR-severity alert appears in this site.",
  },
  SCORE_DROP: {
    name: "Score drop",
    description:
      "Email me when the health score drops by more than the threshold across two consecutive crawls.",
  },
  WEEKLY_DIGEST: {
    name: "Weekly digest",
    description:
      "Send a Monday morning summary of new + resolved issues across this site.",
  },
}

const CADENCE_OPTIONS: { value: SiteCadence; label: string; description: string }[] = [
  { value: "PAUSED", label: "Paused", description: "No scheduled crawls." },
  { value: "DAILY", label: "Daily", description: "One crawl per day." },
  { value: "HOURLY", label: "Hourly", description: "Up to 24 crawls per day." },
  {
    value: "CONTINUOUS",
    label: "Continuous",
    description: "Re-crawl as soon as the previous run finishes.",
  },
]

// ---------------------------------------------------------------------------
// Schedule section
// ---------------------------------------------------------------------------

function ScheduleCard({
  siteId,
  verified,
  onUnverifiedClick,
}: {
  siteId: string
  verified: boolean
  onUnverifiedClick: () => void
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const scheduleQ = useQuery({
    queryKey: ["site-schedule", siteId],
    queryFn: () => client.getSchedule(siteId),
    enabled: Boolean(siteId),
  })
  const [cadence, setCadence] = useState<SiteCadence>("PAUSED")

  useEffect(() => {
    if (scheduleQ.data) setCadence(scheduleQ.data.cadence ?? "PAUSED")
  }, [scheduleQ.data])

  const saveMut = useMutation({
    mutationFn: (next: SiteCadence) =>
      client.updateSchedule(siteId, { cadence: next }),
    onSuccess: (next) => {
      toast.success("Schedule updated")
      queryClient.setQueryData<SiteSchedule>(
        ["site-schedule", siteId],
        next,
      )
    },
    onError: () => {
      toast.error("Could not update schedule.")
    },
  })

  const data = scheduleQ.data
  const disabled = !verified

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <CardDescription>
          How often should we re-crawl this site?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!verified ? (
          <p className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Scheduling is disabled until you verify ownership.{" "}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={onUnverifiedClick}
            >
              Verify ownership first
            </button>
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="cadence-select">Cadence</Label>
          <Select
            value={cadence}
            onValueChange={(v) => setCadence(v as SiteCadence)}
            disabled={disabled}
          >
            <SelectTrigger id="cadence-select" className="w-64">
              <SelectValue placeholder="Pick a cadence" />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex flex-col">
                    <span className="font-medium">{o.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.nextRunAt ? (
          <p className="text-xs text-muted-foreground">
            Next run: {relativeTime(data.nextRunAt)}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            disabled={disabled || saveMut.isPending}
            onClick={() => saveMut.mutate(cadence)}
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Alert rules section
// ---------------------------------------------------------------------------

function AlertRulesCard({ siteId }: { siteId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const rulesQ = useQuery({
    queryKey: ["alert-rules", siteId],
    queryFn: () => client.listAlertRules(siteId),
    enabled: Boolean(siteId),
  })

  const updateMut = useMutation({
    mutationFn: ({
      ruleId,
      input,
    }: {
      ruleId: string
      input: { enabled?: boolean; params?: Record<string, unknown> }
    }) => client.updateAlertRule(siteId, ruleId, input),
    onSuccess: (next) => {
      queryClient.setQueryData<AlertRule[]>(
        ["alert-rules", siteId],
        (old) => {
          if (!old) return [next]
          return old.map((r) => (r.id === next.id ? next : r))
        },
      )
    },
    onError: () => {
      toast.error("Could not update alert rule.")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert rules</CardTitle>
        <CardDescription>
          Pick which events trigger an email for this site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rulesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rules...</p>
        ) : rulesQ.isError || !rulesQ.data ? (
          <p className="text-sm text-destructive">
            Could not load alert rules.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rulesQ.data.map((rule) => (
              <AlertRuleRow
                key={rule.id}
                rule={rule}
                onToggle={(enabled) =>
                  updateMut.mutate({
                    ruleId: rule.id,
                    input: { enabled },
                  })
                }
                onParamsChange={(params) =>
                  updateMut.mutate({
                    ruleId: rule.id,
                    input: { params },
                  })
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AlertRuleRow({
  rule,
  onToggle,
  onParamsChange,
}: {
  rule: AlertRule
  onToggle: (enabled: boolean) => void
  onParamsChange: (params: Record<string, unknown>) => void
}) {
  const meta = RULE_DESCRIPTIONS[rule.kind as AlertRuleKind] ?? {
    name: rule.kind,
    description: "Custom rule.",
  }

  // SCORE_DROP keeps a numeric threshold in params; default to 10 if the
  // BE returned no value (the BE auto-seeds to 10, but we guard against
  // either form for resilience).
  const threshold =
    rule.kind === "SCORE_DROP"
      ? Number(
          (rule.params?.threshold as number | string | undefined) ?? 10,
        )
      : null
  const [draftThreshold, setDraftThreshold] = useState<number>(
    threshold ?? 10,
  )
  useEffect(() => {
    if (threshold != null) setDraftThreshold(threshold)
  }, [threshold])

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
      data-testid={`alert-rule-${rule.kind}`}
    >
      <div>
        <div className="font-medium">{meta.name}</div>
        <p className="max-w-md text-xs text-muted-foreground">
          {meta.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {rule.kind === "SCORE_DROP" ? (
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor={`threshold-${rule.id}`}
              className="text-xs text-muted-foreground"
            >
              Threshold
            </Label>
            <Input
              id={`threshold-${rule.id}`}
              type="number"
              min={1}
              max={100}
              value={draftThreshold}
              onChange={(e) => setDraftThreshold(Number(e.target.value))}
              onBlur={() => {
                if (draftThreshold !== threshold) {
                  onParamsChange({
                    ...(rule.params ?? {}),
                    threshold: draftThreshold,
                  })
                }
              }}
              className="w-20"
            />
          </div>
        ) : null}
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          aria-label={`Enable ${meta.name}`}
          data-testid={`alert-rule-switch-${rule.kind}`}
        />
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Danger zone section
// ---------------------------------------------------------------------------

function DangerZoneCard({
  tenantId,
  siteId,
  siteUrl,
}: {
  tenantId: string
  siteId: string
  siteUrl: string
}) {
  const client = useApiClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")

  const deleteMut = useMutation({
    mutationFn: () => client.deleteSite(tenantId, siteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sites", tenantId] })
      toast.success("Site deleted")
      navigate(`/t/${tenantId}/sites`)
    },
    onError: () => {
      toast.error("Could not delete site.")
    },
  })

  const matches = confirm.trim() === siteUrl

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          Irreversible. Deleting the site removes every crawl, alert, and
          configured rule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
        >
          Delete this site
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setConfirm("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this site?</DialogTitle>
            <DialogDescription>
              This permanently removes every crawl, alert, and configured rule
              for this site. Type the site URL to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-input">Site URL</Label>
            <Input
              id="confirm-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={siteUrl}
              data-testid="delete-confirm-input"
            />
            <p className="text-xs text-muted-foreground">
              Expected: <span className="font-mono">{siteUrl}</span>
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={!matches || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
              data-testid="delete-confirm-button"
            >
              {deleteMut.isPending ? "Deleting..." : "Delete site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function SiteSettings() {
  const { tenantId = "default", siteId = "" } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [verifyOpen, setVerifyOpen] = useState(false)

  const siteQ = useQuery({
    queryKey: ["site", tenantId, siteId],
    queryFn: () => client.getSite(tenantId, siteId),
    enabled: Boolean(tenantId && siteId),
  })

  const site = siteQ.data
  const verified = useMemo(() => Boolean(site?.verifiedAt), [site])

  if (siteQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }
  if (siteQ.isError || !site) {
    return (
      <div className="text-sm text-destructive">Could not load site.</div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {siteDisplayName(site.url)} - Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule, alert rules, and danger zone for this site.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/sites/${siteId}`}>Back to site</Link>
        </Button>
      </div>

      <ScheduleCard
        siteId={siteId}
        verified={verified}
        onUnverifiedClick={() => setVerifyOpen(true)}
      />

      <AlertRulesCard siteId={siteId} />

      <DangerZoneCard
        tenantId={tenantId}
        siteId={siteId}
        siteUrl={site.url}
      />

      <VerificationDialog
        siteId={siteId}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onVerified={() => {
          void queryClient.invalidateQueries({
            queryKey: ["site", tenantId, siteId],
          })
        }}
      />
    </div>
  )
}
