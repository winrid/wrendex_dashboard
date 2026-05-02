// Public signup page. Plan section 0.3a + 2.0 (claim-aware variant).
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

import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
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

  if (auth.isAuthed) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await auth.signupWithOptionalClaim(values, claimToken)

      if (claimToken) {
        if (result.claim) {
          // Cosmetic pause on /a/{token}/claiming so the user sees the
          // transition; the route then forwards to the site overview.
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
