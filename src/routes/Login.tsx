// Public login page. Plan section 0.3a.
//
// React Hook Form + Zod for client-side validation. On submit we delegate
// to useAuth().login(); the AuthProvider hydrates /api/me and exposes the
// new session before we navigate. ApiError(401) surfaces as an inline
// "invalid credentials" message; any other failure surfaces as a generic
// retry hint - users should not be told whether the email exists.
//
// ?claimToken= handoff (plan section 2.0): when present, we call
// claimAnonymousCrawl after a successful login and route the user into
// the claimed site. Mirrors signupWithOptionalClaim's soft-failure
// handling: on claim error we toast and still complete the login by
// landing on the tenant's sites list.

import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useState } from "react"
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

export function Login() {
  const auth = useAuth()
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get("next"))
  const claimToken = params.get("claimToken") ?? undefined
  const [serverError, setServerError] = useState<string | null>(null)

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

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const me = await auth.login(values)

      // If the user arrived from the anonymous-crawl teaser, link the audit
      // into their tenant before routing. Mirrors signupWithOptionalClaim's
      // soft-failure handling: on any error we toast + still land them in
      // their workspace.
      if (claimToken) {
        const tenantId = me.activeTenantId ?? me.memberships[0]?.tenantId ?? null
        if (tenantId) {
          try {
            const claim = await client.claimAnonymousCrawl(
              claimToken,
              tenantId,
            )
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
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setServerError("Invalid email or password")
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
          <CardTitle>Sign in to Wrendex</CardTitle>
          <CardDescription>
            Welcome back. Enter your credentials to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
            <p className="text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="underline hover:text-foreground">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
