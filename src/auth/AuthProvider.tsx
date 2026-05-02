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
import { ApiError } from "@/api/client"
import { setAuthToken, useApiClient } from "@/api/useApiClient"
import type {
  AuthLoginRequest,
  AuthSignupRequest,
  Me,
  Membership,
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

export type AuthContextValue = {
  user: User | null
  memberships: Membership[]
  activeTenantId: string | null
  isLoading: boolean
  isAuthed: boolean
  signup: (input: AuthSignupRequest) => Promise<void>
  login: (input: AuthLoginRequest) => Promise<void>
  logout: () => void
  setActiveTenant: (tenantId: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
    setAuthToken(null)
    writeStoredToken(null)
  }, [])

  // Hydrate on mount: if a token is in localStorage, push it into the client
  // and call /api/me. A 401 means the stored token is stale; clear it so the
  // app shows the login page.
  useEffect(() => {
    if (skipBootstrap) return
    if (didBootstrap.current) return
    didBootstrap.current = true

    const stored = readStoredToken()
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

  const login = useCallback(
    async (input: AuthLoginRequest) => {
      const res = await client.login(input)
      writeStoredToken(res.sessionToken)
      const me = await client.getMe()
      applyMe(me)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      activeTenantId,
      isLoading,
      isAuthed: user !== null,
      signup,
      login,
      logout,
      setActiveTenant,
    }),
    [user, memberships, activeTenantId, isLoading, signup, login, logout, setActiveTenant],
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
