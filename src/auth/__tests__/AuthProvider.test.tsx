// Smoke tests for the auth provider, route guard, and protected shell.
// We mock the API client singleton so we never touch the network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Vitest 4's jsdom env on Node 25 lets Node's native (incomplete)
// localStorage shadow jsdom's implementation. Install a fully-spec'd
// in-memory store before any module-load side effect can read from it.
const __memStore = new Map<string, string>()
const __ls = {
  getItem: (k: string) => (__memStore.has(k) ? __memStore.get(k)! : null),
  setItem: (k: string, v: string) => {
    __memStore.set(k, String(v))
  },
  removeItem: (k: string) => {
    __memStore.delete(k)
  },
  clear: () => {
    __memStore.clear()
  },
  key: (i: number) => Array.from(__memStore.keys())[i] ?? null,
  get length() {
    return __memStore.size
  },
}
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: __ls,
})
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: __ls,
})
import { act, render, screen, waitFor } from "@testing-library/react"
import {
  MemoryRouter,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom"
import { AuthProvider, SESSION_TOKEN_KEY, useAuth } from "../AuthProvider"
import { RequireAuth } from "../RequireAuth"

// Stub the API client module before importing anything else that depends
// on it. The stub mirrors only the methods the AuthProvider calls + the
// surface the Sites route uses for the rendering smoke test below.
let getMeImpl: () => Promise<unknown> = async () => {
  throw new Error("getMe not configured")
}
let loginImpl: (input: unknown) => Promise<unknown> = async () => {
  throw new Error("login not configured")
}
let listSitesImpl: () => Promise<unknown> = async () => []
let listCrawlsImpl: () => Promise<unknown> = async () => []
let token: string | null = null

vi.mock("@/api/useApiClient", () => {
  return {
    setAuthToken: (t: string | null) => {
      token = t
    },
    getAuthToken: () => token,
    useApiClient: () => ({
      getMe: () => getMeImpl(),
      login: async (input: unknown) => {
        const res = (await loginImpl(input)) as { sessionToken: string }
        token = res.sessionToken
        return res
      },
      signup: async () => {
        throw new Error("not used")
      },
      logout: async () => {
        token = null
      },
      listSitesByTenant: () => listSitesImpl(),
      listCrawlsBySite: () => listCrawlsImpl(),
    }),
    __resetApiClientForTests: () => {
      token = null
    },
  }
})

beforeEach(() => {
  window.localStorage.clear()
  token = null
  getMeImpl = async () => {
    throw new Error("getMe not configured")
  }
  loginImpl = async () => {
    throw new Error("login not configured")
  }
  listSitesImpl = async () => []
  listCrawlsImpl = async () => []
})

afterEach(() => {
  window.localStorage.clear()
  token = null
})

function LoginProbe() {
  const [params] = useSearchParams()
  const next = params.get("next") ?? ""
  return (
    <div>
      <span data-testid="login-page">login</span>
      <span data-testid="next">{next}</span>
    </div>
  )
}

function AuthedProbe() {
  const { user, isAuthed, login } = useAuth()
  return (
    <div>
      <span data-testid="email">{user?.email ?? ""}</span>
      <span data-testid="authed">{String(isAuthed)}</span>
      <button
        data-testid="login-btn"
        onClick={() => {
          void login({ email: "u@example.com", password: "hunter22" })
        }}
      >
        login
      </button>
    </div>
  )
}

describe("AuthProvider", () => {
  it("login() persists the token, hydrates /api/me, and exposes the user", async () => {
    loginImpl = async () => ({
      sessionToken: "tok-123",
      user: {
        id: "u_1",
        email: "u@example.com",
        createdAt: "2026-04-30T00:00:00Z",
      },
    })
    getMeImpl = async () => ({
      user: {
        id: "u_1",
        email: "u@example.com",
        createdAt: "2026-04-30T00:00:00Z",
      },
      memberships: [
        { tenantId: "t_1", tenantName: "Acme", role: "OWNER" },
      ],
      activeTenantId: "t_1",
    })

    render(
      <AuthProvider skipBootstrap>
        <AuthedProbe />
      </AuthProvider>,
    )

    expect(screen.getByTestId("authed").textContent).toBe("false")

    await act(async () => {
      screen.getByTestId("login-btn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("authed").textContent).toBe("true")
    })
    expect(screen.getByTestId("email").textContent).toBe("u@example.com")
    expect(window.localStorage.getItem(SESSION_TOKEN_KEY)).toBe("tok-123")
    expect(token).toBe("tok-123")
  })
})

describe("RequireAuth", () => {
  it("redirects to /login?next=... when the user is not authenticated", async () => {
    render(
      <MemoryRouter initialEntries={["/t/abc/sites"]}>
        <AuthProvider skipBootstrap>
          <Routes>
            <Route
              path="/t/:tenantId/sites"
              element={
                <RequireAuth>
                  <div>secret content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeTruthy()
    })
    expect(screen.getByTestId("next").textContent).toBe("/t/abc/sites")
  })
})

describe("Protected Sites page", () => {
  it("renders inside the auth shell once the stored token validates", async () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, "tok-seed")
    getMeImpl = async () => ({
      user: {
        id: "u_1",
        email: "u@example.com",
        createdAt: "2026-04-30T00:00:00Z",
      },
      memberships: [
        { tenantId: "t_1", tenantName: "Acme", role: "OWNER" },
      ],
      activeTenantId: "t_1",
    })
    listSitesImpl = async () => [
      {
        id: "s_1",
        tenantId: "t_1",
        url: "https://acme.example",
        createdAt: "2026-04-30T00:00:00Z",
        lastCrawlAt: "2026-04-30T00:00:00Z",
        verifiedAt: "2026-04-30T00:00:00Z",
      },
    ]

    const { Sites } = await import("@/routes/Sites")
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    )
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/t/t_1/sites"]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/t/:tenantId/sites"
                element={
                  <RequireAuth>
                    <Sites />
                  </RequireAuth>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText("Sites")).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText("acme.example")).toBeTruthy()
    })
  })
})
