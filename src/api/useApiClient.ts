// Singleton-backed hook returning the typed API client. Bound to the
// VITE_API_BASE_URL env var (default http://localhost:7070). Uses a module
// singleton instead of React context because there is exactly one backend
// the dashboard talks to; context buys us nothing here and adds a provider
// the AppShell would have to thread.
//
// Auth (plan section 0.3a): the bearer token lives in a module-level slot
// that getAuthHeader reads on every request. AuthProvider writes to it on
// hydration / login / logout via setAuthToken. The client's auth methods
// also write to it as a side effect of a successful login / signup / logout
// so the very next call (e.g. getMe right after login) is authorised.

import { useMemo } from "react"
import { createApiClient, type ApiClient } from "./client"

const DEFAULT_BASE_URL = "http://localhost:7070"

function resolveBaseUrl(): string {
  // import.meta.env is typed via vite/client.
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv
  return DEFAULT_BASE_URL
}

// ---------------------------------------------------------------------------
// In-memory bearer token store. Single source of truth at runtime; the
// AuthProvider mirrors it to localStorage so it survives a hard reload.
// ---------------------------------------------------------------------------

let bearerToken: string | null = null

export function getAuthToken(): string | null {
  return bearerToken
}

export function setAuthToken(token: string | null): void {
  bearerToken = token
}

let singleton: ApiClient | null = null

function getClient(): ApiClient {
  if (singleton) return singleton
  singleton = createApiClient({
    baseUrl: resolveBaseUrl(),
    getAuthHeader: () => {
      const t = getAuthToken()
      return t ? { Authorization: `Bearer ${t}` } : undefined
    },
    setAuthToken,
  })
  return singleton
}

/** Returns a stable reference to the API client. Safe to use in render. */
export function useApiClient(): ApiClient {
  return useMemo(() => getClient(), [])
}

/** Escape hatch for non-React callers (loaders, query keys, tests). */
export function getApiClient(): ApiClient {
  return getClient()
}

/** Test-only: wipe the cached singleton so the next getClient() rebuilds it. */
export function __resetApiClientForTests(): void {
  singleton = null
  bearerToken = null
}
