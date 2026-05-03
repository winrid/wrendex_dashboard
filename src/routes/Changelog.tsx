// Public changelog page (plan section 13). PUBLIC; mounted at /changelog
// above RequireAuth so unauthenticated users (marketing-site visitors,
// recipients of share links) can browse what shipped.
//
// Renders the same per-entry shape as the WhatsNewModal but full-page with
// a "Wrendex changelog" header. Read-only; if the user is signed in the
// bell handles badge clearing - this page does not call markChangelogSeen.

import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/useApiClient"
import { Button } from "@/components/ui/button"
import { ChangelogEntryRow } from "@/components/changelog/WhatsNewModal"

export function Changelog() {
  const client = useApiClient()

  const listQ = useQuery({
    queryKey: ["public-changelog", 50],
    queryFn: () => client.listPublishedChangelog({ limit: 50 }),
  })

  const items = listQ.data?.items ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Wrendex changelog
        </h1>
        <p className="text-sm text-muted-foreground">
          Recent changes shipped to Wrendex.
        </p>
      </header>

      {listQ.isLoading ? (
        <div
          className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground"
          data-testid="public-changelog-loading"
        >
          Loading changelog...
        </div>
      ) : listQ.isError ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-destructive">
          Could not load changelog.
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground"
          data-testid="public-changelog-empty"
        >
          No changelog entries yet.
        </div>
      ) : (
        <div
          className="rounded-md border bg-card px-6"
          data-testid="public-changelog-list"
        >
          {items.map((entry) => (
            <ChangelogEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
