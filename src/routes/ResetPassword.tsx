// Public reset-password page. Plan section 0.3a.
//
// Reads the reset token from ?token=...; on a 400 we surface the
// standard "invalid or expired" inline message and let the user request
// a fresh link. On 204 we toast and bounce them to /login.

import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
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

const schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

type ResetValues = z.infer<typeof schema>

export function ResetPassword() {
  const client = useApiClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token")
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setServerError("This reset link is invalid or has expired")
      return
    }
    setServerError(null)
    try {
      await client.confirmPasswordReset({ token, newPassword: values.newPassword })
      toast.success("Password updated. Please sign in.")
      navigate("/login", { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setServerError("This reset link is invalid or has expired")
      } else {
        setServerError("Something went wrong. Please try again.")
      }
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            Pick something at least 8 characters long.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="underline hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
