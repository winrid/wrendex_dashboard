// Authenticated session state for the dashboard. Plan section 0.3a.
//
// Single source of truth for {user, memberships, activeTenantId, isLoading,
// isAuthed}. The bearer token is mirrored to localStorage under the
// SESSION_TOKEN_KEY below and into the API client's in-memory slot via
// setAuthToken(); both are kept in sync so every request after login is
// authorised, and hard-reloads survive without a re-login.
//
// All authenticated routes consume this through useAuth(); RequireAuth
// gates rendering until we know whether the stored token is still valid.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ApiError, clearTelemetrySessionId, isApiError } from "@/api/client"
import { setAuthToken, useApiClient } from "@/api/useApiClient"
import type {
  AnonymousCrawlClaimResponse,
  AuthLoginRequest,
  AuthSignupRequest,
  Login2faRequest,
  Me,
  Membership,
  TenantBranding,
  User,
} from "@/api/types"

export const SESSION_TOKEN_KEY = "wrendex.sessionToken"

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (token) window.localStorage.setItem(SESSION_TOKEN_KEY, token)
    else window.localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // ignore quota / disabled storage; in-memory token still works.
  }
}

/** Result of signupWithOptionalClaim: either a vanilla signup or a signup
 *  followed by a successful anonymous-crawl claim. The claim error is
 *  surfaced separately so the caller can route the user into their tenant
 *  even if the claim itself failed. */
export type SignupWithClaimResult = {
  tenantId: string
  /** Present when claimToken was passed AND the claim mutation succeeded. */
  claim?: AnonymousCrawlClaimResponse
  /** Present when claimToken was passed AND the claim mutation failed.
   *  The auth session is still valid; the caller can route into the tenant
   *  and surface the message to the user. */
  claimError?: { status: number; message: string }
}

export type AuthContextValue = {
  user: User | null
  memberships: Membership[]
  activeTenantId: string | null
  isLoading: boolean
  isAuthed: boolean
  /** Active tenant's branding (white-label, plan section 12.3). null while
   *  loading or when the tenant has never customised. The provider eagerly
   *  applies the accent colour to document.documentElement so consumers
   *  rarely need to read this directly. */
  branding: TenantBranding | null
  signup: (input: AuthSignupRequest) => Promise<void>
  /** Same as signup() but optionally also claims an anonymous crawl into
   *  the freshly-created tenant. Returns the tenantId so the caller can
   *  navigate without re-reading state. */
  signupWithOptionalClaim: (
    input: AuthSignupRequest,
    claimToken?: string,
  ) => Promise<SignupWithClaimResult>
  login: (input: AuthLoginRequest) => Promise<Me | { twoFactorRequired: true; pendingToken: string }>
  /** Completes a 2FA-pending login. Pass the pendingToken returned by
   *  login() (when twoFactorRequired===true) plus the user's TOTP / backup
   *  code; on success the bearer token is persisted and /api/me hydrated. */
  login2fa: (input: Login2faRequest) => Promise<Me>
  logout: () => void
  setActiveTenant: (tenantId: string) => void
  /** Re-fetches /api/me and re-seeds {user, memberships, activeTenantId}.
   *  Call after server-side mutations that change membership (e.g. accepting
   *  an invite) so RequireAuth sees the new tenant before navigation. */
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export type AuthProviderProps = {
  children: ReactNode
  /** Test seam: skip the localStorage hydration call to /api/me. */
  skipBootstrap?: boolean
}

export function AuthProvider({ children, skipBootstrap = false }: AuthProviderProps) {
  const client = useApiClient()
  const [user, setUser] = useState<User | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(!skipBootstrap)
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const didBootstrap = useRef(false)

  const applyMe = useCallback((me: Me) => {
    setUser(me.user)
    setMemberships(me.memberships)
    setActiveTenantIdState(
      me.activeTenantId ?? me.memberships[0]?.tenantId ?? null,
    )
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    setMemberships([])
    setActiveTenantIdState(null)
    setBranding(null)
    setAuthToken(null)
    writeStoredToken(null)
    // Drop the funnel-telemetry sessionId on logout so the next signed-in
    // user starts a fresh attribution window (plan section 16).
    clearTelemetrySessionId()
    // Reset any branding-driven CSS vars so the login screen renders against
    // the default Wrendex palette, not the previous tenant's accent.
    if (typeof document !== "undefined") {
      document.documentElement.style.removeProperty("--brand-accent")
    }
  }, [])

  // Apply the active tenant's branding to document.documentElement whenever
  // the tenant flips (or on first load). 404 / 403 are treated as "no
  // branding"; other failures are swallowed so a flaky network never blocks
  // the dashboard. Plan section 12.3 (white-label).
  useEffect(() => {
    if (!activeTenantId) {
      setBranding(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await client.getBranding(activeTenantId)
        if (cancelled) return
        setBranding(next)
        if (typeof document !== "undefined" && next.accentColor) {
          document.documentElement.style.setProperty(
            "--brand-accent",
            next.accentColor,
          )
        }
      } catch (e) {
        if (cancelled) return
        if (isApiError(e) && (e.status === 404 || e.status === 403)) {
          setBranding(null)
          if (typeof document !== "undefined") {
            document.documentElement.style.removeProperty("--brand-accent")
          }
          return
        }
        // Other errors: swallow; branding is non-critical.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTenantId, client])

  // Hydrate on mount: if a token is in localStorage, push it into the client
  // and call /api/me. A 401 means the stored token is stale; clear it so the
  // app shows the login page.
  //
  // SAML SSO post-ACS handoff (P4 iter 4): when the IdP completes assertion
  // validation the BE 302s the browser back to the dashboard with the
  // session token in the URL fragment as #sessionToken=... so it never hits
  // a server log. We pluck it out before the /api/me bootstrap, persist it
  // (replacing any stale token), and strip the fragment from the URL so a
  // refresh doesn't re-trigger the handoff.
  useEffect(() => {
    if (skipBootstrap) return
    if (didBootstrap.current) return
    didBootstrap.current = true

    let stored = readStoredToken()
    if (typeof window !== "undefined") {
      const hash = window.location.hash ?? ""
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1))
        const ssoToken = params.get("sessionToken")
        if (ssoToken && ssoToken.length > 0) {
          writeStoredToken(ssoToken)
          stored = ssoToken
          // Best-effort: drop the fragment so a refresh doesn't replay it
          // and so the bearer token never lingers in the address bar.
          try {
            const cleanUrl =
              window.location.pathname + window.location.search
            window.history.replaceState(null, "", cleanUrl)
          } catch {
            // ignore; the token is already persisted to localStorage.
          }
        }
      }
    }

    if (!stored) {
      setIsLoading(false)
      return
    }
    setAuthToken(stored)
    let cancelled = false
    void (async () => {
      try {
        const me = await client.getMe()
        if (cancelled) return
        applyMe(me)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          clearSession()
        }
        // Other errors: leave the token in place; the network may be flaky
        // and the next authenticated call will retry.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyMe, clearSession, client, skipBootstrap])

  const signup = useCallback(
    async (input: AuthSignupRequest) => {
      const res = await client.signup(input)
      // client.signup already pushed the token into the in-memory slot; mirror
      // it to localStorage and re-fetch /api/me so memberships hydrate.
      writeStoredToken(res.sessionToken)
      const me = await client.getMe()
      applyMe(me)
    },
    [applyMe, client],
  )

  const signupWithOptionalClaim = useCallback(
    async (
      input: AuthSignupRequest,
      claimToken?: string,
    ): Promise<SignupWithClaimResult> => {
      const res = await client.signup(input)
      writeStoredToken(res.sessionToken)
      const me = await client.getMe()
      applyMe(me)
      const tenantId = res.tenant.id

      if (!claimToken) {
        return { tenantId }
      }

      // Auth is already wired (client.signup pushed the bearer token into
      // the in-memory slot); claimAnonymousCrawl will send it. We treat any
      // failure as soft - the user is signed in and the tenant exists; the
      // caller can route them into their workspace and toast the error.
      try {
        const claim = await client.claimAnonymousCrawl(claimToken, tenantId)
        return { tenantId, claim }
      } catch (e) {
        const apiErr = e instanceof ApiError ? e : null
        return {
          tenantId,
          claimError: {
            status: apiErr?.status ?? 0,
            message:
              apiErr?.message ??
              (e instanceof Error ? e.message : "Could not claim audit"),
          },
        }
      }
    },
    [applyMe, client],
  )

  const login = useCallback(
    async (
      input: AuthLoginRequest,
    ): Promise<Me | { twoFactorRequired: true; pendingToken: string }> => {
      const res = await client.login(input)
      if (res.twoFactorRequired === true) {
        // Pending-2FA: the BE returned a short-lived pendingToken (it was
        // surfaced as `sessionToken` on the wire). We deliberately do NOT
        // persist it to localStorage; the caller must round-trip the token
        // back through login2fa() to upgrade to a real session.
        return { twoFactorRequired: true, pendingToken: res.sessionToken }
      }
      writeStoredToken(res.sessionToken)
      const me = await client.getMe()
      applyMe(me)
      return me
    },
    [applyMe, client],
  )

  const login2fa = useCallback(
    async (input: Login2faRequest): Promise<Me> => {
      const res = await client.login2fa(input)
      writeStoredToken(res.sessionToken)
      const me = await client.getMe()
      applyMe(me)
      return me
    },
    [applyMe, client],
  )

  const logout = useCallback(() => {
    // Best-effort server-side invalidation; do not block the UI on it.
    void client.logout().catch(() => {
      // setAuthToken(null) is invoked by the client on logout; nothing to do.
    })
    clearSession()
  }, [client, clearSession])

  const setActiveTenant = useCallback((tenantId: string) => {
    setActiveTenantIdState(tenantId)
  }, [])

  const refresh = useCallback(async () => {
    // Re-fetch /api/me. Used after mutations that change membership (e.g.
    // accept-invite) so RequireAuth doesn't bounce the user before the
    // freshly-joined tenant lands in state. 401 here means the session is
    // stale; clear it so the app routes back to the login screen.
    try {
      const me = await client.getMe()
      applyMe(me)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession()
      }
      throw e
    }
  }, [applyMe, clearSession, client])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      activeTenantId,
      isLoading,
      isAuthed: user !== null,
      branding,
      signup,
      signupWithOptionalClaim,
      login,
      login2fa,
      logout,
      setActiveTenant,
      refresh,
    }),
    [
      user,
      memberships,
      activeTenantId,
      isLoading,
      branding,
      signup,
      signupWithOptionalClaim,
      login,
      login2fa,
      logout,
      setActiveTenant,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return ctx
}
