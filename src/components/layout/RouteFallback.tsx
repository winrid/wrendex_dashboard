// Suspense fallback for lazy-loaded routes (P5 iter 1 FE-A code-splitting).
// Renders a small centred shadcn skeleton matching the AppShell content area;
// the lazy chunk for the destination route loads behind it on navigation.
//
// Used by:
//   - <AppShell />'s <Suspense> wrapper around <Outlet />.
//   - The top-level public route Suspense fallback in router.tsx.

import { Skeleton } from "@/components/ui/skeleton"

export function RouteFallback() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="route-fallback"
    >
      <span className="sr-only">Loading...</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
