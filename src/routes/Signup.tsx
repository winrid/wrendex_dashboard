// Public signup page. Plan section 0.3a + 2.0 (claim-aware variant) +
// 1.2 step 3 (Stripe Elements scaffolding).
//
// Creates the user, the user's first tenant (the workspace they're
// signing up under), and seats them as OWNER in a single backend call.
// On 201 we navigate to "/", which is gated by RequireAuth and resolves
// the active tenant from the freshly-fetched /api/me payload.
//
// Anonymous-claim flow (plan section 2.0): when ?claimToken=... is
// present we prefill the workspace name from suggestedTenant, then after
// signup we call client.claimAnonymousCrawl through the AuthProvider
// helper. On success we route through /a/{token}/claiming (cosmetic
// pause) and into the new site overview. On failure we toast the error
// and route into the tenant's sites list anyway - the user is signed in
// and the workspace exists, the crawl just didn't link.
//
// Stripe Elements (plan section 1.2 step 3 - SCAFFOLDING ONLY):
//   When claimToken is present, an extra "Add payment method" step
//   surfaces between the basic-info form and the redirect. The step
//   tries client.createSetupIntent(tenantId); the BE doesn't expose that
//   endpoint yet, so the stub returns null and we render a "Skip card
//   capture" path. Once the BE ships SetupIntent + customer-creation
//   ahead of signup, this branch flips to render PaymentElement against
//   the returned client_secret.

import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Toaster } from "@/components/ui/sonner"

const PENDING_PAYMENT_METHOD_KEY = "wrendex.pendingPaymentMethodId"

function readPendingPaymentMethod(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(PENDING_PAYMENT_METHOD_KEY)
  } catch {
    return null
  }
}

function clearPendingPaymentMethod(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(PENDING_PAYMENT_METHOD_KEY)
  } catch {
    // ignore
  }
}

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  tenantName: z.string().min(1, "Workspace name is required"),
})

type SignupValues = z.infer<typeof schema>

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

export function Signup() {
  const auth = useAuth()
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const claimToken = params.get("claimToken") ?? undefined
  const suggestedTenant = params.get("suggestedTenant") ?? undefined
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      tenantName: suggestedTenant ?? "",
    },
  })

  // Funnel telemetry: signup_started fires once on mount when the user is
  // arriving from the anonymous funnel (claimToken present). Plan sec 16.
  const fireRef = useRef(false)
  useEffect(() => {
    if (fireRef.current) return
    if (!claimToken) return
    fireRef.current = true
    void client.sendTelemetry([
      {
        event: "signup_started",
        properties: { claimToken },
      },
    ])
  }, [claimToken, client])

  if (auth.isAuthed) {
    return <Navigate to="/" replace />
  }

  const fireSignupCompleted = (hasCardCaptured: boolean) => {
    void client.sendTelemetry([
      {
        event: "signup_completed",
        properties: {
          hasClaimToken: Boolean(claimToken),
          hasCardCaptured,
        },
      },
    ])
  }

  // After signup, if the SetupIntent flow succeeded earlier and persisted a
  // payment method, kick off the trial subscription via createCheckoutSession
  // (Phase 1.5: the BE currently builds a Checkout flow that lifts the card
  // again; once the BE wires SetupIntent + subscription start, we'll swap
  // this for a single API call).
  const maybeStartTrialFromPendingPm = async (tenantId: string) => {
    const pending = readPendingPaymentMethod()
    if (!pending) return
    try {
      clearPendingPaymentMethod()
      const session = await client.createCheckoutSession(tenantId, {
        priceTier: "PROFESSIONAL",
        returnUrl: window.location.origin + `/t/${tenantId}/billing`,
        trialDays: 14,
      })
      toast.success("Starting your 14-day trial...")
      window.location.href = session.url
    } catch {
      // Soft failure: the user is signed in and the tenant exists; surface a
      // toast and let them start the trial from /billing later.
      toast.message(
        "Signed in. Start your trial from the Billing page when you're ready.",
      )
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await auth.signupWithOptionalClaim(values, claimToken)
      const hasCardCaptured = readPendingPaymentMethod() != null
      fireSignupCompleted(hasCardCaptured)

      if (claimToken) {
        if (result.claim) {
          // If the user had captured a card before submitting, kick off the
          // trial checkout in the background. We don't await it here so
          // the route change isn't blocked on the (best-effort) Stripe
          // call; if the call succeeds it sets window.location.href which
          // will preempt the SPA navigate.
          void maybeStartTrialFromPendingPm(result.tenantId)
          navigate(
            `/a/${encodeURIComponent(claimToken)}/claiming?tenantId=${
              result.tenantId
            }&siteId=${result.claim.siteId}`,
            { replace: true },
          )
          return
        }
        // Soft failure: the user is signed in and the tenant exists; surface
        // the message and bounce them into the workspace.
        toast.error(describeClaimError(result.claimError?.status ?? 0))
        navigate(`/t/${result.tenantId}/sites`, { replace: true })
        return
      }

      navigate("/", { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setServerError("An account with this email already exists")
      } else {
        setServerError("Something went wrong. Please try again.")
      }
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your Wrendex account</CardTitle>
          <CardDescription>
            We&apos;ll spin up a workspace for you in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {claimToken ? (
            <p
              data-testid="claim-note"
              className="mb-4 rounded-md border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
            >
              Your free audit will be linked to this account.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenantName">Workspace name</Label>
              <Input
                id="tenantName"
                type="text"
                autoComplete="organization"
                placeholder="Acme Corp"
                aria-invalid={errors.tenantName ? true : undefined}
                {...register("tenantName")}
              />
              {errors.tenantName ? (
                <p className="text-xs text-destructive">
                  {errors.tenantName.message}
                </p>
              ) : null}
            </div>
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            {claimToken ? <PaymentMethodScaffolding /> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="underline hover:text-foreground">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Stripe Elements scaffolding (plan section 1.2 step 3). The BE doesn't
// expose a SetupIntent endpoint yet (see client.ts createSetupIntent), so
// for now this renders the "Skip card capture" path with a small note. When
// the BE ships, swap the early-return for an Elements provider + a
// PaymentElement bound to the returned client_secret. On submit, persist
// the payment method id to localStorage under wrendex.pendingPaymentMethodId
// so the post-signup branch can start the trial subscription.
function PaymentMethodScaffolding() {
  const client = useApiClient()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // The tenantId is unknown until signup completes, so we pass an
        // empty string here; the stub ignores it and the real BE call will
        // accept either a tenantId-or-null variant once it ships. The
        // returned null is the documented Phase 1.5 deferral.
        const res = await client.createSetupIntent("")
        if (cancelled) return
        setClientSecret(res?.clientSecret ?? null)
      } catch {
        if (!cancelled) setClientSecret(null)
      } finally {
        if (!cancelled) setResolved(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  if (!resolved) {
    return (
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Loading payment options...
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div
        className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
        data-testid="skip-card-capture"
      >
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="font-medium underline hover:text-foreground"
        >
          Skip card capture for now
        </a>
        <p className="mt-1 text-muted-foreground">
          We&apos;ll ask for your card when you start a paid plan.
        </p>
      </div>
    )
  }

  // BE wired path: render PaymentElement here. Left as a marker so the
  // wiring is visible without pulling Stripe SDK code into a path the BE
  // can't satisfy yet. See AGENTS.md for the Phase 1.5 deferral note.
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Card capture is ready. (Stripe Elements wiring lands once the BE
      SetupIntent endpoint ships.)
    </div>
  )
}
