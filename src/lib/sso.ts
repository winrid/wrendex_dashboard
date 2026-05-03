// SAML SSO URL builder (P4 iter 4). The SP login + ACS endpoints are
// public BE routes that the browser must HARD-NAVIGATE to (not fetch) so
// the IdP redirect chain can run; this helper returns a fully-qualified
// URL so the caller can `window.location.href = ssoLoginUrl(...)`.
//
// AGENTS.md hard rule #1 forbids raw URL strings to /api/... in feature
// code. This module sits in src/lib (not feature code) and is the only
// authorised constructor of the SP login URL; the typed client wouldn't
// help here because the browser - not the JS runtime - has to follow the
// resulting 302 chain back from the IdP.

const DEFAULT_BASE_URL = "http://localhost:7070"

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv
  return DEFAULT_BASE_URL
}

/** Build the public SP-initiated login URL for a tenant. The browser
 *  navigates here; the BE 302s to the tenant's IdP, which posts the
 *  assertion to /api/saml/sp/{tenantId}/acs, which 302s the browser back
 *  to `returnTo` with `#sessionToken=...` set. */
export function ssoLoginUrl(tenantId: string, returnTo: string): string {
  const base = resolveBaseUrl().replace(/\/$/, "")
  const u = new URL(`${base}/api/saml/sp/${encodeURIComponent(tenantId)}/login`)
  u.searchParams.set("returnTo", returnTo)
  return u.toString()
}

/** Build the public SP metadata URL for a tenant. The customer's IdP
 *  admin downloads this XML to register Wrendex as a Service Provider. */
export function spMetadataUrl(tenantId: string): string {
  const base = resolveBaseUrl().replace(/\/$/, "")
  const u = new URL(`${base}/api/saml/sp/metadata`)
  u.searchParams.set("tenantId", tenantId)
  return u.toString()
}
