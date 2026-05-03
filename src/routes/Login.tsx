// Public login page. Plan section 0.3a + P4 iter 2 (2FA second-step).
//
// React Hook Form + Zod for client-side validation. On submit we call
// client.login() directly (rather than useAuth().login) so we can branch on
// the discriminated AuthLoginResponse: a `twoFactorRequired: true` shape
// keeps the session pending, swaps the form to the 6-digit code view, and
// never persists the short-lived pendingToken to localStorage. Once the
// user supplies the code we call login2fa({pendingToken, code}); on success
// the BE returns a real sessionToken which we then route through the auth
// provider so /api/me hydrates and downstream guards see the new session.
//
// ApiError(401) on the password step surfaces as an inline "invalid
// credentials" message; on the 2FA step it surfaces as "That code is
// incorrect." Any other failure surfaces as a generic retry hint - users
// should not be told whether the email exists.
//
// ?claimToken= handoff (plan section 2.0): when present, we call
// claimAnonymousCrawl after a successful login and route the user into
// the claimed site. Mirrors signupWithOptionalClaim's soft-failure
// handling: on claim error we toast and still complete the login by
// landing on the tenant's sites list.
//
// ?invite= handoff (plan section 14.2): same pattern. When the recipient
// of a tenant invitation clicks "Sign in" on the AcceptInvite page they
// land here with ?invite=<token>; on successful login we call
// acceptInvite(token) and navigate them into the joined tenant. Soft-fail
// the same way as the claim path: toast and route into the user's
// existing tenant when accept fails so they don't get stranded.

import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type { Me } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Toaster } from "@/components/ui/sonner"
import { ssoLoginUrl } from "@/lib/sso"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof schema>

function safeNext(raw: string | null): string {
  if (!raw) return "/"
  // Only allow same-origin paths; protect against an open redirect via ?next=.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/"
}

function describeClaimError(status: number): string {
  switch (status) {
    case 401:
      return "We couldn't link your audit - please try again from the audit page."
    case 403:
      return "You don't have access to claim this audit."
    case 404:
      return "Your free audit expired before we could link it."
    case 409:
      return "This audit has already been claimed by another account."
    default:
      return "We couldn't link your audit. You can rerun it from your dashboard."
  }
}

function describeInviteError(status: number): string {
  switch (status) {
    case 403:
      return "Only the invited email can accept this invitation."
    case 404:
      return "This invitation is no longer valid."
    case 410:
      return "This invitation has expired."
    case 409:
      return "This invitation has already been accepted."
    default:
      return "We couldn't accept that invitation. Please try again from the invite link."
  }
}

export function Login() {
  const auth = useAuth()
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get("next"))
  const claimToken = params.get("claimToken") ?? undefined
  const inviteToken = params.get("invite") ?? undefined
  const [serverError, setServerError] = useState<string | null>(null)

  // 2FA second-step state. When pendingToken is non-null the form swaps to
  // the code-entry view; the password is already validated server-side and
  // the only thing left is to prove the user has their TOTP device.
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [twoFactorMode, setTwoFactorMode] = useState<"totp" | "backup">("totp")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false)

  // SAML SSO modal state (P4 iter 4 FE-D). Click "Sign in with SSO" -> a
  // small dialog asks for the tenant id / workspace URL; on submit we
  // hard-navigate to the SP-initiated login endpoint. The IdP redirect
  // chain returns the browser to the dashboard root with #sessionToken=...,
  // which AuthProvider's bootstrap effect picks up.
  const [ssoOpen, setSsoOpen] = useState(false)
  const [ssoWorkspace, setSsoWorkspace] = useState("")
  const [ssoError, setSsoError] = useState<string | null>(null)

  // SSO not-implemented banner (Phase 4 deferral). The SAML protocol /login
  // and /acs routes 501 today; when the BE bounces the user back here it
  // appends ?error=saml-not-implemented so we can surface a friendly toast +
  // inline banner instead of a stale-page silence. Strip the param once
  // surfaced so a refresh doesn't re-toast.
  const [ssoNotAvailable, setSsoNotAvailable] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (url.searchParams.get("error") === "saml-not-implemented") {
      setSsoNotAvailable(true)
      toast.error(
        "SSO sign-in is not yet available; please use email + password while we finalise the SAML release.",
      )
      url.searchParams.delete("error")
      const next =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
        url.hash
      window.history.replaceState({}, "", next)
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  if (auth.isAuthed) {
    return <Navigate to={next} replace />
  }

  // Shared post-login routing: invite -> claim -> next. Used after both the
  // password-only path and the 2FA second-step path so the two flows behave
  // identically once a real session is in hand.
  const finishLogin = async (me: Me) => {
    if (inviteToken) {
      try {
        const accepted = await client.acceptInvite(inviteToken)
        navigate(`/t/${accepted.tenantId}/sites`, { replace: true })
        return
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0
        toast.error(describeInviteError(status))
        // Fall through; the user is signed in either way.
      }
    }

    if (claimToken) {
      const tenantId = me.activeTenantId ?? me.memberships[0]?.tenantId ?? null
      if (tenantId) {
        try {
          const claim = await client.claimAnonymousCrawl(claimToken, tenantId)
          navigate(`/t/${tenantId}/sites/${claim.siteId}`, { replace: true })
          return
        } catch (e) {
          const status = e instanceof ApiError ? e.status : 0
          toast.error(describeClaimError(status))
          navigate(`/t/${tenantId}/sites`, { replace: true })
          return
        }
      }
      // No active tenant - fall through to the next-redirect path; the
      // RootRedirect under RequireAuth will resolve a tenant.
    }

    navigate(next, { replace: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const res = await auth.login(values)
      if ("twoFactorRequired" in res && res.twoFactorRequired === true) {
        setPendingToken(res.pendingToken)
        setTwoFactorMode("totp")
        setTwoFactorCode("")
        setTwoFactorError(null)
        return
      }
      // Full session: res is a Me snapshot.
      await finishLogin(res as Me)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setServerError("Invalid email or password")
      } else {
        setServerError("Something went wrong. Please try again.")
      }
    }
  })

  // Parse the user-supplied workspace identifier into a tenant id. We
  // accept either a bare slug ("acme") or a workspace URL
  // ("https://acme.wrendex.com" / "https://audits.acme.com"). For the URL
  // case we treat the leading hostname label as the slug; the BE looks up
  // both by tenant id and slug so a slug works as a tenant id for the SP
  // login route.
  function parseWorkspace(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    // URL form
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed)
        const host = u.hostname
        const firstLabel = host.split(".")[0]
        if (firstLabel && firstLabel.length > 0) return firstLabel
        return null
      } catch {
        return null
      }
    }
    // Slug / tenant id form: keep alnum + dashes / underscores.
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null
    return trimmed
  }

  const submitSso = () => {
    setSsoError(null)
    const tenantId = parseWorkspace(ssoWorkspace)
    if (!tenantId) {
      setSsoError("Enter a workspace id or URL (e.g. acme).")
      return
    }
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/`
        : "/"
    if (typeof window !== "undefined") {
      window.location.href = ssoLoginUrl(tenantId, returnTo)
    }
  }

  const submitTwoFactor = async () => {
    if (!pendingToken) return
    setTwoFactorError(null)
    const trimmed = twoFactorCode.trim()
    if (!trimmed) {
      setTwoFactorError(
        twoFactorMode === "backup"
          ? "Enter your 8-character backup code."
          : "Enter your 6-digit code.",
      )
      return
    }
    setTwoFactorSubmitting(true)
    try {
      const me = await auth.login2fa({ pendingToken, code: trimmed })
      await finishLogin(me)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setTwoFactorError("That code is incorrect.")
      } else if (e instanceof ApiError && e.status === 410) {
        // The pending session expired (BE TTL elapsed). Bounce the user
        // back to the password step with a friendly message.
        setPendingToken(null)
        setServerError(
          "Your sign-in session expired. Please enter your password again.",
        )
      } else {
        setTwoFactorError("Something went wrong. Please try again.")
      }
    } finally {
      setTwoFactorSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {pendingToken
              ? "Two-factor authentication"
              : "Sign in to Wrendex"}
          </CardTitle>
          <CardDescription>
            {pendingToken
              ? twoFactorMode === "backup"
                ? "Enter one of your 8-character backup codes."
                : "Enter the 6-digit code from your authenticator app."
              : "Welcome back. Enter your credentials to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingToken ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void submitTwoFactor()
              }}
              noValidate
              data-testid="two-factor-form"
            >
              <div className="space-y-1.5">
                <Label htmlFor="two-factor-code">
                  {twoFactorMode === "backup" ? "Backup code" : "6-digit code"}
                </Label>
                <Input
                  id="two-factor-code"
                  data-testid="two-factor-code"
                  type="text"
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode={twoFactorMode === "backup" ? "text" : "numeric"}
                  pattern={
                    twoFactorMode === "backup"
                      ? "[A-Za-z0-9]{8}"
                      : "[0-9]{6}"
                  }
                  maxLength={twoFactorMode === "backup" ? 8 : 6}
                  value={twoFactorCode}
                  onChange={(e) => {
                    setTwoFactorCode(e.target.value)
                    setTwoFactorError(null)
                  }}
                  aria-invalid={twoFactorError ? true : undefined}
                />
                {twoFactorError ? (
                  <p
                    className="text-xs text-destructive"
                    data-testid="two-factor-error"
                  >
                    {twoFactorError}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={twoFactorSubmitting}
                data-testid="two-factor-submit"
              >
                {twoFactorSubmitting ? "Verifying..." : "Verify"}
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  setTwoFactorMode((m) => (m === "totp" ? "backup" : "totp"))
                  setTwoFactorCode("")
                  setTwoFactorError(null)
                }}
                data-testid="two-factor-toggle"
              >
                {twoFactorMode === "backup"
                  ? "Use your authenticator app instead"
                  : "Use a backup code instead"}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              {ssoNotAvailable ? (
                <Alert
                  variant="destructive"
                  data-testid="sso-not-implemented-banner"
                >
                  <AlertDescription>
                    SSO sign-in is not yet available; please use email +
                    password while we finalise the SAML release.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>
              {serverError ? (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSsoError(null)
                  setSsoOpen(true)
                }}
                data-testid="sso-open"
              >
                Sign in with SSO
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="underline hover:text-foreground">
                  Create one
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={ssoOpen}
        onOpenChange={(next) => {
          setSsoOpen(next)
          if (!next) {
            setSsoError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in with SSO</DialogTitle>
            <DialogDescription>
              Enter your workspace id or URL. We'll redirect you to your
              identity provider to complete sign-in.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              submitSso()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="sso-workspace">Workspace</Label>
              <Input
                id="sso-workspace"
                data-testid="sso-workspace"
                type="text"
                autoFocus
                placeholder="acme or https://audits.acme.com"
                value={ssoWorkspace}
                onChange={(e) => {
                  setSsoWorkspace(e.target.value)
                  setSsoError(null)
                }}
                aria-invalid={ssoError ? true : undefined}
              />
              {ssoError ? (
                <p
                  className="text-xs text-destructive"
                  data-testid="sso-error"
                >
                  {ssoError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSsoOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="sso-submit">
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
