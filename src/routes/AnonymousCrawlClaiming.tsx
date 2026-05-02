// Brief loading view shown post-signup while the claim mutation runs and
// before we hop the user into their tenant. Plan section 1.1 PATH A step 4.
//
// The actual claim happens inside AuthProvider.signupWithOptionalClaim()
// (Signup.tsx wires it). This route only exists so the URL bar reads
// /a/{token}/claiming for the half-second pause and the user sees a
// spinner with explanatory copy.

import { useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

export function AnonymousCrawlClaiming() {
  const { token = "" } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Signup.tsx routes here with ?tenantId=...&siteId=... after a successful
  // claim. We wait a beat (so the user perceives the transition) then jump
  // into the site overview. Without those params we fall back to /audit -
  // the route is not meant to be opened directly.
  const tenantId = params.get("tenantId")
  const siteId = params.get("siteId")

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tenantId && siteId) {
        navigate(`/t/${tenantId}/sites/${siteId}`, { replace: true })
      } else if (tenantId) {
        navigate(`/t/${tenantId}/sites`, { replace: true })
      } else {
        navigate("/audit", { replace: true })
      }
    }, 700)
    return () => window.clearTimeout(t)
  }, [navigate, siteId, tenantId])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <div className="space-y-1">
          <div className="text-base font-medium">
            Linking your audit to your new account...
          </div>
          <div className="text-xs text-muted-foreground">
            Token {token.slice(0, 8)}... - this only takes a moment.
          </div>
        </div>
      </div>
    </div>
  )
}
