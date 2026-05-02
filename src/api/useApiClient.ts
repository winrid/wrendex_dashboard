// Singleton-backed hook returning the typed API client. Bound to the
// VITE_API_BASE_URL env var (default http://localhost:7070). Uses a module
// singleton instead of React context because there is exactly one backend
// the dashboard talks to; context buys us nothing here and adds a provider
// the AppShell would have to thread. If the auth header provider needs to
// change at runtime once 0.3a auth lands, swap to context then.

import { useMemo } from "react"
import { createApiClient, type ApiClient } from "./client"

const DEFAULT_BASE_URL = "http://localhost:7070"

function resolveBaseUrl(): string {
  // import.meta.env is typed via vite/client.
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv
  return DEFAULT_BASE_URL
}

let singleton: ApiClient | null = null

function getClient(): ApiClient {
  if (singleton) return singleton
  singleton = createApiClient({
    baseUrl: resolveBaseUrl(),
    // Placeholder until auth lands in plan section 0.3a.
    getAuthHeader: () => undefined,
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
}
