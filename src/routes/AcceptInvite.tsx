// Accept-invite landing route (plan section 14.2; phase 3 iter 1 FE).
// Public; the route mounts above RequireAuth so unauthenticated recipients
// can read the invite preview before they sign in / sign up.
//
// The page reads ?token=... from the search params and dispatches into one
// of five terminal states based on the BE response + the current auth state:
//
//   1. 404 -> "This invitation link is invalid."
//   2. 410 -> "This invitation has expired."
//   3. 409 -> "This invitation has already been accepted."
//   4. 200 + signed-out -> sign-in prompt with deep-links into /login and
//      /signup that round-trip the token.
//   5. 200 + signed-in but email mismatch -> sign-out prompt.
//   6. 200 + signed-in + email match -> Accept button. On accept we call
//      acceptInvite(token) and route into /t/{tenantId}/sites.

import { useState } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type { InvitePublicView } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Toaster />
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  )
}

export function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useApiClient()
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const inviteQ = useQuery<InvitePublicView | null>({
    queryKey: ["public-invite", token],
    queryFn: async () => {
      try {
        return await client.getPublicInvite(token)
      } catch (e) {
        // Surface the ApiError directly so the render path can branch on
        // status; react-query's error slot keeps the typed instance.
        throw e
      }
    },
    enabled: token.length > 0,
    retry: (count, e) => {
      if (e instanceof ApiError && [404, 409, 410].includes(e.status)) {
        return false
      }
      return count < 1
    },
  })

  const acceptMut = useMutation({
    mutationFn: () => client.acceptInvite(token),
    onSuccess: (resp) => {
      toast.success("Invitation accepted")
      navigate(`/t/${resp.tenantId}/sites`, { replace: true })
    },
    onError: (e) => {
      if (isApiError(e)) {
        if (e.status === 410) {
          setAcceptError("This invitation has expired.")
          return
        }
        if (e.status === 409) {
          setAcceptError("This invitation has already been accepted.")
          return
        }
        if (e.status === 403) {
          setAcceptError(
            "Only the invited email can accept this invitation.",
          )
          return
        }
      }
      setAcceptError("Could not accept invitation. Please try again.")
    },
  })

  if (token.length === 0) {
    return <Navigate to="/" replace />
  }

  if (inviteQ.isLoading || (auth.isLoading && !inviteQ.data)) {
    return (
      <CenterCard>
        <CardHeader>
          <CardTitle>Loading invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">One moment...</p>
        </CardContent>
      </CenterCard>
    )
  }

  if (inviteQ.isError) {
    const err = inviteQ.error
    const status = err instanceof ApiError ? err.status : 0
    let title = "Could not load invitation"
    let body = "We couldn't load this invitation. Please try again."
    if (status === 404) {
      title = "Invitation not found"
      body = "This invitation link is invalid."
    } else if (status === 410) {
      title = "Invitation expired"
      body = "This invitation has expired."
    } else if (status === 409) {
      title = "Already accepted"
      body = "This invitation has already been accepted."
    }
    return (
      <CenterCard>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground" data-testid="invite-error-body">
            {body}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go to dashboard</Link>
          </Button>
        </CardContent>
      </CenterCard>
    )
  }

  const invite = inviteQ.data
  if (!invite) {
    return (
      <CenterCard>
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We couldn't load this invitation.
          </p>
        </CardContent>
      </CenterCard>
    )
  }

  // Branch 4: signed-out.
  if (!auth.isAuthed) {
    const signInTo = `/login?invite=${encodeURIComponent(token)}`
    const signUpTo = `/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}`
    return (
      <CenterCard>
        <CardHeader>
          <CardTitle>Join {invite.tenantName}</CardTitle>
          <CardDescription>
            {invite.invitedByEmail} invited you to join as{" "}
            <span className="font-medium">{invite.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className="text-sm text-muted-foreground"
            data-testid="invite-signin-prompt"
          >
            Sign in to accept this invitation as{" "}
            <span className="font-medium">{invite.email}</span>.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to={signInTo}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to={signUpTo}>Create account</Link>
            </Button>
          </div>
        </CardContent>
      </CenterCard>
    )
  }

  // Branch 5: signed in but email mismatch.
  const signedInEmail = auth.user?.email ?? ""
  if (signedInEmail.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <CenterCard>
        <CardHeader>
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            You're signed in as{" "}
            <span className="font-medium">{signedInEmail}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className="text-sm text-muted-foreground"
            data-testid="invite-email-mismatch"
          >
            This invitation was sent to{" "}
            <span className="font-medium">{invite.email}</span>. Sign out and
            sign in with that account to accept.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              auth.logout()
              navigate(
                `/login?invite=${encodeURIComponent(token)}`,
                { replace: true },
              )
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </CenterCard>
    )
  }

  // Branch 6: signed in + email matches.
  return (
    <CenterCard>
      <CardHeader>
        <CardTitle>Accept the invitation to join {invite.tenantName}</CardTitle>
        <CardDescription>
          You'll join as <span className="font-medium">{invite.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Invited by {invite.invitedByEmail}.
        </p>
        {acceptError ? (
          <p className="text-xs text-destructive" data-testid="invite-accept-error">
            {acceptError}
          </p>
        ) : null}
        <Button
          onClick={() => {
            setAcceptError(null)
            acceptMut.mutate()
          }}
          disabled={acceptMut.isPending}
          data-testid="invite-accept-button"
        >
          {acceptMut.isPending ? "Accepting..." : "Accept invitation"}
        </Button>
      </CardContent>
    </CenterCard>
  )
}
