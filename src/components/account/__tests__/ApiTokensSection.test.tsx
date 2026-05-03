// Personal API tokens (P4 iter 2). Create + revoke flows.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { PersonalApiToken } from "@/api/types"

const listApiTokens = vi.fn()
const createApiToken = vi.fn()
const revokeApiToken = vi.fn()

vi.mock("@/api/useApiClient", () => ({
  useApiClient: () => ({
    listApiTokens,
    createApiToken,
    revokeApiToken,
  }),
}))

import { ApiTokensSection } from "../ApiTokensSection"

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ApiTokensSection />
    </QueryClientProvider>,
  )
}

const TOKEN: PersonalApiToken = {
  id: "tok_1",
  name: "Deploy bot",
  prefix: "wrn_a1b2",
  scopes: [],
  createdAt: "2026-04-01T00:00:00Z",
  lastUsedAt: null,
  revokedAt: null,
  expiresAt: null,
}

describe("ApiTokensSection", () => {
  afterEach(() => {
    cleanup()
    listApiTokens.mockReset()
    createApiToken.mockReset()
    revokeApiToken.mockReset()
  })

  it("create returns plaintext that surfaces in the save panel", async () => {
    listApiTokens.mockResolvedValue([])
    createApiToken.mockResolvedValue({
      ...TOKEN,
      token: "wrn_a1b2c3d4e5f6g7h8i9j0",
    })

    renderSection()

    fireEvent.click(screen.getByTestId("api-token-create-open"))

    await waitFor(() => {
      expect(screen.getByTestId("api-token-create-dialog")).toBeTruthy()
    })

    fireEvent.change(screen.getByTestId("api-token-name"), {
      target: { value: "Deploy bot" },
    })
    fireEvent.click(screen.getByTestId("api-token-create-submit"))

    await waitFor(() => {
      expect(createApiToken).toHaveBeenCalledTimes(1)
    })
    const [input] = createApiToken.mock.calls[0]
    expect(input.name).toBe("Deploy bot")
    expect(input.expiresAt).toBeNull()

    // Plaintext panel renders the full token.
    await waitFor(() => {
      const plaintext = screen.getByTestId(
        "api-token-plaintext",
      ) as HTMLInputElement
      expect(plaintext.value).toBe("wrn_a1b2c3d4e5f6g7h8i9j0")
    })
  })

  it("revoke removes the row from the table after the typed-client succeeds", async () => {
    listApiTokens.mockResolvedValue([TOKEN])
    revokeApiToken.mockResolvedValue(undefined)

    renderSection()

    // Wait for the row to render.
    await waitFor(() => {
      expect(screen.getByText("Deploy bot")).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId(`token-revoke-${TOKEN.id}`))

    await waitFor(() => {
      expect(screen.getByTestId("api-token-revoke-dialog")).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId("api-token-revoke-confirm"))

    await waitFor(() => {
      expect(revokeApiToken).toHaveBeenCalledWith(TOKEN.id)
    })

    // The row is gone from the active list.
    await waitFor(() => {
      expect(screen.queryByText("Deploy bot")).toBeNull()
    })
  })
})
