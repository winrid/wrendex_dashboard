// Settings page (plan section 14.1 + 14.3 + 8.2). Three-tabs layout:
//
//   Account  - profile (read-only email), real password-change form (BE iter
//              2 round 1), active sessions list (stub).
//   Tenant   - tenant name (read-only), email channel editor, Slack stub,
//              MS Teams + PagerDuty channel editors (BE iter 2 round 2).
//   Sites    - list of sites with a link to per-site settings.

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
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
  TenantBranding,
  TenantSamlConfig,
  TenantTlsCert,
  VerifySubdomainResponse,
} from "@/api/types"
import { spMetadataUrl } from "@/lib/sso"
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
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SharingTab } from "@/components/share/SharingTab"
import { TwoFactorSection } from "@/components/account/TwoFactorSection"
import { ApiTokensSection } from "@/components/account/ApiTokensSection"
import { relativeTime, siteDisplayName } from "@/lib/format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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

      <TwoFactorSection />

      <ApiTokensSection />

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
      <BrandingCard tenantId={tenantId} />
      <CustomSubdomainCard tenantId={tenantId} />
      <SamlConfigCard tenantId={tenantId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Branding (white-label) card. Plan section 12.3, AGENCY-only feature.
// Visible to all tiers but disabled with an "Agency plan only" badge for
// non-AGENCY tenants. The PUT endpoint 403s for lower tiers; we catch that
// and surface the upgrade prompt as a toast.
//
// Logo upload uses a FileReader -> data URL; the BE persists the data URL
// directly. SVG / PNG, capped at 200KB on the client to keep the payload
// manageable (the BE can apply a stricter cap server-side).
// ---------------------------------------------------------------------------

const ACCENT_HEX_RE = /^#[0-9a-fA-F]{6}$/
const LOGO_MAX_BYTES = 200 * 1024
const LOGO_MIME_RE = /^image\/(svg\+xml|png)$/i
const DEFAULT_ACCENT = "#3b82f6"

function isValidAccent(hex: string): boolean {
  return ACCENT_HEX_RE.test(hex.trim())
}

export function BrandingCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const billingQ = useQuery<BillingSnapshot>({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
  })

  const brandingQ = useQuery<TenantBranding | null>({
    queryKey: ["branding", tenantId],
    queryFn: async () => {
      try {
        return await client.getBranding(tenantId)
      } catch (e) {
        // 404 = never customised; surface as null so the form falls back to
        // defaults. 403 = plan-gated; the disabled flag below is what
        // surfaces the Agency only badge so we still treat it as "no
        // branding loaded".
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
      return failureCount < 1
    },
  })

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT)
  const [fromName, setFromName] = useState<string>("")
  const [hidePoweredBy, setHidePoweredBy] = useState<boolean>(false)
  const [accentError, setAccentError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  // Sync server snapshot into local form state on first load / refetch.
  useEffect(() => {
    if (!brandingQ.data) return
    setLogoDataUrl(brandingQ.data.logoDataUrl ?? null)
    setAccentColor(brandingQ.data.accentColor ?? DEFAULT_ACCENT)
    setFromName(brandingQ.data.fromName ?? "")
    setHidePoweredBy(Boolean(brandingQ.data.hidePoweredBy))
  }, [brandingQ.data])

  const saveMut = useMutation({
    mutationFn: () =>
      client.updateBranding(tenantId, {
        logoDataUrl,
        accentColor,
        fromName: fromName.trim() || null,
        hidePoweredBy,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData<TenantBranding>(["branding", tenantId], next)
      // Eager-apply the new accent so the dashboard reflects the change
      // before the AuthProvider's branding query refetches.
      if (typeof document !== "undefined" && next.accentColor) {
        document.documentElement.style.setProperty(
          "--brand-accent",
          next.accentColor,
        )
      }
      toast.success("Branding updated")
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 403) {
        toast.error(
          "White-label branding is an Agency plan feature. Upgrade in Billing.",
          {
            action: {
              label: "Upgrade",
              onClick: () => {
                window.location.href = `/t/${tenantId}/billing`
              },
            },
          },
        )
        return
      }
      toast.error("Could not save branding. Please try again.")
    },
  })

  const onPickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!LOGO_MIME_RE.test(file.type)) {
      setLogoError("Logo must be an SVG or PNG file")
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Logo must be 200KB or smaller")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        setLogoDataUrl(result)
      }
    }
    reader.onerror = () => {
      setLogoError("Could not read logo file")
    }
    reader.readAsDataURL(file)
  }

  const onSave = () => {
    if (!isValidAccent(accentColor)) {
      setAccentError("Accent colour must be a 6-digit hex (e.g. #3b82f6)")
      return
    }
    setAccentError(null)
    saveMut.mutate()
  }

  const plan = billingQ.data?.plan
  const isAgency = planAtLeast(plan, "AGENCY")
  const disabled = !isAgency

  return (
    <Card data-testid="branding-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Branding
          {disabled ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              data-testid="branding-plan-gate"
            >
              Agency plan only
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Customise the logo, accent colour, and email "from" name shown on
          shared reports and PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="branding-logo">Logo</Label>
          <div className="flex items-center gap-3">
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Tenant logo preview"
                className="h-12 w-auto max-w-[12rem] rounded border bg-background p-1"
                data-testid="branding-logo-preview"
              />
            ) : (
              <div className="flex h-12 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <Input
              id="branding-logo"
              type="file"
              accept="image/svg+xml,image/png"
              onChange={onPickLogo}
              disabled={disabled}
              data-testid="branding-logo-input"
              className="max-w-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            SVG or PNG, up to 200KB.
          </p>
          {logoError ? (
            <p className="text-xs text-destructive" data-testid="branding-logo-error">
              {logoError}
            </p>
          ) : null}
          {logoDataUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLogoDataUrl(null)}
              disabled={disabled}
            >
              Remove logo
            </Button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branding-accent">Accent colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isValidAccent(accentColor) ? accentColor : DEFAULT_ACCENT}
              onChange={(e) => {
                setAccentColor(e.target.value)
                setAccentError(null)
              }}
              disabled={disabled}
              aria-label="Accent colour picker"
              className="h-9 w-12 cursor-pointer rounded border bg-background"
              data-testid="branding-accent-picker"
            />
            <Input
              id="branding-accent"
              type="text"
              value={accentColor}
              onChange={(e) => {
                setAccentColor(e.target.value)
                setAccentError(null)
              }}
              disabled={disabled}
              placeholder="#3b82f6"
              className="max-w-[10rem] font-mono"
              aria-invalid={accentError ? true : undefined}
              data-testid="branding-accent-input"
            />
          </div>
          {accentError ? (
            <p
              className="text-xs text-destructive"
              data-testid="branding-accent-error"
            >
              {accentError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branding-from-name">From name</Label>
          <Input
            id="branding-from-name"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Acme SEO"
            disabled={disabled}
            className="max-w-sm"
            data-testid="branding-from-name"
          />
          <p className="text-xs text-muted-foreground">
            Appears as "Sent from {fromName.trim() || "Wrendex"}" in alert
            emails.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <Label htmlFor="branding-hide-powered" className="text-sm">
              Hide "Powered by Wrendex"
            </Label>
            <p className="text-xs text-muted-foreground">
              Removes the footer from shared reports and PDFs.
            </p>
          </div>
          <Switch
            id="branding-hide-powered"
            checked={hidePoweredBy}
            onCheckedChange={(v) => setHidePoweredBy(Boolean(v))}
            disabled={disabled}
            data-testid="branding-hide-powered"
          />
        </div>

        <div>
          <Button
            type="button"
            onClick={onSave}
            disabled={disabled || saveMut.isPending}
            data-testid="branding-save"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Custom subdomain card (P4 iter 4). AGENCY-only feature; lower tiers see
// the form disabled with the same Agency plan only badge as branding.
//
// Scope: this UI only configures the customer's CNAME pointer (record stays
// on the customer's DNS, points at wrendex.com) and surfaces the BE's most
// recent CNAME-resolution check. TLS cert provisioning + reverse-proxy
// routing for the subdomain is Phase 5+ infra work and is intentionally
// out of scope for this iteration.
//
// State machine surfaced via the verification pill:
//   - customSubdomainVerifiedAt == null      -> "Not verified" + CNAME hint
//   - verifiedAt set + lastDnsCheckResult==ok -> "Verified" (green)
//   - lastDnsCheckResult set, non-"ok"        -> "Issue: <result>" (amber)
// ---------------------------------------------------------------------------

const CUSTOM_SUBDOMAIN_CNAME_TARGET = "wrendex.com"

export function CustomSubdomainCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const billingQ = useQuery<BillingSnapshot>({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
  })

  const brandingQ = useQuery<TenantBranding | null>({
    queryKey: ["branding", tenantId],
    queryFn: async () => {
      try {
        return await client.getBranding(tenantId)
      } catch (e) {
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
      return failureCount < 1
    },
  })

  const [subdomain, setSubdomain] = useState("")
  // Track whether the user has edited the input so we don't stomp their
  // typing every time react-query refetches the branding row.
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) return
    setSubdomain(brandingQ.data?.customSubdomain ?? "")
  }, [brandingQ.data, touched])

  const saveMut = useMutation({
    mutationFn: () =>
      client.updateBranding(tenantId, {
        customSubdomain: subdomain.trim() || null,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData<TenantBranding>(["branding", tenantId], next)
      setTouched(false)
      toast.success("Custom subdomain saved")
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 403) {
        toast.error(
          "Custom subdomains are an Agency plan feature. Upgrade in Billing.",
          {
            action: {
              label: "Upgrade",
              onClick: () => {
                window.location.href = `/t/${tenantId}/billing`
              },
            },
          },
        )
        return
      }
      toast.error("Could not save subdomain. Please try again.")
    },
  })

  const verifyMut = useMutation<VerifySubdomainResponse>({
    mutationFn: () => client.verifySubdomain(tenantId),
    onSuccess: (next) => {
      // Merge the verify response back onto the cached branding row so the
      // pill flips immediately without a refetch.
      queryClient.setQueryData<TenantBranding | null>(
        ["branding", tenantId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            customSubdomain: next.customSubdomain ?? old.customSubdomain,
            customSubdomainVerifiedAt: next.verified
              ? next.lastDnsCheckAt ?? old.customSubdomainVerifiedAt ?? null
              : old.customSubdomainVerifiedAt ?? null,
            lastDnsCheckAt:
              next.lastDnsCheckAt ?? old.lastDnsCheckAt ?? null,
            lastDnsCheckResult:
              next.lastDnsCheckResult ?? old.lastDnsCheckResult ?? null,
          }
        },
      )
      if (next.verified && next.lastDnsCheckResult === "ok") {
        toast.success("Subdomain verified")
      } else {
        toast.error(
          `DNS check failed: ${next.lastDnsCheckResult ?? "unknown error"}`,
        )
      }
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 403) {
        toast.error("Custom subdomains are an Agency plan feature.")
        return
      }
      toast.error("Could not run DNS check.")
    },
  })

  const plan = billingQ.data?.plan
  const isAgency = planAtLeast(plan, "AGENCY")
  const disabled = !isAgency

  const branding = brandingQ.data
  const verifiedAt = branding?.customSubdomainVerifiedAt ?? null
  const lastResult = branding?.lastDnsCheckResult ?? null
  const isVerified = Boolean(verifiedAt) && lastResult === "ok"
  const hasIssue = Boolean(lastResult) && lastResult !== "ok"

  return (
    <Card data-testid="custom-subdomain-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Custom subdomain
          {disabled ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              data-testid="custom-subdomain-plan-gate"
            >
              Agency plan only
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Serve Wrendex from your own domain (e.g. audits.acme.com). Configure
          the CNAME pointer, then provision a Let's Encrypt TLS certificate
          for the same subdomain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="custom-subdomain-input">Subdomain</Label>
          <Input
            id="custom-subdomain-input"
            data-testid="custom-subdomain-input"
            type="text"
            placeholder="audits.acme.com"
            value={subdomain}
            onChange={(e) => {
              setSubdomain(e.target.value)
              setTouched(true)
            }}
            disabled={disabled}
            className="max-w-md"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              data-testid="custom-subdomain-pill-verified"
            >
              Verified
            </span>
          ) : hasIssue ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
              data-testid="custom-subdomain-pill-issue"
            >
              Issue: {lastResult}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              data-testid="custom-subdomain-pill-unverified"
            >
              Not verified
            </span>
          )}
        </div>

        {!isVerified ? (
          <p className="text-xs text-muted-foreground">
            Add a CNAME record from{" "}
            <span className="font-mono">
              {subdomain.trim() || "your subdomain"}
            </span>{" "}
            to{" "}
            <span className="font-mono">{CUSTOM_SUBDOMAIN_CNAME_TARGET}</span>,
            then click Check DNS.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={disabled || saveMut.isPending}
            data-testid="custom-subdomain-save"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => verifyMut.mutate()}
            disabled={
              disabled || verifyMut.isPending || !subdomain.trim()
            }
            data-testid="custom-subdomain-verify"
          >
            {verifyMut.isPending ? "Checking..." : "Check DNS"}
          </Button>
        </div>

        <TlsCertSection
          tenantId={tenantId}
          disabled={disabled}
          isVerified={isVerified}
        />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// TLS certificate subsection inside the Custom subdomain card (P5 iter 3
// FE-C). Bound to getTlsCert(tenantId); polls every 10s while the cert is
// in a non-terminal state (PROVISIONING / RENEWING) and stops once the
// status reaches ACTIVE or FAILED.
//
// State surface:
//   - 404 from getTlsCert: "No TLS certificate yet." + Provision TLS button
//     (only enabled once the subdomain is CNAME-verified).
//   - status=PROVISIONING: "Provisioning... (this can take 1-2 minutes)"
//     plus a refresh-on-poll spinner indicator.
//   - status=ACTIVE: "Active. Issued: <relative>. Renews: <relative>."
//     plus a Revoke button gated behind a confirmation dialog.
//   - status=RENEWING: "Renewing in the background. Current cert remains
//     active until renewal completes."
//   - status=FAILED: "Provisioning failed: <lastError>" plus Retry (calls
//     provision-tls again).
// ---------------------------------------------------------------------------

const TLS_POLL_INTERVAL_MS = 10_000

function TlsCertSection({
  tenantId,
  disabled,
  isVerified,
}: {
  tenantId: string
  disabled: boolean
  isVerified: boolean
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [revokeOpen, setRevokeOpen] = useState(false)

  const certQ = useQuery<TenantTlsCert | null>({
    queryKey: ["tls-cert", tenantId],
    queryFn: async () => {
      try {
        return await client.getTlsCert(tenantId)
      } catch (e) {
        // 404 -> no cert ever ordered. 403 -> plan-gate (still treat as
        // "no cert" so non-AGENCY users see the gated UI not a crash).
        if (isApiError(e) && (e.status === 404 || e.status === 403))
          return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "PROVISIONING" || status === "RENEWING") {
        return TLS_POLL_INTERVAL_MS
      }
      return false
    },
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
      return failureCount < 1
    },
  })

  const provisionMut = useMutation({
    mutationFn: () => client.provisionTls(tenantId),
    onSuccess: (next) => {
      queryClient.setQueryData<TenantTlsCert | null>(
        ["tls-cert", tenantId],
        next,
      )
      toast.success("TLS provisioning started")
    },
    onError: (e) => {
      if (isApiError(e)) {
        if (e.status === 409) {
          toast.error(
            "Cannot provision TLS: subdomain not verified or order already in flight.",
          )
          return
        }
        if (e.status === 400) {
          toast.error("Set a custom subdomain before provisioning TLS.")
          return
        }
        if (e.status === 403) {
          toast.error("TLS provisioning is an Agency plan feature.")
          return
        }
      }
      toast.error("Could not start TLS provisioning. Please try again.")
    },
  })

  const revokeMut = useMutation({
    mutationFn: () => client.revokeTls(tenantId),
    onSuccess: () => {
      queryClient.setQueryData<TenantTlsCert | null>(
        ["tls-cert", tenantId],
        null,
      )
      toast.success("TLS certificate revoked")
      setRevokeOpen(false)
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 403) {
        toast.error("Only an OWNER on an Agency plan can revoke the cert.")
        return
      }
      toast.error("Could not revoke certificate.")
    },
  })

  const cert = certQ.data
  const isPolling = certQ.isFetching
  const status = cert?.status ?? null

  return (
    <div
      className="mt-4 space-y-2 border-t pt-4"
      data-testid="tls-cert-section"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">TLS certificate</h4>
        {status ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            data-testid="tls-cert-status-pill"
          >
            {status}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        TLS provisioning uses Let's Encrypt. Allow ~60-90 seconds after the
        DNS CNAME points at us before clicking Provision.
      </p>

      {certQ.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="tls-cert-loading">
          Loading...
        </p>
      ) : cert == null ? (
        <div className="space-y-2" data-testid="tls-cert-empty">
          <p className="text-sm text-muted-foreground">
            No TLS certificate yet.
          </p>
          <Button
            type="button"
            onClick={() => provisionMut.mutate()}
            disabled={
              disabled || !isVerified || provisionMut.isPending
            }
            data-testid="tls-cert-provision"
          >
            {provisionMut.isPending ? "Starting..." : "Provision TLS"}
          </Button>
          {!isVerified ? (
            <p className="text-xs text-muted-foreground">
              Verify the subdomain CNAME first to enable TLS provisioning.
            </p>
          ) : null}
        </div>
      ) : status === "PROVISIONING" ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="tls-cert-provisioning"
        >
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500"
            data-testid={
              isPolling ? "tls-cert-poll-active" : "tls-cert-poll-idle"
            }
            aria-hidden
          />
          <span>Provisioning... (this can take 1-2 minutes)</span>
        </div>
      ) : status === "ACTIVE" ? (
        <div className="space-y-2" data-testid="tls-cert-active">
          <p className="text-sm">
            Active. Issued:{" "}
            <span data-testid="tls-cert-issued">
              {relativeTime(cert.issuedAt)}
            </span>
            . Renews:{" "}
            <span data-testid="tls-cert-renews">
              {relativeTime(cert.renewAfter)}
            </span>
            .
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevokeOpen(true)}
            disabled={disabled}
            data-testid="tls-cert-revoke"
          >
            Revoke
          </Button>
        </div>
      ) : status === "RENEWING" ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="tls-cert-renewing"
        >
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500"
            aria-hidden
          />
          <span>
            Renewing in the background. Current cert remains active until
            renewal completes.
          </span>
        </div>
      ) : status === "FAILED" ? (
        <div className="space-y-2" data-testid="tls-cert-failed">
          <p className="text-sm text-destructive">
            Provisioning failed: {cert.lastError ?? "unknown error"}
          </p>
          <Button
            type="button"
            onClick={() => provisionMut.mutate()}
            disabled={disabled || provisionMut.isPending}
            data-testid="tls-cert-retry"
          >
            {provisionMut.isPending ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={revokeOpen}
        onOpenChange={(o) => !o && setRevokeOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke TLS certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              The certificate for{" "}
              <span className="font-mono">{cert?.subdomain}</span> will be
              revoked immediately. Visitors hitting that subdomain will see
              browser TLS errors until you provision a new cert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                revokeMut.mutate()
              }}
              data-testid="tls-cert-revoke-confirm"
            >
              {revokeMut.isPending ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SAML SSO config card (P4 iter 4). AGENCY-only feature; the BE 403s the
// PUT for non-OWNER members but the FE doesn't know the role here, so we
// surface the 403 inline if it lands.
//
// Three states the card has to render:
//   - 404 from getSamlConfig: "SSO is not configured." + Configure SAML
//   - 200 from getSamlConfig: summary card with Edit / Disconnect
//   - non-AGENCY plan: form disabled, Agency plan only badge
//
// The Configure SAML dialog is two visual steps in one form:
//   Step 1: SP metadata URL with copy button (the customer downloads this
//           XML and uploads it to their IdP to register Wrendex).
//   Step 2: Form for the three IdP fields (entity id, SSO url, X.509 cert).
//
// Bad-cert handling: BE returns 400 when the PEM doesn't parse; we pin
// that error to the cert textarea inline rather than toasting.
// ---------------------------------------------------------------------------

const PEM_HINT_RE = /-----BEGIN CERTIFICATE-----/

function SamlConfigCard({ tenantId }: { tenantId: string }) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const billingQ = useQuery<BillingSnapshot>({
    queryKey: ["billing", tenantId],
    queryFn: () => client.getBilling(tenantId),
    enabled: Boolean(tenantId),
  })

  const samlQ = useQuery<TenantSamlConfig | null>({
    queryKey: ["saml-config", tenantId],
    queryFn: async () => {
      try {
        return await client.getSamlConfig(tenantId)
      } catch (e) {
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
      return failureCount < 1
    },
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const disconnectMut = useMutation({
    mutationFn: () => client.deleteSamlConfig(tenantId),
    onSuccess: () => {
      queryClient.setQueryData<TenantSamlConfig | null>(
        ["saml-config", tenantId],
        null,
      )
      setConfirmDisconnect(false)
      toast.success("SAML SSO disconnected")
    },
    onError: () => toast.error("Could not disconnect SAML"),
  })

  const plan = billingQ.data?.plan
  const isAgency = planAtLeast(plan, "AGENCY")
  const disabled = !isAgency
  const config = samlQ.data ?? null
  const isConfigured = config !== null

  return (
    <Card data-testid="saml-config-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          SAML SSO
          {disabled ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              data-testid="saml-plan-gate"
            >
              Agency plan only
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Let your team sign in with your identity provider (Okta, Azure AD,
          OneLogin, ...). Owners can configure the IdP fields below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {samlQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isConfigured ? (
          <div className="space-y-2" data-testid="saml-configured">
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Status:</span>{" "}
                {config?.enabled ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Enabled
                  </span>
                ) : (
                  <span className="text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="break-all">
                <span className="font-medium">IdP entity id:</span>{" "}
                <span className="font-mono text-xs">
                  {config?.idpEntityId}
                </span>
              </div>
              <div className="break-all">
                <span className="font-medium">IdP SSO URL:</span>{" "}
                <span className="font-mono text-xs">{config?.idpSsoUrl}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                disabled={disabled}
                data-testid="saml-edit"
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
                disabled={disabled || disconnectMut.isPending}
                data-testid="saml-disconnect"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2" data-testid="saml-not-configured">
            <p className="text-sm text-muted-foreground">
              SSO is not configured.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={disabled}
              data-testid="saml-configure"
            >
              Configure SAML
            </Button>
          </div>
        )}
      </CardContent>

      <SamlConfigDialog
        tenantId={tenantId}
        open={dialogOpen}
        existing={config}
        onClose={() => setDialogOpen(false)}
        onSaved={(next) => {
          queryClient.setQueryData<TenantSamlConfig | null>(
            ["saml-config", tenantId],
            next,
          )
          setDialogOpen(false)
        }}
      />

      <Dialog
        open={confirmDisconnect}
        onOpenChange={(next) => {
          if (!next) setConfirmDisconnect(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect SAML SSO?</DialogTitle>
            <DialogDescription>
              Members will no longer be able to sign in with your identity
              provider. They'll need to use email + password until SSO is
              reconfigured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDisconnect(false)}
              disabled={disconnectMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
              data-testid="saml-confirm-disconnect"
            >
              {disconnectMut.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SamlConfigDialog({
  tenantId,
  open,
  existing,
  onClose,
  onSaved,
}: {
  tenantId: string
  open: boolean
  existing: TenantSamlConfig | null
  onClose: () => void
  onSaved: (next: TenantSamlConfig) => void
}) {
  const client = useApiClient()
  const [idpEntityId, setIdpEntityId] = useState("")
  const [idpSsoUrl, setIdpSsoUrl] = useState("")
  const [idpCertX509, setIdpCertX509] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [certError, setCertError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Sync the form state when the dialog opens (and on existing change so an
  // edit-then-reopen reflects the latest server snapshot).
  useEffect(() => {
    if (!open) return
    setIdpEntityId(existing?.idpEntityId ?? "")
    setIdpSsoUrl(existing?.idpSsoUrl ?? "")
    setIdpCertX509(existing?.idpCertX509 ?? "")
    setEnabled(existing?.enabled ?? true)
    setCertError(null)
    setGeneralError(null)
    setCopied(false)
  }, [open, existing])

  const metadataUrl = spMetadataUrl(tenantId)

  const saveMut = useMutation({
    mutationFn: () =>
      client.updateSamlConfig(tenantId, {
        idpEntityId: idpEntityId.trim(),
        idpSsoUrl: idpSsoUrl.trim(),
        idpCertX509: idpCertX509.trim(),
        enabled,
      }),
    onSuccess: (next) => {
      onSaved(next)
      toast.success("SAML SSO saved")
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 400) {
        // Surface the BE's bad-cert / bad-input message inline against the
        // cert field; that's the most common 400 cause for this endpoint.
        const msg =
          (typeof e.body === "string" && e.body) ||
          e.message ||
          "Invalid configuration"
        setCertError(msg)
        return
      }
      if (isApiError(e) && e.status === 403) {
        setGeneralError(
          "Only owners on the Agency plan can configure SAML SSO.",
        )
        return
      }
      setGeneralError("Could not save SAML config. Please try again.")
    },
  })

  const onSubmit = () => {
    setGeneralError(null)
    setCertError(null)
    if (!idpEntityId.trim() || !idpSsoUrl.trim() || !idpCertX509.trim()) {
      setGeneralError("All three IdP fields are required.")
      return
    }
    if (!PEM_HINT_RE.test(idpCertX509)) {
      setCertError(
        "Cert must be PEM-encoded and include the BEGIN CERTIFICATE header.",
      )
      return
    }
    saveMut.mutate()
  }

  const onCopyMetadata = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(metadataUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        return
      }
    } catch {
      // ignore; fall through to toast
    }
    toast.message("Copy the URL manually", { description: metadataUrl })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit SAML SSO" : "Configure SAML SSO"}
          </DialogTitle>
          <DialogDescription>
            Wrendex acts as the SAML Service Provider. Send the metadata URL
            below to your IdP admin, then enter the IdP-side details Wrendex
            needs to validate sign-in assertions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Step 1. SP metadata URL</Label>
            <p className="text-xs text-muted-foreground">
              Send this to your IdP admin to register Wrendex as a Service
              Provider.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={metadataUrl}
                className="font-mono text-xs"
                data-testid="saml-metadata-url"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onCopyMetadata}
                data-testid="saml-copy-metadata"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saml-idp-entity">Step 2. IdP entity id</Label>
            <Input
              id="saml-idp-entity"
              data-testid="saml-idp-entity"
              type="text"
              value={idpEntityId}
              onChange={(e) => setIdpEntityId(e.target.value)}
              placeholder="https://idp.example.com/entity"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saml-idp-sso">IdP SSO URL</Label>
            <Input
              id="saml-idp-sso"
              data-testid="saml-idp-sso"
              type="text"
              value={idpSsoUrl}
              onChange={(e) => setIdpSsoUrl(e.target.value)}
              placeholder="https://idp.example.com/sso"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saml-idp-cert">IdP X.509 certificate (PEM)</Label>
            <Textarea
              id="saml-idp-cert"
              data-testid="saml-idp-cert"
              rows={6}
              value={idpCertX509}
              onChange={(e) => {
                setIdpCertX509(e.target.value)
                setCertError(null)
              }}
              placeholder={
                "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
              }
              className="font-mono text-xs"
              aria-invalid={certError ? true : undefined}
            />
            {certError ? (
              <p className="text-xs text-destructive" data-testid="saml-cert-error">
                {certError}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="saml-enabled" className="text-sm">
                Enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                When off, members can't sign in with SSO but the config is
                preserved.
              </p>
            </div>
            <Switch
              id="saml-enabled"
              checked={enabled}
              onCheckedChange={(v) => setEnabled(Boolean(v))}
              data-testid="saml-enabled"
            />
          </div>

          {generalError ? (
            <Alert variant="destructive">
              <AlertDescription data-testid="saml-general-error">
                {generalError}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saveMut.isPending}
            data-testid="saml-submit"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function planAtLeast(plan: string | null | undefined, target: Plan): boolean {
  if (!plan) return false
  // Under the credit-based billing model every tenant gets every feature, so
  // this ordering is no longer meaningful. We keep the helper for callers
  // that still gate on plan tier and treat the live tier ("BASE") as
  // unlocking everything.
  const order: Record<string, number> = {
    BASE: 99,
    STARTER: 0,
    PROFESSIONAL: 1,
    AGENCY: 2,
  }
  return (order[plan] ?? -1) >= order[target]
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
        // 404 = not configured; 403 = plan-gated. Both surface as "no channel"
        // for the card; the disabled flag (driven by BillingSnapshot.plan)
        // is what surfaces the Pro plan only badge.
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
      return failureCount < 1
    },
  })

  // Local input state. We never receive the webhook URL back from the BE
  // (it's redacted as a secret), so we keep a separate draft string and rely
  // on `channelQ.data?.webhookUrlConfigured` to display the "Configured
  // (hidden)" placeholder.
  const [webhookUrl, setWebhookUrl] = useState("")
  const [error, setErrorMsg] = useState<string | null>(null)

  // Reset the draft whenever the server snapshot flips between configured
  // and not-configured (e.g. after Disconnect).
  useEffect(() => {
    setWebhookUrl("")
  }, [channelQ.data?.webhookUrlConfigured])

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
            placeholder={
              channelQ.data?.webhookUrlConfigured
                ? "Configured (hidden)"
                : "https://outlook.office.com/webhook/..."
            }
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
        // 404 = not configured; 403 = plan-gated. Both surface as "no channel"
        // for the card; the disabled flag (driven by BillingSnapshot.plan)
        // is what surfaces the Agency only badge.
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null
        throw e
      }
    },
    enabled: Boolean(tenantId),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 403)
      )
        return false
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
              channelQ.data?.integrationKeyConfigured
                ? "Configured (hidden)"
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
    // BE EmailChannel.kind is a free-form String at the model level; the FE
    // narrows it to the three shipped values via the EmailChannelKind union.
    setKind(channelQ.data.kind as EmailChannelKind)
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
  const [searchParams, setSearchParams] = useSearchParams()
  // The ShareButton "Manage all share links" affordance deep-links to
  // ?tab=sharing; sync the URL so refreshes preserve the active tab and
  // direct links land on the right pane.
  const initialTab = searchParams.get("tab") ?? "account"
  const [tab, setTab] = useState(initialTab)

  const onTabChange = (next: string) => {
    setTab(next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === "account") {
          params.delete("tab")
        } else {
          params.set("tab", next)
        }
        return params
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-4">
      <Toaster />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account, tenant, and per-site configuration.
        </p>
      </div>
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
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
          value="sharing"
          className={cn("mt-4")}
          data-testid="tab-sharing"
        >
          <SharingTab tenantId={tenantId} />
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
