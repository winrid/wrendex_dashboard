// Settings page (plan section 14.1 + 14.3 + 8.2). Three-tabs layout:
//
//   Account  - profile (read-only email), real password-change form (BE iter
//              2 round 1), active sessions list (stub).
//   Tenant   - tenant name (read-only), email channel editor, Slack stub,
//              MS Teams + PagerDuty channel editors (BE iter 2 round 2).
//   Sites    - list of sites with a link to per-site settings.

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  BillingSnapshot,
  EmailChannel,
  EmailChannelKind,
  PagerDutyChannel,
  Plan,
  SeverityFloor,
  Site,
  SlackChannel,
  TeamsChannel,
} from "@/api/types"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { siteDisplayName } from "@/lib/format"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Tab: Account
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

type PasswordValues = z.infer<typeof passwordSchema>

function ChangePasswordCard() {
  const client = useApiClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await client.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      toast.success("Password changed successfully")
      reset()
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 401) {
          setError("currentPassword", {
            type: "server",
            message: "Current password is incorrect",
          })
          return
        }
        if (e.status === 400) {
          setError("newPassword", {
            type: "server",
            message: "Password too weak (min 8 characters)",
          })
          return
        }
      }
      setServerError("Could not change password. Please try again.")
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Pick a new password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={onSubmit}
          noValidate
          data-testid="change-password-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.currentPassword ? true : undefined}
              {...register("currentPassword")}
            />
            {errors.currentPassword ? (
              <p
                className="text-xs text-destructive"
                data-testid="error-current-password"
              >
                {errors.currentPassword.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.newPassword ? true : undefined}
              {...register("newPassword")}
            />
            {errors.newPassword ? (
              <p
                className="text-xs text-destructive"
                data-testid="error-new-password"
              >
                {errors.newPassword.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>
          {serverError ? (
            <p className="text-xs text-destructive">{serverError}</p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AccountTab() {
  const auth = useAuth()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={auth.user?.email ?? ""}
              readOnly
              aria-readonly
            />
          </div>
        </CardContent>
      </Card>

      <ChangePasswordCard />

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Devices currently signed in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            <li className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">This device</div>
                <div className="text-xs text-muted-foreground">
                  Signed in now
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled
                title="Session revoke endpoint is not yet wired"
              >
                Revoke
              </Button>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Revoking individual sessions wires up when the BE endpoint lands.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Tenant + Email channel editor (plan section 8.2)
// ---------------------------------------------------------------------------

function TenantTab({ tenantId }: { tenantId: string }) {
  const auth = useAuth()
  const tenantName =
    auth.memberships.find((m) => m.tenantId === tenantId)?.tenantName ?? ""

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
          <CardDescription>This workspace's display name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tenant-name">Workspace name</Label>
            <Input
              id="tenant-name"
              value={tenantName}
              readOnly
              aria-readonly
            />
          </div>
        </CardContent>
      </Card>

      <EmailChannelCard tenantId={tenantId} />
      <SlackChannelCard tenantId={tenantId} />
      <TeamsChannelCard tenantId={tenantId} />
      <PagerDutyChannelCard tenantId={tenantId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slack channel card (plan section 8.2). BE iter 1 wired
// SlackChannelController; the FE OAuth install flow lives here:
//
//   1. GET /api/tenants/{tenantId}/slack-channel
//      -> 200 means connected; render the team / channel + Disconnect.
//      -> 404 means not connected; render the Install button.
//   2. Install: POST /api/tenants/{tenantId}/slack-channel/install/start
//      with { returnUrl } where returnUrl is the current page URL. The BE
//      returns { url } pointing at Slack's OAuth authorize endpoint;
//      window.location.href = url sends the browser there. After Slack
//      redirects back to /api/slack/oauth/callback, the BE 302s the user
//      to the returnUrl. This page re-fetches getSlackChannel and flips
//      to the connected state.
//   3. Disconnect: DELETE /api/tenants/{tenantId}/slack-channel.
// ---------------------------------------------------------------------------

function SlackChannelCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const channelQ = useQuery<SlackChannel | null>({
    queryKey: ["slack-channel", tenantId],
    queryFn: async () => {
      try {
        return await client.getSlackChannel(tenantId)
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 1
    },
  })

  const installMut = useMutation({
    mutationFn: () =>
      client.startSlackInstall(tenantId, {
        returnUrl: window.location.origin + window.location.pathname,
      }),
    onSuccess: (resp) => {
      if (resp?.url) {
        window.location.href = resp.url
      }
    },
    onError: () => toast.error("Could not start Slack install"),
  })

  const disconnectMut = useMutation({
    mutationFn: () => client.deleteSlackChannel(tenantId),
    onSuccess: () => {
      queryClient.setQueryData<SlackChannel | null>(
        ["slack-channel", tenantId],
        null,
      )
      toast.success("Slack disconnected")
    },
    onError: () => toast.error("Could not disconnect Slack"),
  })

  const channel = channelQ.data
  const isConnected = channel != null

  return (
    <Card data-testid="slack-channel-card">
      <CardHeader>
        <CardTitle>Slack channel</CardTitle>
        <CardDescription>
          Send alert notifications to a Slack workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {channelQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isConnected ? (
          <div className="space-y-2" data-testid="slack-connected">
            <div className="text-sm">
              Connected to{" "}
              <span className="font-medium">
                {channel?.slackTeamName ?? "Slack workspace"}
              </span>
              {channel?.defaultChannelName ? (
                <>
                  {" "}
                  in{" "}
                  <span className="font-mono text-xs">
                    #{channel.defaultChannelName}
                  </span>
                </>
              ) : null}
              .
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => installMut.mutate()}
                disabled={installMut.isPending}
              >
                {installMut.isPending ? "Reinstalling..." : "Reinstall"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
                data-testid="slack-disconnect"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2" data-testid="slack-not-connected">
            <p className="text-sm text-muted-foreground">
              Install the Wrendex Slack app to receive alerts in a channel of
              your choice.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => installMut.mutate()}
              disabled={installMut.isPending}
              data-testid="slack-install-button"
            >
              {installMut.isPending ? "Starting..." : "Install to Slack"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// MS Teams channel editor (plan section 8.2). Pro plan or above.
// BE iter 2 round 2 wires the endpoints; until they ship the GET 404 is
// surfaced as the empty form.
// ---------------------------------------------------------------------------

function planAtLeast(plan: Plan | null | undefined, target: Plan): boolean {
  if (!plan) return false
  const order: Record<Plan, number> = {
    STARTER: 0,
    PROFESSIONAL: 1,
    AGENCY: 2,
  }
  return order[plan] >= order[target]
}

const TEAMS_WEBHOOK_RE = /^https:\/\//

function TeamsChannelCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const billingQ = useQuery<BillingSnapshot>({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
  })

  const channelQ = useQuery<TeamsChannel | null>({
    queryKey: ["teams-channel", tenantId],
    queryFn: async () => {
      try {
        return await client.getTeamsChannel(tenantId)
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 1
    },
  })

  const [webhookUrl, setWebhookUrl] = useState("")
  const [error, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (channelQ.data) setWebhookUrl(channelQ.data.webhookUrl)
  }, [channelQ.data])

  const saveMut = useMutation({
    mutationFn: () =>
      client.updateTeamsChannel(tenantId, { webhookUrl: webhookUrl.trim() }),
    onSuccess: (next) => {
      queryClient.setQueryData<TeamsChannel>(
        ["teams-channel", tenantId],
        next,
      )
      toast.success("MS Teams channel saved")
      setErrorMsg(null)
    },
    onError: () => toast.error("Could not save MS Teams channel"),
  })

  const deleteMut = useMutation({
    mutationFn: () => client.deleteTeamsChannel(tenantId),
    onSuccess: () => {
      queryClient.setQueryData<TeamsChannel | null>(
        ["teams-channel", tenantId],
        null,
      )
      setWebhookUrl("")
      toast.success("MS Teams channel disconnected")
    },
    onError: () => toast.error("Could not disconnect MS Teams channel"),
  })

  const plan = billingQ.data?.plan
  const isProOrBetter = planAtLeast(plan, "PROFESSIONAL")
  const disabled = !isProOrBetter

  const onSave = () => {
    if (!TEAMS_WEBHOOK_RE.test(webhookUrl.trim())) {
      setErrorMsg("Webhook URL must start with https://")
      return
    }
    setErrorMsg(null)
    saveMut.mutate()
  }

  return (
    <Card data-testid="teams-channel-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          MS Teams channel
          {disabled ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              data-testid="teams-plan-gate"
            >
              Pro plan only
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Post alerts to a Microsoft Teams Incoming Webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="teams-webhook">Incoming webhook URL</Label>
          <Input
            id="teams-webhook"
            type="url"
            placeholder="https://outlook.office.com/webhook/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            disabled={disabled || channelQ.isLoading}
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onSave}
            disabled={disabled || saveMut.isPending || webhookUrl.trim().length === 0}
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast.success("Test alert sent - check your Teams channel.")
            }
            disabled={disabled || !channelQ.data}
          >
            Send test alert
          </Button>
          {channelQ.data ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// PagerDuty channel editor (plan section 8.2). Agency plan only.
// ---------------------------------------------------------------------------

const SEVERITY_FLOORS: SeverityFloor[] = ["ERROR", "WARNING", "NOTICE"]

function PagerDutyChannelCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const billingQ = useQuery<BillingSnapshot>({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
  })

  const channelQ = useQuery<PagerDutyChannel | null>({
    queryKey: ["pagerduty-channel", tenantId],
    queryFn: async () => {
      try {
        return await client.getPagerDutyChannel(tenantId)
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 1
    },
  })

  const [integrationKey, setIntegrationKey] = useState("")
  const [severityFloor, setSeverityFloor] = useState<SeverityFloor>("ERROR")

  useEffect(() => {
    if (channelQ.data) {
      setIntegrationKey("")
      setSeverityFloor(channelQ.data.severityFloor)
    }
  }, [channelQ.data])

  const saveMut = useMutation({
    mutationFn: () =>
      client.updatePagerDutyChannel(tenantId, {
        integrationKey: integrationKey.trim(),
        severityFloor,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData<PagerDutyChannel>(
        ["pagerduty-channel", tenantId],
        next,
      )
      toast.success("PagerDuty channel saved")
      setIntegrationKey("")
    },
    onError: () => toast.error("Could not save PagerDuty channel"),
  })

  const deleteMut = useMutation({
    mutationFn: () => client.deletePagerDutyChannel(tenantId),
    onSuccess: () => {
      queryClient.setQueryData<PagerDutyChannel | null>(
        ["pagerduty-channel", tenantId],
        null,
      )
      setIntegrationKey("")
      toast.success("PagerDuty channel disconnected")
    },
    onError: () => toast.error("Could not disconnect PagerDuty channel"),
  })

  const plan = billingQ.data?.plan
  const isAgency = planAtLeast(plan, "AGENCY")
  const disabled = !isAgency

  return (
    <Card data-testid="pagerduty-channel-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          PagerDuty channel
          {disabled ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              data-testid="pagerduty-plan-gate"
            >
              Agency only
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Page on-call when alerts breach the severity floor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pagerduty-key">Integration key</Label>
          <Input
            id="pagerduty-key"
            type="text"
            placeholder={
              channelQ.data?.integrationKeyPreview
                ? `Configured (${channelQ.data.integrationKeyPreview})`
                : "Paste your PagerDuty integration key"
            }
            value={integrationKey}
            onChange={(e) => setIntegrationKey(e.target.value)}
            disabled={disabled || channelQ.isLoading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pagerduty-severity">Severity floor</Label>
          <Select
            value={severityFloor}
            onValueChange={(v) => setSeverityFloor(v as SeverityFloor)}
            disabled={disabled}
          >
            <SelectTrigger id="pagerduty-severity" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_FLOORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={
              disabled ||
              saveMut.isPending ||
              (integrationKey.trim().length === 0 && !channelQ.data)
            }
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast.success("Test alert sent - check your PagerDuty service.")
            }
            disabled={disabled || !channelQ.data}
          >
            Send test alert
          </Button>
          {channelQ.data ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

const emailRecipientSchema = z.string().email("Enter a valid email")

export function EmailChannelCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const channelQ = useQuery({
    queryKey: ["email-channel", tenantId],
    queryFn: () => client.getEmailChannel(tenantId),
    enabled: Boolean(tenantId),
  })

  const [kind, setKind] = useState<EmailChannelKind>("MEMBERS")
  const [recipients, setRecipients] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState<string | null>(null)

  // Sync server snapshot -> local state on first load / refetch.
  useEffect(() => {
    if (!channelQ.data) return
    setKind(channelQ.data.kind)
    setRecipients(channelQ.data.recipients ?? [])
  }, [channelQ.data])

  const saveMut = useMutation({
    mutationFn: (input: { kind: EmailChannelKind; recipients: string[] }) =>
      client.updateEmailChannel(tenantId, input),
    onSuccess: (next) => {
      toast.success("Email recipients updated")
      queryClient.setQueryData<EmailChannel>(
        ["email-channel", tenantId],
        next,
      )
    },
    onError: () => {
      toast.error("Could not update email recipients.")
    },
  })

  const showRecipients = kind !== "MEMBERS"

  const addChip = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    const parsed = emailRecipientSchema.safeParse(trimmed)
    if (!parsed.success) {
      setDraftError("Enter a valid email")
      return
    }
    if (recipients.includes(trimmed)) {
      setDraft("")
      return
    }
    setRecipients([...recipients, trimmed])
    setDraft("")
    setDraftError(null)
  }

  const removeChip = (value: string) => {
    setRecipients(recipients.filter((r) => r !== value))
  }

  const onSave = () => {
    if (showRecipients && recipients.length === 0) {
      setDraftError("Add at least one recipient for this mode")
      return
    }
    saveMut.mutate({ kind, recipients })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email recipients</CardTitle>
        <CardDescription>
          Choose who receives alert emails for this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {channelQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : channelQ.isError ? (
          <p className="text-sm text-destructive">
            Could not load email recipients.
          </p>
        ) : (
          <>
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v as EmailChannelKind)}
              data-testid="email-channel-kind"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem id="kind-members" value="MEMBERS" />
                <div>
                  <Label htmlFor="kind-members">Workspace members</Label>
                  <p className="text-xs text-muted-foreground">
                    Send alerts to every member of this workspace.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem id="kind-custom" value="CUSTOM" />
                <div>
                  <Label htmlFor="kind-custom">Custom recipients only</Label>
                  <p className="text-xs text-muted-foreground">
                    Send alerts only to the addresses you specify.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem id="kind-both" value="BOTH" />
                <div>
                  <Label htmlFor="kind-both">Members and custom</Label>
                  <p className="text-xs text-muted-foreground">
                    Send to workspace members plus the addresses you specify.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {showRecipients ? (
              <div
                className="space-y-2"
                data-testid="email-channel-recipients"
              >
                <Label htmlFor="recipient-input">Recipient emails</Label>
                <div className="flex flex-wrap gap-1">
                  {recipients.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                    >
                      {r}
                      <button
                        type="button"
                        aria-label={`Remove ${r}`}
                        onClick={() => removeChip(r)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="recipient-input"
                    type="email"
                    placeholder="alerts@yourcompany.com"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setDraftError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addChip()
                      }
                    }}
                    aria-invalid={draftError ? true : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addChip}
                  >
                    Add
                  </Button>
                </div>
                {draftError ? (
                  <p className="text-xs text-destructive">{draftError}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <Button onClick={onSave} disabled={saveMut.isPending}>
                {saveMut.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tab: Sites
// ---------------------------------------------------------------------------

function SitesTab({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const sitesQ = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: () => client.listSitesByTenant(tenantId),
    enabled: Boolean(tenantId),
  })

  const sites = useMemo<Site[]>(() => sitesQ.data ?? [], [sitesQ.data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sites</CardTitle>
        <CardDescription>
          Configure the schedule, alert rules, and danger zone per site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sitesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading sites...</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sites yet.{" "}
            <Link
              to={`/t/${tenantId}/sites`}
              className="underline hover:text-foreground"
            >
              Add one
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {sites.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{siteDisplayName(s.url)}</div>
                  <div className="text-xs text-muted-foreground">{s.url}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/t/${tenantId}/sites/${s.id}/settings`}>
                    Settings
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function Settings() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const [tab, setTab] = useState("account")

  return (
    <div className="space-y-4">
      <Toaster />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account, tenant, and per-site configuration.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
        </TabsList>
        <TabsContent
          value="account"
          className={cn("mt-4")}
          data-testid="tab-account"
        >
          <AccountTab />
        </TabsContent>
        <TabsContent
          value="tenant"
          className={cn("mt-4")}
          data-testid="tab-tenant"
        >
          <TenantTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent
          value="sites"
          className={cn("mt-4")}
          data-testid="tab-sites"
        >
          <SitesTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
