// Saved-view dropdown for any DataTable surface (plan section P4 iter 1).
// Lists the segments scoped to (route, optionally siteId), lets the owner
// rename/delete their own segments, and exposes a "Save current view..."
// dialog that captures the consumer-supplied filter object as a JSON blob.
//
// The menu is intentionally generic: it does not know what a Page Explorer
// filter looks like vs an Inbox filter. The consumer hands us:
//
//   - currentFilter: an opaque JS object (must be JSON-serialisable) that
//     captures every piece of state we want to round-trip. We stringify it
//     into SavedView.filterJson.
//   - onApply(filter): called with the parsed filter object when the user
//     picks a segment. The consumer is responsible for slotting it back into
//     its component state.
//   - route: a stable URL pattern (e.g. "/sites/:siteId/crawls/:crawlId/pages")
//     so the same segment can re-apply across different sites/crawls.
//   - siteId (optional): scopes the segment to a single site.
//
// Bookmark icon trigger lives next to the existing CSV/PDF/Share buttons.

import { useContext, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  BookmarkIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import { AuthContext } from "@/auth/AuthProvider"
import { isApiError } from "@/api/client"
import type {
  CreateSavedViewInput,
  SavedView,
  UpdateSavedViewInput,
} from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type SavedViewMenuProps = {
  /** Optional site scope for the persisted view. Omit for tenant-wide. */
  siteId?: string
  /** Stable React Router URL pattern this surface lives on. */
  route: string
  /** Opaque filter snapshot to persist when the user clicks Save. Must be
   *  JSON-serialisable. */
  currentFilter: unknown
  /** Called when the user picks a segment from the list. The argument is
   *  the parsed filter object the consumer originally saved. */
  onApply: (filter: unknown) => void
  /** Optional override for the trigger label. Defaults to "Saved views". */
  label?: string
}

const saveSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  shared: z.boolean(),
})

type SaveValues = z.infer<typeof saveSchema>

export function SavedViewMenu({
  siteId,
  route,
  currentFilter,
  onApply,
  label = "Saved views",
}: SavedViewMenuProps) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  // Soft auth lookup so this menu can mount in tests / Storybook surfaces
  // that don't wrap the tree in an AuthProvider. tenantId is always
  // available via the route (every consumer mounts under /t/:tenantId/...).
  const auth = useContext(AuthContext)
  const { tenantId: routeTenantId = "default" } = useParams<{
    tenantId: string
  }>()
  const tenantId = auth?.activeTenantId ?? routeTenantId

  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [editing, setEditing] = useState<SavedView | null>(null)

  const queryKey = useMemo(
    () => ["saved-views", tenantId, siteId ?? null, route] as const,
    [tenantId, siteId, route],
  )

  const listQ = useQuery<SavedView[]>({
    queryKey,
    queryFn: () =>
      client.listSavedViews(tenantId, { siteId, route }),
    enabled: Boolean(tenantId && route) && open,
  })

  const createMut = useMutation({
    mutationFn: (input: CreateSavedViewInput) =>
      client.createSavedView(tenantId, input),
    onSuccess: () => {
      toast.success("View saved")
      setSaveOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 404) {
        toast.error("Saved-views endpoint not yet available")
        return
      }
      toast.error("Could not save view")
    },
  })

  const updateMut = useMutation({
    mutationFn: (input: { id: string; patch: UpdateSavedViewInput }) =>
      client.updateSavedView(tenantId, input.id, input.patch),
    onSuccess: () => {
      toast.success("View updated")
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
    onError: () => toast.error("Could not update view"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => client.deleteSavedView(tenantId, id),
    onSuccess: () => {
      toast.success("View deleted")
      void queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
    onError: () => toast.error("Could not delete view"),
  })

  const onPickSegment = (view: SavedView) => {
    let parsed: unknown = null
    try {
      parsed = view.filterJson ? JSON.parse(view.filterJson) : null
    } catch {
      toast.error("Saved view is corrupt; cannot apply")
      return
    }
    onApply(parsed)
    setOpen(false)
  }

  const segments = listQ.data ?? []

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="saved-views-trigger"
          >
            <BookmarkIcon />
            <span>{label}</span>
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72"
          data-testid="saved-views-menu"
        >
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {listQ.isLoading ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Loading...
            </div>
          ) : segments.length === 0 ? (
            <div
              className="px-2 py-2 text-xs text-muted-foreground"
              data-testid="saved-views-empty"
            >
              No saved views yet for this surface.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {segments.map((v) => {
                const owned = v.ownerUserId === auth?.user?.id
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-1 px-1 py-0.5"
                    data-testid={`saved-view-row-${v.id}`}
                  >
                    <button
                      type="button"
                      className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => onPickSegment(v)}
                      data-testid={`saved-view-apply-${v.id}`}
                    >
                      <span className="truncate">{v.name}</span>
                      {v.shared ? (
                        <span className="ml-2 inline-flex items-center rounded bg-muted px-1 text-[10px] font-medium uppercase text-muted-foreground">
                          Shared
                        </span>
                      ) : null}
                    </button>
                    {owned ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`More actions for ${v.name}`}
                            data-testid={`saved-view-kebab-${v.id}`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setEditing(v)
                            }}
                            data-testid={`saved-view-edit-${v.id}`}
                          >
                            <PencilIcon className="mr-2 size-4" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              deleteMut.mutate(v.id)
                            }}
                            data-testid={`saved-view-delete-${v.id}`}
                          >
                            <Trash2Icon className="mr-2 size-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setOpen(false)
              setSaveOpen(true)
            }}
            data-testid="saved-view-save-current"
          >
            <PlusIcon className="mr-2 size-4" />
            <span>Save current view...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        pending={createMut.isPending}
        onSubmit={(values) =>
          createMut.mutate({
            siteId: siteId ?? null,
            name: values.name,
            route,
            filterJson: JSON.stringify(currentFilter ?? null),
            shared: values.shared,
          })
        }
      />

      <EditDialog
        view={editing}
        pending={updateMut.isPending}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
        onSubmit={(view, patch) =>
          updateMut.mutate({ id: view.id, patch })
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Save dialog: name + shared toggle.
// ---------------------------------------------------------------------------

type SaveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onSubmit: (values: SaveValues) => void
}

function SaveDialog({ open, onOpenChange, pending, onSubmit }: SaveDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SaveValues>({
    resolver: zodResolver(saveSchema),
    defaultValues: { name: "", shared: false },
  })

  useEffect(() => {
    if (open) reset({ name: "", shared: false })
  }, [open, reset])

  const shared = watch("shared")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="saved-view-save-dialog">
        <DialogHeader>
          <DialogTitle>Save current view</DialogTitle>
          <DialogDescription>
            Capture the current filter, sort and pagination state as a named
            segment you can re-apply later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="saved-view-name">Name</Label>
            <Input
              id="saved-view-name"
              type="text"
              placeholder="High-priority 404s"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              data-testid="saved-view-name-input"
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="saved-view-shared">Share with workspace</Label>
              <p className="text-xs text-muted-foreground">
                Other members can apply this segment but only you can edit it.
              </p>
            </div>
            <Switch
              id="saved-view-shared"
              checked={shared}
              onCheckedChange={(v) =>
                setValue("shared", Boolean(v), { shouldDirty: true })
              }
              data-testid="saved-view-shared-toggle"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              data-testid="saved-view-save-submit"
            >
              {pending ? "Saving..." : "Save view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit dialog: rename + flip shared toggle on an owned view.
// ---------------------------------------------------------------------------

type EditDialogProps = {
  view: SavedView | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (view: SavedView, patch: UpdateSavedViewInput) => void
}

function EditDialog({ view, pending, onOpenChange, onSubmit }: EditDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SaveValues>({
    resolver: zodResolver(saveSchema),
    defaultValues: { name: "", shared: false },
  })

  useEffect(() => {
    if (view) reset({ name: view.name, shared: view.shared })
  }, [view, reset])

  const shared = watch("shared")
  const open = view !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="saved-view-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit saved view</DialogTitle>
          <DialogDescription>
            Rename or toggle workspace sharing. The captured filters stay the
            same.
          </DialogDescription>
        </DialogHeader>
        {view ? (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              onSubmit(view, { name: values.name, shared: values.shared }),
            )}
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="saved-view-edit-name">Name</Label>
              <Input
                id="saved-view-edit-name"
                type="text"
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                data-testid="saved-view-edit-name-input"
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="saved-view-edit-shared">
                  Share with workspace
                </Label>
              </div>
              <Switch
                id="saved-view-edit-shared"
                checked={shared}
                onCheckedChange={(v) =>
                  setValue("shared", Boolean(v), { shouldDirty: true })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                data-testid="saved-view-edit-submit"
              >
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
