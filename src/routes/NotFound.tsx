// 404 catch-all. Mounted twice in the router: once under the public layout
// for unauthenticated/anonymous URLs, once under AppShell for unmatched
// /t/:tenantId/... routes so the sidebar stays around. Reads useParams to
// detect a tenant in the URL; if present, the CTA points back at the user's
// sites list. Otherwise falls back to /.
//
// Visually mirrors the empty-state pattern (wren mark above text, muted) so
// 404s feel like part of the dashboard, not a stack trace from React Router.

import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { WrenMark } from "@/components/brand/WrenMark"

export function NotFound() {
  const { tenantId } = useParams<{ tenantId?: string }>()
  const home = tenantId ? `/t/${tenantId}/sites` : "/"
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <WrenMark className="size-16 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold tracking-tight">
          That page flew the coop
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We could not find anything at this URL. It may have moved, or you
          may have followed an old link.
        </p>
      </div>
      <Button asChild size="sm">
        <Link to={home}>{tenantId ? "Back to your sites" : "Back home"}</Link>
      </Button>
    </div>
  )
}
