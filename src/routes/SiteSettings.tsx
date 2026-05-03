// Per-site settings page (plan section 14.3 + 8.1). Three Card sections:
//
//   1. Schedule  - cadence editor (PAUSED / DAILY / HOURLY / CONTINUOUS).
//                  Disabled when the site is unverified; an inline link
//                  opens the existing VerificationDialog.
//   2. Alert rules - the 3 canned rules from listAlertRules + any CUSTOM
//                    rules composed via the composer dialog. Each row has
//                    an enabled Switch; SCORE_DROP also has a threshold
//                    input; CUSTOM rules surface a Delete button.
//   3. Danger zone - delete this site, with a type-the-URL confirmation.

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { getAllCategories, getAllChecks } from "@/api/checkCatalog"
import type {
  AlertRule,
  AlertRuleKind,
  AlertRuleTrigger,
  AlertRuleTriggerOp,
  CustomAlertRuleParams,
  NotificationChannel,
  Plan,
  Severity,
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
import { Checkbox } from "@/components/ui/checkbox"
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
const RULE_DESCRIPTIONS: Record<
  Exclude<AlertRuleKind, "CUSTOM">,
  { name: string; description: string }
> = {
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

// Plan -> max cadence (mirrors PlanGate.assertCanUseCadence on the BE; the
// BE is authoritative and rejects with 403 + PlanLimitException, but we
// surface this client-side as a "Pro plan only" badge + disabled options).
const CADENCE_RANK: Record<SiteCadence, number> = {
  PAUSED: 0,
  DAILY: 1,
  HOURLY: 2,
  CONTINUOUS: 3,
}

function maxCadenceForPlan(plan: Plan | null | undefined): number {
  switch (plan) {
    case "STARTER":
      return CADENCE_RANK.DAILY
    case "PROFESSIONAL":
      return CADENCE_RANK.HOURLY
    case "AGENCY":
      return CADENCE_RANK.CONTINUOUS
    default:
      // Unknown / not loaded yet: assume the most permissive cap so we don't
      // disable options unnecessarily. The BE still rejects the PUT.
      return CADENCE_RANK.CONTINUOUS
  }
}

// ---------------------------------------------------------------------------
// Schedule section
// ---------------------------------------------------------------------------

function ScheduleCard({
  tenantId,
  siteId,
  verified,
  onUnverifiedClick,
}: {
  tenantId: string
  siteId: string
  verified: boolean
  onUnverifiedClick: () => void
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const scheduleQ = useQuery({
    queryKey: ["site-schedule", siteId],
    queryFn: () => client.getSchedule(siteId),
    enabled: Boolean(siteId),
  })
  // Read the tenant's billing snapshot to drive the plan-gate UI. The BE is
  // authoritative on PUT (returns 403); this is purely a hint so STARTER
  // users see the upgrade affordance before clicking Save.
  const billingQ = useQuery({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
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
    onError: (err) => {
      // Plan-gate: PUT /api/sites/{siteId}/schedule rejects with 403 if the
      // tenant's plan can't reach the requested cadence (BE Phase 1 fix).
      // Surface this as a focused toast with a link to Billing rather than
      // the generic "could not update" message.
      if (err instanceof ApiError && err.status === 403) {
        toast.error("Your plan doesn't allow this cadence.", {
          action: {
            label: "Upgrade",
            onClick: () => navigate(`/t/${tenantId}/billing`),
          },
          description: "Upgrade in Billing to unlock more frequent crawls.",
        })
        return
      }
      toast.error("Could not update schedule.")
    },
  })

  const data = scheduleQ.data
  const disabled = !verified
  const planMax = maxCadenceForPlan(billingQ.data?.plan)

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
              {CADENCE_OPTIONS.map((o) => {
                const overPlan = CADENCE_RANK[o.value] > planMax
                return (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    disabled={overPlan}
                  >
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium">{o.label}</span>
                        {overPlan ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            Pro plan only
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.description}
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
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
  const [composerOpen, setComposerOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AlertRule | null>(null)

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

  const deleteMut = useMutation({
    mutationFn: (ruleId: string) => client.deleteAlertRule(siteId, ruleId),
    onSuccess: (_void, ruleId) => {
      queryClient.setQueryData<AlertRule[]>(
        ["alert-rules", siteId],
        (old) => (old ?? []).filter((r) => r.id !== ruleId),
      )
      toast.success("Custom rule deleted")
      setPendingDelete(null)
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
        toast.error("Canned rules can't be deleted.")
      } else {
        toast.error("Could not delete rule.")
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert rules</CardTitle>
        <CardDescription>
          Pick which events trigger a notification for this site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                onDelete={() => setPendingDelete(rule)}
              />
            ))}
          </ul>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComposerOpen(true)}
            data-testid="open-custom-rule-composer"
          >
            <Plus className="mr-1.5 size-4" />
            Custom rule
          </Button>
        </div>
      </CardContent>

      <CustomAlertRuleDialog
        siteId={siteId}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={(rule) => {
          queryClient.setQueryData<AlertRule[]>(
            ["alert-rules", siteId],
            (old) => (old ? [...old, rule] : [rule]),
          )
          setComposerOpen(false)
        }}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this custom rule?</DialogTitle>
            <DialogDescription>
              The rule will stop firing immediately. You can recreate it from
              the composer at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (pendingDelete) deleteMut.mutate(pendingDelete.id)
              }}
              data-testid="confirm-delete-custom-rule"
            >
              {deleteMut.isPending ? "Deleting..." : "Delete rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function customRuleTriggerSummary(params: CustomAlertRuleParams): string {
  const t = params.trigger
  switch (t.kind) {
    case "ALERT_FIRED":
      return t.firstSeen
        ? "When a new alert type fires for the first time"
        : "When an alert fires"
    case "SCORE_THRESHOLD":
      return `When health score ${t.op} ${t.value}`
    case "ALERT_COUNT_THRESHOLD":
      return `When alert count ${t.op} ${t.value}${
        t.severity ? ` (${t.severity})` : ""
      }`
    case "DIGEST_PERIOD":
      return `${t.cron.charAt(0) + t.cron.slice(1).toLowerCase()} digest`
    default:
      return "Custom rule"
  }
}

function AlertRuleRow({
  rule,
  onToggle,
  onParamsChange,
  onDelete,
}: {
  rule: AlertRule
  onToggle: (enabled: boolean) => void
  onParamsChange: (params: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const isCustom = rule.kind === "CUSTOM"
  let name: string
  let description: string
  if (isCustom) {
    const params = (rule.params ?? {}) as Partial<CustomAlertRuleParams>
    name =
      typeof params.name === "string" && params.name.length > 0
        ? params.name
        : "Custom rule"
    description = params.trigger
      ? customRuleTriggerSummary(params as CustomAlertRuleParams)
      : "Custom rule"
  } else {
    const meta =
      RULE_DESCRIPTIONS[rule.kind as Exclude<AlertRuleKind, "CUSTOM">] ?? {
        name: rule.kind,
        description: "Custom rule.",
      }
    name = meta.name
    description = meta.description
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
      data-testid={`alert-rule-${rule.kind}-${rule.id}`}
    >
      <div>
        <div className="font-medium">{name}</div>
        <p className="max-w-md text-xs text-muted-foreground">
          {description}
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
          aria-label={`Enable ${name}`}
          data-testid={`alert-rule-switch-${rule.kind}`}
        />
        {isCustom ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
            data-testid={`alert-rule-delete-${rule.id}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Custom alert rule composer dialog (P4 iter 3 BE-C). Multi-step wizard:
//
//   Step 1 - Trigger: kind select + per-kind extra fields.
//   Step 2 - Filters: optional categories / types / severities / pageUrl /
//            minPages.
//   Step 3 - Channels: optional multi-select (default = all).
//   Step 4 - Name + JSON review preview.
//
// On submit calls createCustomAlertRule(siteId, {kind: "CUSTOM",
// enabled: true, params}).
// ---------------------------------------------------------------------------

// DIGEST_PERIOD is intentionally omitted from the user-selectable trigger
// kinds: cron-style digest scheduling lands in Phase 5+ once the BE has a
// proper cron evaluator. Until then, the canned WEEKLY_DIGEST rule covers
// the only digest cadence the BE actually fires. See AGENTS.md "Phase 4
// deferrals". The `AlertRuleTrigger` union still carries DIGEST_PERIOD so
// any rules already persisted with that kind continue to render.
const TRIGGER_KIND_OPTIONS: {
  value: Exclude<AlertRuleTrigger["kind"], "DIGEST_PERIOD">
  label: string
  description: string
}[] = [
  {
    value: "ALERT_FIRED",
    label: "When an alert fires",
    description:
      "Fire whenever any matching alert is created during a crawl.",
  },
  {
    value: "SCORE_THRESHOLD",
    label: "When the health score crosses a threshold",
    description:
      "Compare the latest crawl's health score to a configured value.",
  },
  {
    value: "ALERT_COUNT_THRESHOLD",
    label: "When the alert count crosses a threshold",
    description:
      "Fire when the total matching-alert count crosses a configured value.",
  },
]

const TRIGGER_OP_OPTIONS: AlertRuleTriggerOp[] = ["<", "<=", ">", ">="]

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SLACK", label: "Slack" },
  { value: "TEAMS", label: "Microsoft Teams" },
  { value: "PAGERDUTY", label: "PagerDuty" },
]

const SEVERITY_OPTIONS: Severity[] = ["ERROR", "WARNING", "NOTICE"]

const STEP_TITLES = ["Trigger", "Filters", "Channels", "Review"] as const

function defaultTriggerForKind(kind: AlertRuleTrigger["kind"]): AlertRuleTrigger {
  switch (kind) {
    case "ALERT_FIRED":
      return { kind: "ALERT_FIRED", firstSeen: false }
    case "SCORE_THRESHOLD":
      return { kind: "SCORE_THRESHOLD", op: "<", value: 80 }
    case "ALERT_COUNT_THRESHOLD":
      return { kind: "ALERT_COUNT_THRESHOLD", op: ">", value: 10 }
    case "DIGEST_PERIOD":
      return { kind: "DIGEST_PERIOD", cron: "WEEKLY" }
  }
}

function CustomAlertRuleDialog({
  siteId,
  open,
  onOpenChange,
  onCreated,
}: {
  siteId: string
  open: boolean
  onOpenChange: (next: boolean) => void
  onCreated: (rule: AlertRule) => void
}) {
  const client = useApiClient()
  const [step, setStep] = useState(0)
  const [trigger, setTrigger] = useState<AlertRuleTrigger>(() =>
    defaultTriggerForKind("ALERT_FIRED"),
  )
  const [categories, setCategories] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [severities, setSeverities] = useState<Severity[]>([])
  const [pageUrlContains, setPageUrlContains] = useState("")
  const [minPagesAffected, setMinPagesAffected] = useState<string>("")
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [name, setName] = useState("")

  // Reset all state when the dialog closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setStep(0)
      setTrigger(defaultTriggerForKind("ALERT_FIRED"))
      setCategories([])
      setTypes([])
      setSeverities([])
      setPageUrlContains("")
      setMinPagesAffected("")
      setChannels([])
      setName("")
    }
  }, [open])

  const allCategories = useMemo(() => getAllCategories(), [])
  const allChecks = useMemo(() => getAllChecks(), [])

  const params = useMemo<CustomAlertRuleParams>(() => {
    const filters: CustomAlertRuleParams["filters"] = {}
    if (categories.length > 0) filters.categories = categories
    if (types.length > 0) filters.types = types
    if (severities.length > 0) filters.severities = severities
    if (pageUrlContains.trim().length > 0)
      filters.pageUrlContains = pageUrlContains.trim()
    const min = Number(minPagesAffected)
    if (Number.isFinite(min) && min > 0) filters.minPagesAffected = min
    const out: CustomAlertRuleParams = { trigger }
    if (Object.keys(filters).length > 0) out.filters = filters
    if (name.trim().length > 0) out.name = name.trim()
    if (channels.length > 0) out.channels = channels
    return out
  }, [
    trigger,
    categories,
    types,
    severities,
    pageUrlContains,
    minPagesAffected,
    name,
    channels,
  ])

  const createMut = useMutation({
    mutationFn: () =>
      client.createCustomAlertRule(siteId, { enabled: true, params }),
    onSuccess: (rule) => {
      toast.success("Custom rule created")
      onCreated(rule)
    },
    onError: () => {
      toast.error("Could not create custom rule.")
    },
  })

  const lastStep = STEP_TITLES.length - 1

  function next(): void {
    setStep((s) => Math.min(s + 1, lastStep))
  }
  function back(): void {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New custom alert rule</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 py-1">
          {step === 0 ? (
            <TriggerStep trigger={trigger} onChange={setTrigger} />
          ) : null}
          {step === 1 ? (
            <FiltersStep
              allCategories={allCategories}
              allTypes={allChecks.map((c) => c.type)}
              categories={categories}
              setCategories={setCategories}
              types={types}
              setTypes={setTypes}
              severities={severities}
              setSeverities={setSeverities}
              pageUrlContains={pageUrlContains}
              setPageUrlContains={setPageUrlContains}
              minPagesAffected={minPagesAffected}
              setMinPagesAffected={setMinPagesAffected}
            />
          ) : null}
          {step === 2 ? (
            <ChannelsStep
              channels={channels}
              setChannels={setChannels}
            />
          ) : null}
          {step === 3 ? (
            <ReviewStep
              name={name}
              setName={setName}
              params={params}
            />
          ) : null}
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={step === 0}
              onClick={back}
              data-testid="composer-back"
            >
              Back
            </Button>
            {step < lastStep ? (
              <Button
                type="button"
                size="sm"
                onClick={next}
                data-testid="composer-next"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={createMut.isPending}
                onClick={() => createMut.mutate()}
                data-testid="composer-submit"
              >
                {createMut.isPending ? "Creating..." : "Create rule"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TriggerStep({
  trigger,
  onChange,
}: {
  trigger: AlertRuleTrigger
  onChange: (next: AlertRuleTrigger) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="trigger-kind">Trigger</Label>
        <Select
          value={trigger.kind}
          onValueChange={(v) =>
            onChange(defaultTriggerForKind(v as AlertRuleTrigger["kind"]))
          }
        >
          <SelectTrigger id="trigger-kind" data-testid="trigger-kind-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_KIND_OPTIONS.map((o) => (
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

      {trigger.kind === "ALERT_FIRED" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(trigger.firstSeen)}
            onCheckedChange={(v) =>
              onChange({ kind: "ALERT_FIRED", firstSeen: Boolean(v) })
            }
            data-testid="trigger-first-seen"
          />
          <span>
            Only fire on the first occurrence of each alert type
          </span>
        </label>
      ) : null}

      {trigger.kind === "SCORE_THRESHOLD" ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label>Operator</Label>
            <Select
              value={trigger.op}
              onValueChange={(v) =>
                onChange({ ...trigger, op: v as AlertRuleTriggerOp })
              }
            >
              <SelectTrigger
                className="w-24"
                data-testid="trigger-score-op"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OP_OPTIONS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trigger-score-value">Score</Label>
            <Input
              id="trigger-score-value"
              type="number"
              min={0}
              max={100}
              value={trigger.value}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  value: Number(e.target.value),
                })
              }
              className="w-24"
              data-testid="trigger-score-value"
            />
          </div>
        </div>
      ) : null}

      {trigger.kind === "ALERT_COUNT_THRESHOLD" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Severity</Label>
            <Select
              value={trigger.severity ?? "ANY"}
              onValueChange={(v) => {
                if (v === "ANY") {
                  const { severity: _ignored, ...rest } = trigger
                  onChange({ ...rest })
                } else {
                  onChange({ ...trigger, severity: v as Severity })
                }
              }}
            >
              <SelectTrigger
                className="w-32"
                data-testid="trigger-count-severity"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Any</SelectItem>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Operator</Label>
            <Select
              value={trigger.op}
              onValueChange={(v) =>
                onChange({ ...trigger, op: v as AlertRuleTriggerOp })
              }
            >
              <SelectTrigger
                className="w-24"
                data-testid="trigger-count-op"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OP_OPTIONS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trigger-count-value">Count</Label>
            <Input
              id="trigger-count-value"
              type="number"
              min={0}
              value={trigger.value}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  value: Number(e.target.value),
                })
              }
              className="w-24"
              data-testid="trigger-count-value"
            />
          </div>
        </div>
      ) : null}

      <p
        className="rounded-md border border-muted-foreground/20 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        data-testid="digest-period-note"
      >
        Cron-style digest scheduling lands in Phase 5+; use the canned Weekly
        digest rule for now.
      </p>
    </div>
  )
}

function FiltersStep({
  allCategories,
  allTypes,
  categories,
  setCategories,
  types,
  setTypes,
  severities,
  setSeverities,
  pageUrlContains,
  setPageUrlContains,
  minPagesAffected,
  setMinPagesAffected,
}: {
  allCategories: string[]
  allTypes: string[]
  categories: string[]
  setCategories: (next: string[]) => void
  types: string[]
  setTypes: (next: string[]) => void
  severities: Severity[]
  setSeverities: (next: Severity[]) => void
  pageUrlContains: string
  setPageUrlContains: (next: string) => void
  minPagesAffected: string
  setMinPagesAffected: (next: string) => void
}) {
  const [typeQuery, setTypeQuery] = useState("")
  const filteredTypes = useMemo(() => {
    if (typeQuery.trim().length === 0) return [] as string[]
    const q = typeQuery.trim().toLowerCase()
    return allTypes
      .filter((t) => t.toLowerCase().includes(q) && !types.includes(t))
      .slice(0, 8)
  }, [typeQuery, allTypes, types])

  function toggle<T>(arr: T[], setter: (next: T[]) => void, value: T): void {
    setter(
      arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value],
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Categories</Label>
        <div
          className="flex flex-wrap gap-1.5"
          data-testid="filters-categories"
        >
          {allCategories.map((c) => {
            const active = categories.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(categories, setCategories, c)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filters-type-query">Alert types</Label>
        <Input
          id="filters-type-query"
          value={typeQuery}
          onChange={(e) => setTypeQuery(e.target.value)}
          placeholder="Search alert types..."
          data-testid="filters-type-query"
        />
        {filteredTypes.length > 0 ? (
          <ul className="rounded-md border">
            {filteredTypes.map((t) => (
              <li
                key={t}
                className="flex items-center justify-between px-2 py-1 text-xs"
              >
                <span className="font-mono">{t}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTypes([...types, t])
                    setTypeQuery("")
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {types.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {types.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                <span className="font-mono">{t}</span>
                <button
                  type="button"
                  onClick={() => setTypes(types.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Severities</Label>
        <div className="flex flex-wrap gap-3">
          {SEVERITY_OPTIONS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={severities.includes(s)}
                onCheckedChange={() => toggle(severities, setSeverities, s)}
                data-testid={`filters-severity-${s}`}
              />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="filters-page-url">Page URL contains</Label>
          <Input
            id="filters-page-url"
            value={pageUrlContains}
            onChange={(e) => setPageUrlContains(e.target.value)}
            placeholder="/blog/"
            data-testid="filters-page-url"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filters-min-pages">Min pages affected</Label>
          <Input
            id="filters-min-pages"
            type="number"
            min={0}
            value={minPagesAffected}
            onChange={(e) => setMinPagesAffected(e.target.value)}
            placeholder="0"
            data-testid="filters-min-pages"
          />
        </div>
      </div>
    </div>
  )
}

function ChannelsStep({
  channels,
  setChannels,
}: {
  channels: NotificationChannel[]
  setChannels: (next: NotificationChannel[]) => void
}) {
  function toggle(c: NotificationChannel): void {
    setChannels(
      channels.includes(c)
        ? channels.filter((x) => x !== c)
        : [...channels, c],
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Leave all unchecked to use every channel configured for your tenant.
      </p>
      <div className="space-y-2">
        {CHANNEL_OPTIONS.map((c) => (
          <label key={c.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={channels.includes(c.value)}
              onCheckedChange={() => toggle(c.value)}
              data-testid={`channel-${c.value}`}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function ReviewStep({
  name,
  setName,
  params,
}: {
  name: string
  setName: (next: string) => void
  params: CustomAlertRuleParams
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="review-name">Name</Label>
        <Input
          id="review-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional - short label for this rule"
          data-testid="review-name"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Rule preview</Label>
        <pre
          className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px]"
          data-testid="review-json"
        >
          {JSON.stringify(params, null, 2)}
        </pre>
      </div>
    </div>
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
        tenantId={tenantId}
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
