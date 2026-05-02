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
// Trial-start (Phase 1.5 fallback path until the BE SetupIntent endpoint
// ships and we can capture the card pre-signup):
//   After signupWithOptionalClaim succeeds AND the claim mutation lands,
//   we automatically call createCheckoutSession and window.location.href
//   to the Stripe Checkout URL with trialDays=14. If the call fails (e.g.
//   in dev where Stripe isn't configured), we soft-fail with a toast and
//   the user can still kick off their trial from /billing later.
//
// Stripe Elements (plan section 1.2 step 3 - SCAFFOLDING ONLY):
//   When claimToken is present, the PaymentMethodScaffolding card renders
//   a small "we'll redirect after signup" notice. Once the BE ships
//   SetupIntent + customer-creation ahead of signup, this branch flips to
//   render PaymentElement against the returned client_secret.

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
          tenantId: pendingTenantIdRef.current,
          userId: auth.user?.id,
        },
      },
    ])
  }

  // We capture the freshly-created tenantId so the signup_completed event can
  // tag it before the AuthProvider's /api/me hydration lands in the React
  // tree (the route is already navigating away by then).
  const pendingTenantIdRef = useRef<string | undefined>(undefined)

  // After signup completes + the anonymous-crawl claim succeeds, redirect
  // the user into a Stripe Checkout session with trialDays=14. This is the
  // Phase 1.5 fallback path until the BE SetupIntent endpoint ships and we
  // can capture the card pre-signup. We can't actually verify the user
  // completed Stripe Checkout from here, but recording the intent in the
  // signup_completed event is enough for the funnel until then.
  //
  // Returns true on success (the page is redirecting; the caller should
  // not also SPA-navigate). Returns false on soft failure (Stripe is
  // unavailable in dev, the BE returned a non-2xx, etc.) so the caller
  // can fall through to the site-overview navigation + toast.
  const startTrialCheckout = async (
    tenantId: string,
    siteId: string,
  ): Promise<boolean> => {
    try {
      const session = await client.createCheckoutSession(tenantId, {
        priceTier: "PROFESSIONAL",
        returnUrl:
          window.location.origin + `/t/${tenantId}/sites/${siteId}`,
        trialDays: 14,
      })
      toast.success("Starting your 14-day trial...")
      window.location.href = session.url
      return true
    } catch {
      return false
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await auth.signupWithOptionalClaim(values, claimToken)
      pendingTenantIdRef.current = result.tenantId

      if (claimToken) {
        if (result.claim) {
          // Kick off the trial checkout. On success the browser is already
          // navigating to Stripe; on soft failure we land on the site
          // overview and toast a hint about Settings -> Billing.
          const checkoutOk = await startTrialCheckout(
            result.tenantId,
            result.claim.siteId,
          )
          fireSignupCompleted(checkoutOk)
          if (checkoutOk) {
            return
          }
          toast.message(
            "Trial is not active yet. Add a card from Settings -> Billing to start your 14-day trial.",
          )
          navigate(
            `/t/${result.tenantId}/sites/${result.claim.siteId}`,
            { replace: true },
          )
          return
        }
        // Claim soft-fail: the user is signed in and the tenant exists; we
        // bounce into the workspace and surface the claim error message.
        // We don't fire trial checkout here because there's no canonical
        // siteId to land on after Stripe.
        fireSignupCompleted(false)
        toast.error(describeClaimError(result.claimError?.status ?? 0))
        navigate(`/t/${result.tenantId}/sites`, { replace: true })
        return
      }

      // PATH B (no claim token): the trial CTA lives on /billing, not here.
      fireSignupCompleted(false)
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
// expose a SetupIntent endpoint yet, so we can't capture the card before
// signup completes. As the Phase 1.5 fallback we redirect the user into
// Stripe Checkout immediately AFTER the signup + claim land. Once the BE
// ships SetupIntent + customer-creation pre-signup, swap this for an
// Elements provider + a PaymentElement bound to the returned client_secret;
// see AGENTS.md "Phase 1.5 deferrals".
function PaymentMethodScaffolding() {
  return (
    <div
      className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
      data-testid="payment-redirect-note"
    >
      <p className="font-medium">Payment</p>
      <p className="mt-1 text-muted-foreground">
        We&apos;ll redirect you to a secure card capture step after signup
        to start your 14-day trial.
      </p>
    </div>
  )
}
