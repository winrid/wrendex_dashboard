// Public signup page. Plan section 0.3a + 2.0 (claim-aware variant) +
// 1.2 step 3 (Stripe Elements pre-trial card capture).
//
// Creates the user, the user's first tenant (the workspace they're
// signing up under), and seats them as OWNER in a single backend call.
// On 201 we navigate to "/", which is gated by RequireAuth and resolves
// the active tenant from the freshly-fetched /api/me payload.
//
// Anonymous-claim flow (plan section 2.0): when ?claimToken=... is
// present we prefill the workspace name from suggestedTenant, then after
// signup we call client.claimAnonymousCrawl through the AuthProvider
// helper. On success we route into the per-claim card-capture step
// (Stripe Elements PaymentElement bound to a real SetupIntent
// client_secret); on confirm we kick off the trial subscription via
// createCheckoutSession and redirect.
//
// Trial-start (now real, BE iter 2 round 1):
//   - After signupWithOptionalClaim succeeds we call createSetupIntent
//     against the freshly-created tenantId. The BE returns a real Stripe
//     SetupIntent client_secret.
//   - We render Stripe Elements + PaymentElement, the user pastes a card,
//     and we confirmSetup. On success Stripe persists the payment method
//     against the customer.
//   - We then call createCheckoutSession with priceTier=PROFESSIONAL +
//     trialDays=14 to spin up the trial subscription, and window.location
//     to the returned Checkout URL.
//   - "Skip card capture" link is preserved so users can defer.

import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type { ApiClient } from "@/api/client"
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

/** localStorage key the post-signup branch reads to associate a captured
 *  payment method id with the freshly-created tenant. */
const PENDING_PM_KEY = "wrendex.pendingPaymentMethodId"

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

/** Lazy singleton: load the Stripe.js publishable key once per page. Returns
 *  null when no key is configured (dev / tests) so the caller can fall back
 *  to the no-card path without throwing. */
let stripePromise: Promise<Stripe | null> | null = null
function getStripePromise(): Promise<Stripe | null> | null {
  if (stripePromise) return stripePromise
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (typeof key !== "string" || key.length === 0) return null
  stripePromise = loadStripe(key)
  return stripePromise
}

type PendingCapture = {
  tenantId: string
  siteId: string | null
  clientSecret: string
}

export function Signup() {
  const auth = useAuth()
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const claimToken = params.get("claimToken") ?? undefined
  const suggestedTenant = params.get("suggestedTenant") ?? undefined
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(
    null,
  )

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

  if (auth.isAuthed && !pendingCapture) {
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

  const pendingTenantIdRef = useRef<string | undefined>(undefined)

  // Trial-start: now uses real Stripe Elements + SetupIntent. After the user
  // confirms the card with Stripe, we kick off a checkout session that
  // creates the trial subscription, and the browser navigates to it. The
  // PaymentElement-confirm route persists the captured payment method id
  // under the wrendex.pendingPaymentMethodId localStorage key so a future
  // /billing visit can attach it if checkout fails partway through.
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

  /** Skip-card-capture branch. Drops the user into the workspace + a hint
   *  toast about Settings -> Billing. */
  const finishWithoutCard = (tenantId: string, siteId: string | null) => {
    fireSignupCompleted(false)
    toast.message(
      "Trial is not active yet. Add a card from Settings -> Billing to start your 14-day trial.",
    )
    navigate(
      siteId ? `/t/${tenantId}/sites/${siteId}` : `/t/${tenantId}/sites`,
      { replace: true },
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await auth.signupWithOptionalClaim(values, claimToken)
      pendingTenantIdRef.current = result.tenantId

      // Fast-path B (no claim token): legacy behaviour - no inline card
      // capture, the trial CTA is on /billing.
      if (!claimToken) {
        fireSignupCompleted(false)
        navigate("/", { replace: true })
        return
      }

      const siteId = result.claim?.siteId ?? null

      // Surface claim soft-fail before attempting card capture (no canonical
      // site to land on; user is already signed in).
      if (!result.claim) {
        fireSignupCompleted(false)
        toast.error(describeClaimError(result.claimError?.status ?? 0))
        navigate(`/t/${result.tenantId}/sites`, { replace: true })
        return
      }

      // Try to mount Stripe Elements. If we can't (no publishable key, or
      // the SetupIntent call fails), fall back to the legacy redirect-to-
      // Checkout path so the trial still starts.
      const stripeP = getStripePromise()
      if (!stripeP) {
        const ok = await startTrialCheckout(result.tenantId, siteId!)
        fireSignupCompleted(ok)
        if (ok) return
        finishWithoutCard(result.tenantId, siteId)
        return
      }

      try {
        const intent = await client.createSetupIntent(result.tenantId)
        if (!intent?.clientSecret) {
          // Defensive: BE returned a 200 with no secret. Treat as soft fail.
          throw new Error("Missing clientSecret")
        }
        setPendingCapture({
          tenantId: result.tenantId,
          siteId,
          clientSecret: intent.clientSecret,
        })
      } catch {
        const ok = await startTrialCheckout(result.tenantId, siteId!)
        fireSignupCompleted(ok)
        if (ok) return
        finishWithoutCard(result.tenantId, siteId)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setServerError("An account with this email already exists")
      } else {
        setServerError("Something went wrong. Please try again.")
      }
    }
  })

  // ---- Step 2 view: PaymentElement bound to the SetupIntent ----
  if (pendingCapture) {
    const stripeP = getStripePromise()
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Toaster />
        <Card className="w-full max-w-md" data-testid="card-capture-card">
          <CardHeader>
            <CardTitle>Start your 14-day trial</CardTitle>
            <CardDescription>
              Add a card to begin your trial. You won&apos;t be charged
              today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeP ? (
              <Elements
                stripe={stripeP}
                options={{ clientSecret: pendingCapture.clientSecret }}
              >
                <PaymentCaptureForm
                  capture={pendingCapture}
                  client={client}
                  onSuccess={(ok) => {
                    fireSignupCompleted(ok)
                  }}
                  onSkip={() =>
                    finishWithoutCard(
                      pendingCapture.tenantId,
                      pendingCapture.siteId,
                    )
                  }
                  startTrialCheckout={startTrialCheckout}
                />
              </Elements>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Stripe is not configured in this environment.
                </p>
                <Button
                  type="button"
                  onClick={() =>
                    finishWithoutCard(
                      pendingCapture.tenantId,
                      pendingCapture.siteId,
                    )
                  }
                >
                  Continue to dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

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

            {claimToken ? <PaymentCaptureNotice /> : null}

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

// Stripe Elements payment notice (plan section 1.2 step 3). When claimToken
// is present, the post-signup branch creates a real SetupIntent against the
// freshly-created tenant and renders the PaymentElement on the next step.
// This card is the leading "what to expect" hint while the user fills out
// the email/password form.
function PaymentCaptureNotice() {
  return (
    <div
      className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
      data-testid="payment-redirect-note"
    >
      <p className="font-medium">Payment</p>
      <p className="mt-1 text-muted-foreground">
        After you create your account we&apos;ll capture a card so we can
        start your 14-day trial. You won&apos;t be charged today.
      </p>
    </div>
  )
}

// PaymentCaptureForm: rendered inside <Elements>. Uses the Stripe.js + Stripe
// React SDK to confirm the SetupIntent client_secret, persists the resulting
// payment method id to localStorage (so /billing can attach it if checkout
// fails), and finally redirects to a checkout session that opens the trial.
function PaymentCaptureForm({
  capture,
  client,
  onSuccess,
  onSkip,
  startTrialCheckout,
}: {
  capture: PendingCapture
  client: ApiClient
  onSuccess: (cardCaptured: boolean) => void
  onSkip: () => void
  startTrialCheckout: (tenantId: string, siteId: string) => Promise<boolean>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const returnUrl = useMemo(() => {
    const fallback = capture.siteId
      ? `/t/${capture.tenantId}/sites/${capture.siteId}`
      : `/t/${capture.tenantId}/sites`
    return window.location.origin + fallback + `?cardCapture=ok`
  }, [capture])

  const onConfirm = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      })
      if (result.error) {
        setError(result.error.message ?? "Could not confirm card")
        setSubmitting(false)
        return
      }
      // Persist the payment method id so a follow-up /billing visit can
      // surface it if anything goes wrong with the checkout step below.
      const pm = result.setupIntent?.payment_method
      if (typeof pm === "string") {
        try {
          window.localStorage.setItem(PENDING_PM_KEY, pm)
        } catch {
          // ignore - storage may be unavailable
        }
      } else if (pm && typeof pm === "object" && "id" in pm) {
        try {
          window.localStorage.setItem(
            PENDING_PM_KEY,
            (pm as { id: string }).id,
          )
        } catch {
          // ignore
        }
      }
      // Kick off the trial checkout.
      if (capture.siteId) {
        const ok = await startTrialCheckout(capture.tenantId, capture.siteId)
        onSuccess(ok)
        if (ok) return
      }
      // If we got here, checkout failed (or we have no siteId). Land in the
      // workspace and let /billing handle the trial start.
      onSuccess(true)
      navigate(
        capture.siteId
          ? `/t/${capture.tenantId}/sites/${capture.siteId}`
          : `/t/${capture.tenantId}/sites`,
        { replace: true },
      )
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not confirm card",
      )
      setSubmitting(false)
    }
  }

  // Reference the typed client to keep the prop fixed for tests / future
  // attach calls. The current confirmation flow does not directly use the
  // client - the SetupIntent is opaque to FE - but keeping the dependency
  // pinned makes the component's contract explicit.
  void client

  return (
    <div className="space-y-4" data-testid="payment-element-form">
      <PaymentElement />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={submitting || !stripe || !elements}
        >
          {submitting ? "Confirming..." : "Add card and start trial"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Skip card capture for now
        </Button>
      </div>
    </div>
  )
}
