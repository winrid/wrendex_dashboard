// Personal API tokens. Plan section P4 iter 2.
//
// DataTable bound to client.listApiTokens. The "Create token" dialog
// captures a name + an optional expiry; on submit it switches to a
// "save this token now" panel that surfaces the plaintext token exactly
// once. Per-row Revoke is gated behind a small confirmation dialog.
//
// A Bearer header that starts with "wrn_" identifies a personal API token
// rather than a session cookie token; the BE's auth middleware looks at
// the prefix to decide which validation path to take.

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import type {
  CreateApiTokenInput,
  CreateApiTokenResponse,
  PersonalApiToken,
} from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table/DataTable"
import { relativeTime } from "@/lib/format"

type ExpiryChoice = "never" | "30d" | "90d" | "1y"

function expiryChoiceToIso(choice: ExpiryChoice): string | null {
  if (choice === "never") return null
  const now = Date.now()
  const days = choice === "30d" ? 30 : choice === "90d" ? 90 : 365
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
}

type TokenStatus = "active" | "revoked" | "expired"

function statusOf(token: PersonalApiToken): TokenStatus {
  if (token.revokedAt) return "revoked"
  if (
    token.expiresAt &&
    Date.parse(token.expiresAt) <= Date.now()
  )
    return "expired"
  return "active"
}

function StatusBadge({ status }: { status: TokenStatus }) {
  const classes =
    status === "active"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
      : status === "revoked"
        ? "bg-muted text-muted-foreground"
        : "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
  const label = status === "active" ? "Active" : status === "revoked" ? "Revoked" : "Expired"
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${classes}`}
      data-testid={`token-status-${status}`}
    >
      {label}
    </span>
  )
}

export function ApiTokensSection() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const tokensQ = useQuery<PersonalApiToken[]>({
    queryKey: ["api-tokens"],
    queryFn: () => client.listApiTokens(),
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<PersonalApiToken | null>(
    null,
  )

  const revokeMut = useMutation({
    mutationFn: (id: string) => client.revokeApiToken(id),
    onSuccess: (_void, id) => {
      // Optimistically drop the revoked token from the list so the row
      // disappears immediately even if the BE list endpoint is slow to
      // refetch. The BE soft-deletes (revokedAt) so the row is technically
      // still there, but the test expectation + product behaviour both want
      // it gone from the active list.
      queryClient.setQueryData<PersonalApiToken[]>(
        ["api-tokens"],
        (prev) => (prev ?? []).filter((t) => t.id !== id),
      )
      toast.success("Token revoked")
      setRevokeTarget(null)
    },
    onError: () => {
      toast.error("Could not revoke token")
    },
  })

  const tokens = useMemo<PersonalApiToken[]>(
    () => tokensQ.data ?? [],
    [tokensQ.data],
  )

  const columns = useMemo<ColumnDef<PersonalApiToken>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "prefix",
        header: "Prefix",
        accessorKey: "prefix",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.prefix}...</span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "lastUsedAt",
        header: "Last used",
        accessorKey: "lastUsedAt",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.lastUsedAt)}
          </span>
        ),
      },
      {
        id: "expiresAt",
        header: "Expires",
        accessorKey: "expiresAt",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.expiresAt
              ? relativeTime(row.original.expiresAt)
              : "Never"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={statusOf(row.original)} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const token = row.original
          if (token.revokedAt) return null
          return (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevokeTarget(token)}
              data-testid={`token-revoke-${token.id}`}
            >
              Revoke
            </Button>
          )
        },
      },
    ],
    [],
  )

  return (
    <>
      <Card data-testid="api-tokens-card">
        <CardHeader>
          <CardTitle>Personal API tokens</CardTitle>
          <CardDescription>
            Long-lived bearer tokens for scripting + CI. A Bearer header
            starting with{" "}
            <span className="font-mono text-xs">wrn_</span> is treated as a
            personal API token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              data-testid="api-token-create-open"
            >
              Create token
            </Button>
          </div>
          <DataTable<PersonalApiToken>
            columns={columns}
            data={tokens}
            isLoading={tokensQ.isLoading}
            emptyState="No tokens yet."
            pageSize={10}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      {createOpen ? (
        <CreateTokenDialog
          onClose={(created) => {
            setCreateOpen(false)
            if (created) {
              void queryClient.invalidateQueries({ queryKey: ["api-tokens"] })
            }
          }}
        />
      ) : null}

      {revokeTarget ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setRevokeTarget(null)
          }}
        >
          <DialogContent
            className="sm:max-w-sm"
            data-testid="api-token-revoke-dialog"
          >
            <DialogHeader>
              <DialogTitle>Revoke this token?</DialogTitle>
              <DialogDescription>
                "{revokeTarget.name}" will stop working immediately. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevokeTarget(null)}
                disabled={revokeMut.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => revokeMut.mutate(revokeTarget.id)}
                disabled={revokeMut.isPending}
                data-testid="api-token-revoke-confirm"
              >
                {revokeMut.isPending ? "Revoking..." : "Revoke"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function CreateTokenDialog({
  onClose,
}: {
  onClose: (created: boolean) => void
}) {
  const client = useApiClient()
  const [name, setName] = useState("")
  const [expiry, setExpiry] = useState<ExpiryChoice>("never")
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateApiTokenResponse | null>(null)

  const createMut = useMutation({
    mutationFn: (input: CreateApiTokenInput) => client.createApiToken(input),
    onSuccess: (data) => {
      setCreated(data)
    },
    onError: () => {
      toast.error("Could not create token")
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (created) {
      onClose(true)
      return
    }
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }
    createMut.mutate({
      name: trimmed,
      expiresAt: expiryChoiceToIso(expiry),
    })
  }

  const copyPlaintext = () => {
    if (!created) return
    void navigator.clipboard
      ?.writeText(created.token)
      .then(() => toast.success("Token copied"))
      .catch(() => toast.error("Could not copy token"))
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(created !== null)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="api-token-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {created ? "Save your token now" : "Create personal API token"}
          </DialogTitle>
          <DialogDescription>
            {created
              ? "This token won't be shown again. Copy it somewhere safe before closing."
              : "Pick a name + optional expiry. The token is shown once on the next screen."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="api-token-plaintext">Token</Label>
              <Input
                id="api-token-plaintext"
                readOnly
                value={created.token}
                className="font-mono text-xs"
                data-testid="api-token-plaintext"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyPlaintext}
              data-testid="api-token-copy"
            >
              Copy token
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="api-token-name">Name</Label>
              <Input
                id="api-token-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. Deploy bot"
                autoFocus
                data-testid="api-token-name"
                aria-invalid={error ? true : undefined}
              />
              {error ? (
                <p
                  className="text-xs text-destructive"
                  data-testid="api-token-name-error"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="api-token-expiry">Expiry</Label>
              <Select
                value={expiry}
                onValueChange={(v) => setExpiry(v as ExpiryChoice)}
              >
                <SelectTrigger
                  id="api-token-expiry"
                  className="w-48"
                  data-testid="api-token-expiry"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        )}

        <DialogFooter>
          {created ? (
            <Button
              type="button"
              onClick={() => onClose(true)}
              data-testid="api-token-done"
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={createMut.isPending}
              data-testid="api-token-create-submit"
            >
              {createMut.isPending ? "Creating..." : "Create token"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
