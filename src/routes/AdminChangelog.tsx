// Internal admin route for staff to manage changelog entries (plan
// section 13). Lives at /admin/changelog (NOT tenant-scoped because the
// changelog is per-instance, not per-tenant). The BE returns 403 from
// listAdminChangelog when the caller is not staff; we treat 403 the same
// as 404 and render a "You don't have access" message in either case.
//
// DataTable bound to listAdminChangelog({includeDrafts:true}). A "New
// entry" button at the top opens a Dialog that posts createChangelogEntry.
// Per-row Edit + Delete actions call updateChangelogEntry /
// deleteChangelogEntry.

import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type {
  ChangelogEntry,
  ChangelogTag,
  CreateChangelogEntryInput,
  UpdateChangelogEntryInput,
} from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Badge } from "@/components/ui/badge-fallback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { tagBadgeClasses } from "@/components/changelog/WhatsNewModal"
import { cn } from "@/lib/utils"

const TAGS: ChangelogTag[] = ["NEW", "IMPROVED", "FIX", "BREAKING"]

function formatPublishedAt(iso: string | null | undefined): string {
  if (!iso) return "Draft"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Draft"
  return d.toLocaleString()
}

// ---------------------------------------------------------------------------
// Entry-form dialog (used for both create + edit)
// ---------------------------------------------------------------------------

type EntryFormState = {
  slug: string
  title: string
  body: string
  tag: ChangelogTag
  /** YYYY-MM-DDTHH:mm string from <input type="datetime-local">, or "". */
  publishedAtLocal: string
  publishNow: boolean
}

function emptyForm(): EntryFormState {
  return {
    slug: "",
    title: "",
    body: "",
    tag: "NEW",
    publishedAtLocal: "",
    publishNow: false,
  }
}

function fromEntry(entry: ChangelogEntry): EntryFormState {
  let local = ""
  if (entry.publishedAt) {
    const d = new Date(entry.publishedAt)
    if (!Number.isNaN(d.getTime())) {
      // Strip seconds + timezone for the datetime-local input.
      const iso = d.toISOString()
      local = iso.slice(0, 16)
    }
  }
  return {
    slug: entry.slug,
    title: entry.title,
    body: entry.body,
    tag: entry.tag,
    publishedAtLocal: local,
    publishNow: false,
  }
}

function resolvePublishedAt(form: EntryFormState): string | null {
  if (form.publishNow) return new Date().toISOString()
  if (!form.publishedAtLocal) return null
  const d = new Date(form.publishedAtLocal)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type EntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog is in edit mode for this entry. */
  editing: ChangelogEntry | null
}

function EntryDialog({ open, onOpenChange, editing }: EntryDialogProps) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EntryFormState>(() =>
    editing ? fromEntry(editing) : emptyForm(),
  )
  const [slugError, setSlugError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset / hydrate the form whenever the dialog (re)opens against a new
  // editing target.
  useEffect(() => {
    if (open) {
      setForm(editing ? fromEntry(editing) : emptyForm())
      setSlugError(null)
      setSubmitError(null)
    }
  }, [open, editing])

  const createMut = useMutation({
    mutationFn: (input: CreateChangelogEntryInput) =>
      client.createChangelogEntry(input),
    onSuccess: () => {
      toast.success("Changelog entry created")
      void queryClient.invalidateQueries({ queryKey: ["admin-changelog"] })
      void queryClient.invalidateQueries({ queryKey: ["whats-new"] })
      void queryClient.invalidateQueries({ queryKey: ["public-changelog"] })
      onOpenChange(false)
    },
    onError: (err) => {
      if (isApiError(err) && err.status === 409) {
        setSlugError("Slug already taken")
        return
      }
      setSubmitError(
        err instanceof Error ? err.message : "Could not create entry",
      )
    },
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: UpdateChangelogEntryInput
    }) => client.updateChangelogEntry(id, patch),
    onSuccess: () => {
      toast.success("Changelog entry updated")
      void queryClient.invalidateQueries({ queryKey: ["admin-changelog"] })
      void queryClient.invalidateQueries({ queryKey: ["whats-new"] })
      void queryClient.invalidateQueries({ queryKey: ["public-changelog"] })
      onOpenChange(false)
    },
    onError: (err) => {
      if (isApiError(err) && err.status === 409) {
        setSlugError("Slug already taken")
        return
      }
      setSubmitError(
        err instanceof Error ? err.message : "Could not update entry",
      )
    },
  })

  const isPending = createMut.isPending || updateMut.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSlugError(null)
    setSubmitError(null)
    if (!form.slug.trim()) {
      setSlugError("Slug is required")
      return
    }
    if (!form.title.trim()) {
      setSubmitError("Title is required")
      return
    }
    const publishedAt = resolvePublishedAt(form)
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        patch: {
          slug: form.slug.trim(),
          title: form.title.trim(),
          body: form.body,
          tag: form.tag,
          publishedAt,
        },
      })
    } else {
      createMut.mutate({
        slug: form.slug.trim(),
        title: form.title.trim(),
        body: form.body,
        tag: form.tag,
        publishedAt,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="changelog-entry-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit entry" : "New entry"}
          </DialogTitle>
          <DialogDescription>
            Markdown is supported in the body.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="changelog-slug">Slug</Label>
            <Input
              id="changelog-slug"
              value={form.slug}
              onChange={(e) =>
                setForm((s) => ({ ...s, slug: e.target.value }))
              }
              placeholder="bell-and-whats-new-modal"
              data-testid="changelog-slug-input"
              aria-invalid={slugError ? "true" : undefined}
            />
            {slugError ? (
              <p
                className="text-xs text-destructive"
                data-testid="changelog-slug-error"
              >
                {slugError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="changelog-title">Title</Label>
            <Input
              id="changelog-title"
              value={form.title}
              onChange={(e) =>
                setForm((s) => ({ ...s, title: e.target.value }))
              }
              data-testid="changelog-title-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="changelog-body">Body</Label>
            <Textarea
              id="changelog-body"
              rows={6}
              value={form.body}
              onChange={(e) =>
                setForm((s) => ({ ...s, body: e.target.value }))
              }
              placeholder="Markdown-friendly. Plain prose works fine."
              data-testid="changelog-body-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Select
                value={form.tag}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, tag: v as ChangelogTag }))
                }
              >
                <SelectTrigger data-testid="changelog-tag-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAGS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="changelog-publishedAt">Published at</Label>
              <Input
                id="changelog-publishedAt"
                type="datetime-local"
                value={form.publishedAtLocal}
                disabled={form.publishNow}
                onChange={(e) =>
                  setForm((s) => ({ ...s, publishedAtLocal: e.target.value }))
                }
                data-testid="changelog-publishedAt-input"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="changelog-publishNow"
              checked={form.publishNow}
              onCheckedChange={(v) =>
                setForm((s) => ({ ...s, publishNow: Boolean(v) }))
              }
              data-testid="changelog-publishNow-switch"
            />
            <Label htmlFor="changelog-publishNow">Publish now</Label>
          </div>
          {submitError ? (
            <p
              className="text-xs text-destructive"
              data-testid="changelog-submit-error"
            >
              {submitError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="changelog-submit-button"
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

export function AdminChangelog() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ChangelogEntry | null>(null)
  const [deleting, setDeleting] = useState<ChangelogEntry | null>(null)

  const listQ = useQuery<ChangelogEntry[] | { forbidden: true }>({
    queryKey: ["admin-changelog"],
    queryFn: async () => {
      try {
        return await client.listAdminChangelog({ includeDrafts: true })
      } catch (e) {
        if (isApiError(e) && (e.status === 403 || e.status === 404)) {
          return { forbidden: true } as const
        }
        throw e
      }
    },
    retry: false,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => client.deleteChangelogEntry(id),
    onSuccess: () => {
      toast.success("Changelog entry deleted")
      void queryClient.invalidateQueries({ queryKey: ["admin-changelog"] })
      void queryClient.invalidateQueries({ queryKey: ["whats-new"] })
      void queryClient.invalidateQueries({ queryKey: ["public-changelog"] })
      setDeleting(null)
    },
    onError: () => toast.error("Could not delete entry"),
  })

  const data = listQ.data
  const forbidden =
    data !== undefined && !Array.isArray(data) && data.forbidden === true
  const rows: ChangelogEntry[] = Array.isArray(data) ? data : []

  const columns = useMemo<ColumnDef<ChangelogEntry>[]>(
    () => [
      {
        id: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.slug}</span>
        ),
      },
      {
        id: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.title}</span>
        ),
      },
      {
        id: "tag",
        header: "Tag",
        cell: ({ row }) => (
          <Badge className={cn(tagBadgeClasses(row.original.tag))}>
            {row.original.tag}
          </Badge>
        ),
      },
      {
        id: "publishedAt",
        header: "Published",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground tabular-nums"
            title={row.original.publishedAt ?? "Draft"}
          >
            {formatPublishedAt(row.original.publishedAt)}
          </span>
        ),
      },
      {
        id: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground tabular-nums"
            title={row.original.updatedAt}
          >
            {new Date(row.original.updatedAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setEditing(row.original)}
              data-testid={`changelog-edit-${row.original.slug}`}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => setDeleting(row.original)}
              data-testid={`changelog-delete-${row.original.slug}`}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Changelog admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage entries shown in the bell + on the public /changelog page.
          </p>
        </div>
        {!forbidden ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-testid="changelog-new-entry-button"
          >
            New entry
          </Button>
        ) : null}
      </header>

      {listQ.isLoading ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : forbidden ? (
        <div
          className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground"
          data-testid="changelog-no-access"
        >
          You don't have access.
        </div>
      ) : listQ.isError ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-destructive">
          Could not load changelog.
        </div>
      ) : (
        <DataTable<ChangelogEntry>
          columns={columns}
          data={rows}
          emptyState={
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-testid="changelog-admin-empty"
            >
              No changelog entries yet.
            </div>
          }
        />
      )}

      <EntryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editing={null}
      />
      <EntryDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        editing={editing}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete changelog entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title} will be removed from the bell and the public
              page. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteMut.mutate(deleting.id)
              }}
              data-testid="changelog-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster />
    </div>
  )
}
