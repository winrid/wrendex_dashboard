// Route guard for authenticated routes. Reads useAuth(); if we're still
// hydrating the stored token, render a skeleton; if the user is not
// authenticated, redirect to /login carrying the original path so the
// login page can bounce them back after a successful sign-in.

import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "./AuthProvider"

export type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, isAuthed } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
      </div>
    )
  }

  if (!isAuthed) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <>{children}</>
}
