// Public URL-paste landing page (plan section 2.0 + 1.1 PATH A step 1).
// This is the primary onboarding funnel. Visitors land here from the
// marketing hero with ?url=<encoded url> already prefilled, or from a
// direct nav. Submitting the form posts to /api/anonymous-crawls and
// navigates to /a/{token} where the teaser page polls until the crawl
// completes.
//
// Lives above the RequireAuth guard in router.tsx.

import { useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import { isRateLimitError } from "@/api/client"
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

// Zod schema: must start with http:// or https:// and parse as a URL.
// We allow the marketing hero to pass either a bare hostname or a full
// URL via ?url=...; the hero handler normalises before redirecting.
const schema = z.object({
  url: z
    .string()
    .min(1, "Enter a URL to audit")
    .regex(/^https?:\/\//i, "URL must start with http:// or https://")
    .refine((value) => {
      try {
        const u = new URL(value)
        return Boolean(u.hostname)
      } catch {
        return false
      }
    }, "Enter a valid URL"),
})

type AuditValues = z.infer<typeof schema>

function formatRetry(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
}

export function Audit() {
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetUrl = params.get("url") ?? ""

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AuditValues>({
    resolver: zodResolver(schema),
    defaultValues: { url: presetUrl },
  })

  // Sync ?url=... -> form whenever it changes (e.g. user lands again
  // after a 410 expired-bounce that re-passes the original url).
  useEffect(() => {
    if (presetUrl) setValue("url", presetUrl)
  }, [presetUrl, setValue])

  const startMut = useMutation({
    mutationFn: (values: AuditValues) =>
      client.startAnonymousCrawl({ url: values.url }),
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await startMut.mutateAsync(values)
      navigate(`/a/${res.token}`)
    } catch {
      // surfaced via startMut.error below
    }
  })

  const rateLimitMsg = (() => {
    const err = startMut.error
    if (!err) return null
    if (isRateLimitError(err)) {
      return `Too many free audits from this network. Try again in ${formatRetry(
        err.retryAfterSeconds,
      )}.`
    }
    return "Could not start the audit. Please try again."
  })()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Run a free site audit</CardTitle>
          <CardDescription>
            Paste any URL. We will crawl it, score it, and show you the top
            issues hurting your search rankings. No account required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="url">Site URL</Label>
              <Input
                id="url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                aria-invalid={errors.url ? true : undefined}
                {...register("url")}
              />
              {errors.url ? (
                <p className="text-xs text-destructive">{errors.url.message}</p>
              ) : null}
            </div>
            {rateLimitMsg ? (
              <Alert variant="destructive">
                <AlertDescription>{rateLimitMsg}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || startMut.isPending}
            >
              {startMut.isPending ? "Starting audit..." : "Run free audit"}
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
