// Settings page (plan section 14.1 + 14.3 + 8.2). Three-tabs layout:
//
//   Account  - profile (read-only email), password change form (stub),
//              active sessions list (stub).
//   Tenant   - tenant name (read-only), email channel editor.
//   Sites    - list of sites with a link to per-site settings.
//
// All forms are RHF + zod. The change-password endpoint is a Phase 1.5
// deferral on the BE; the typed client throws ApiError(501) and the form
// catches it to surface a "wires up later" toast (see AGENTS.md).

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  EmailChannel,
  EmailChannelKind,
  Site,
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
import { Toaster } from "@/components/ui/sonner"
import { siteDisplayName } from "@/lib/format"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Tab: Account
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

type PasswordValues = z.infer<typeof passwordSchema>

function AccountTab() {
  const auth = useAuth()
  const client = useApiClient()
  const {
    register,
    handleSubmit,
    reset,
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
    try {
      await client.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      toast.success("Password updated")
      reset()
    } catch (err) {
      // The stub throws ApiError(501) until the BE ships. Surface a soft
      // message instead of an error toast so it reads as deliberate.
      if (err instanceof ApiError && err.status === 501) {
        toast.message(
          "Password change wires up when the BE endpoint lands",
        )
        reset()
        return
      }
      toast.error("Could not update password.")
    }
  })

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

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Pick a new password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.currentPassword ? true : undefined}
                {...register("currentPassword")}
              />
              {errors.currentPassword ? (
                <p className="text-xs text-destructive">
                  {errors.currentPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.newPassword ? true : undefined}
                {...register("newPassword")}
              />
              {errors.newPassword ? (
                <p className="text-xs text-destructive">
                  {errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
    </div>
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
