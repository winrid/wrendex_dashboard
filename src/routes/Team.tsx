// Team page (plan section 14.2; phase 3 iter 1 FE).
//
// Tabs: Members | Invites | Audit log. Each tab is a DataTable bound to
// the typed-client surface added in this iteration:
//
//   Members   - listTenantMembers + per-row dropdown for change-role,
//               remove, and (when the current user is OWNER) make-owner.
//               The sole-OWNER guard disables actions that would leave the
//               tenant ownerless.
//   Invites   - listTenantInvites; per-row resend + revoke. Resend may be
//               unavailable (the BE endpoint is documented as optional in
//               AGENTS.md); the FE soft-fails on 404 with a toast.
//   Audit log - listAuditLog; filters for action + a since-window preset.
//
// All mutations route through useApiClient(); state belongs to react-query
// (sole source of truth). The InviteMemberDialog is reused from the Members
// and Invites tabs.

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import {
  ChevronDownIcon,
  MoreHorizontalIcon,
  ShieldIcon,
  UserMinusIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import { useAuth } from "@/auth/AuthProvider"
import type {
  AuditAction,
  AuditLogEntry,
  Role,
  TenantInvite,
  TenantMember,
} from "@/api/types"
import { DataTable } from "@/components/data-table/DataTable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge-fallback"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]

function roleBadgeClasses(role: Role): string {
  switch (role) {
    case "OWNER":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "ADMIN":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    case "EDITOR":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "VIEWER":
      return "bg-muted text-muted-foreground"
  }
}

function actionBadgeClasses(action: AuditAction): string {
  if (typeof action !== "string") return "bg-muted text-muted-foreground"
  if (action.startsWith("INVITE_"))
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  if (action.startsWith("MEMBER_") || action === "OWNERSHIP_TRANSFERRED")
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  if (action.startsWith("SITE_"))
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  return "bg-muted text-muted-foreground"
}

// ---------------------------------------------------------------------------
// Members tab
// ---------------------------------------------------------------------------

function MembersTab({
  tenantId,
  onInvite,
}: {
  tenantId: string
  onInvite: () => void
}) {
  const client = useApiClient()
  const auth = useAuth()
  const queryClient = useQueryClient()

  const membersQ = useQuery<TenantMember[]>({
    queryKey: ["tenant-members", tenantId],
    queryFn: () => client.listTenantMembers(tenantId),
    enabled: Boolean(tenantId),
  })

  const members = membersQ.data ?? []
  const ownerCount = members.filter((m) => m.role === "OWNER").length
  const currentUserId = auth.user?.id ?? null
  const currentUserMembership = members.find((m) => m.userId === currentUserId)
  const currentUserIsOwner = currentUserMembership?.role === "OWNER"

  // Per-row dialog state. A single piece of state covers the three actions
  // since only one is open at a time.
  const [roleTarget, setRoleTarget] = useState<TenantMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TenantMember | null>(null)
  const [transferTarget, setTransferTarget] = useState<TenantMember | null>(
    null,
  )

  const updateRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      client.updateMemberRole(tenantId, userId, { role }),
    onSuccess: () => {
      toast.success("Role updated")
      void queryClient.invalidateQueries({
        queryKey: ["tenant-members", tenantId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["tenant-audit-log", tenantId],
      })
      setRoleTarget(null)
    },
    onError: () => toast.error("Could not update role"),
  })

  const removeMut = useMutation({
    mutationFn: (userId: string) => client.removeMember(tenantId, userId),
    onSuccess: () => {
      toast.success("Member removed")
      void queryClient.invalidateQueries({
        queryKey: ["tenant-members", tenantId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["tenant-audit-log", tenantId],
      })
      setRemoveTarget(null)
    },
    onError: () => toast.error("Could not remove member"),
  })

  const transferMut = useMutation({
    mutationFn: (newOwnerUserId: string) =>
      client.transferOwnership(tenantId, { newOwnerUserId }),
    onSuccess: () => {
      toast.success("Ownership transferred")
      void queryClient.invalidateQueries({
        queryKey: ["tenant-members", tenantId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["tenant-audit-log", tenantId],
      })
      setTransferTarget(null)
    },
    onError: () => toast.error("Could not transfer ownership"),
  })

  const columns = useMemo<ColumnDef<TenantMember>[]>(
    () => [
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.email}</span>
        ),
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge className={cn(roleBadgeClasses(row.original.role))}>
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: "joined",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground" title={row.original.joinedAt}>
            {relativeTime(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "lastSeen",
        header: "Last seen",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground"
            title={row.original.lastSeenAt ?? undefined}
          >
            {relativeTime(row.original.lastSeenAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const m = row.original
          const isSoleOwner = m.role === "OWNER" && ownerCount <= 1
          const isCurrentUser = currentUserId === m.userId
          // Cannot remove or change the role of the sole OWNER.
          const disableRoleChange = isSoleOwner
          const disableRemove = isSoleOwner
          // Make-owner only available to OWNERs and only against non-OWNERs.
          const canMakeOwner =
            currentUserIsOwner && m.role !== "OWNER" && !isCurrentUser
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${m.email}`}
                  data-testid={`member-actions-${m.userId}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Manage member</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={disableRoleChange}
                  onSelect={() => setRoleTarget(m)}
                  data-testid={`member-change-role-${m.userId}`}
                >
                  Change role
                </DropdownMenuItem>
                {canMakeOwner ? (
                  <DropdownMenuItem
                    onSelect={() => setTransferTarget(m)}
                    data-testid={`member-make-owner-${m.userId}`}
                  >
                    <ShieldIcon className="mr-2 size-3.5" />
                    Make owner
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={disableRemove}
                  onSelect={() => setRemoveTarget(m)}
                  className="text-destructive focus:text-destructive"
                  data-testid={`member-remove-${m.userId}`}
                >
                  <UserMinusIcon className="mr-2 size-3.5" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [ownerCount, currentUserId, currentUserIsOwner],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          People with access to this workspace.
        </p>
        <Button size="sm" onClick={onInvite} data-testid="members-invite-button">
          Invite member
        </Button>
      </div>
      <DataTable<TenantMember>
        columns={columns}
        data={members}
        isLoading={membersQ.isLoading}
        emptyState={
          membersQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load members.
            </span>
          ) : (
            "No members yet."
          )
        }
      />

      <ChangeRoleDialog
        member={roleTarget}
        onOpenChange={(o) => !o && setRoleTarget(null)}
        onConfirm={(role) =>
          roleTarget &&
          updateRoleMut.mutate({ userId: roleTarget.userId, role })
        }
        pending={updateRoleMut.isPending}
      />

      <AlertDialog
        open={removeTarget != null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.email} will lose access to this workspace
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (removeTarget) removeMut.mutate(removeTarget.userId)
              }}
              data-testid="member-remove-confirm"
            >
              {removeMut.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={transferTarget != null}
        onOpenChange={(o) => !o && setTransferTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {transferTarget?.email} will become the new OWNER. You'll be
              demoted to ADMIN. This cannot be undone without their cooperation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (transferTarget) transferMut.mutate(transferTarget.userId)
              }}
              data-testid="member-transfer-confirm"
            >
              {transferMut.isPending ? "Transferring..." : "Transfer ownership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ChangeRoleDialog({
  member,
  onOpenChange,
  onConfirm,
  pending,
}: {
  member: TenantMember | null
  onOpenChange: (open: boolean) => void
  onConfirm: (role: Role) => void
  pending: boolean
}) {
  const [role, setRole] = useState<Role>("EDITOR")
  // Sync local state to the incoming member so opening the dialog for a
  // second row starts from that row's current role. useEffect is the right
  // home for "mirror prop into state" -- the previous useMemo() form was a
  // setState-in-render bug (useMemo runs synchronously during render).
  useEffect(() => {
    if (member && ASSIGNABLE_ROLES.includes(member.role)) {
      setRole(member.role)
    } else if (member) {
      setRole("EDITOR")
    }
  }, [member])

  return (
    <Dialog open={member != null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="change-role-dialog">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            Pick a new role for {member?.email}. OWNER is set via the transfer-
            ownership flow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="change-role-select">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger
              id="change-role-select"
              data-testid="change-role-trigger"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(role)}
            disabled={pending}
            data-testid="change-role-confirm"
          >
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Invites tab
// ---------------------------------------------------------------------------

function InvitesTab({
  tenantId,
  onInvite,
}: {
  tenantId: string
  onInvite: () => void
}) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const invitesQ = useQuery<TenantInvite[]>({
    queryKey: ["tenant-invites", tenantId],
    queryFn: () => client.listTenantInvites(tenantId),
    enabled: Boolean(tenantId),
  })

  const invites = invitesQ.data ?? []

  const resendMut = useMutation({
    mutationFn: (inviteId: string) => client.resendInvite(tenantId, inviteId),
    onSuccess: () => {
      toast.success("Invitation re-sent")
      // The BE re-enqueues the email AND emits an INVITE_RESENT audit row;
      // refresh both surfaces so the user sees the new event immediately.
      void queryClient.invalidateQueries({
        queryKey: ["tenant-invites", tenantId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["tenant-audit-log", tenantId],
      })
    },
    onError: () => toast.error("Could not resend invitation"),
  })

  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => client.revokeInvite(tenantId, inviteId),
    onSuccess: () => {
      toast.success("Invitation revoked")
      void queryClient.invalidateQueries({
        queryKey: ["tenant-invites", tenantId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["tenant-audit-log", tenantId],
      })
    },
    onError: () => toast.error("Could not revoke invitation"),
  })

  const columns = useMemo<ColumnDef<TenantInvite>[]>(
    () => [
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.email}</span>
        ),
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge className={cn(roleBadgeClasses(row.original.role))}>
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: "invitedBy",
        header: "Invited by",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.invitedByEmail}
          </span>
        ),
      },
      {
        id: "expires",
        header: "Expires",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground" title={row.original.expiresAt}>
            {relativeTime(row.original.expiresAt)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: () => (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Pending
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resendMut.isPending}
              onClick={() => resendMut.mutate(row.original.id)}
              data-testid={`invite-resend-${row.original.id}`}
            >
              Resend
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={revokeMut.isPending}
              onClick={() => revokeMut.mutate(row.original.id)}
              data-testid={`invite-revoke-${row.original.id}`}
            >
              Revoke
            </Button>
          </div>
        ),
      },
    ],
    [resendMut, revokeMut],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pending invitations to join this workspace.
        </p>
        <Button size="sm" onClick={onInvite} data-testid="invites-invite-button">
          Invite member
        </Button>
      </div>
      <DataTable<TenantInvite>
        columns={columns}
        data={invites}
        isLoading={invitesQ.isLoading}
        emptyState={
          invitesQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load invitations.
            </span>
          ) : (
            "No pending invitations."
          )
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit-log tab
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS: AuditAction[] = [
  "INVITE_CREATED",
  "INVITE_REVOKED",
  "INVITE_ACCEPTED",
  "INVITE_RESENT",
  "MEMBER_ROLE_CHANGED",
  "MEMBER_REMOVED",
  "OWNERSHIP_TRANSFERRED",
  "SITE_CREATED",
  "SITE_DELETED",
]

type SincePreset = "1d" | "7d" | "30d" | "all"
const SINCE_LABEL: Record<SincePreset, string> = {
  "1d": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
}
function sinceIso(preset: SincePreset): string | undefined {
  if (preset === "all") return undefined
  const days = preset === "1d" ? 1 : preset === "7d" ? 7 : 30
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

function describeTarget(entry: AuditLogEntry): string {
  if (entry.targetType && entry.targetId) {
    return `${entry.targetType}:${entry.targetId}`
  }
  if (entry.targetType) return entry.targetType
  // Fall back to a one-line summary of the details bag if no explicit target.
  if (entry.details && Object.keys(entry.details).length > 0) {
    const parts: string[] = []
    for (const [k, v] of Object.entries(entry.details)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        parts.push(`${k}=${v}`)
      }
    }
    if (parts.length > 0) return parts.join(" ")
  }
  return "-"
}

function AuditLogTab({ tenantId }: { tenantId: string }) {
  const client = useApiClient()

  const [page, setPage] = useState(0)
  const [size] = useState(25)
  const [action, setAction] = useState<AuditAction | null>(null)
  const [since, setSince] = useState<SincePreset>("7d")

  const params = useMemo(
    () => ({
      page,
      size,
      action: action ?? undefined,
      since: sinceIso(since),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, size, action, since],
  )

  const auditQ = useQuery({
    queryKey: ["tenant-audit-log", tenantId, params],
    queryFn: () => client.listAuditLog(tenantId, params),
    enabled: Boolean(tenantId),
  })

  const items = auditQ.data?.items ?? []
  const total = auditQ.data?.total ?? 0

  const columns = useMemo<ColumnDef<AuditLogEntry>[]>(
    () => [
      {
        id: "createdAt",
        header: "When",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground" title={row.original.createdAt}>
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.actorEmail ?? "system"}
          </span>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <Badge className={cn(actionBadgeClasses(row.original.action))}>
            {String(row.original.action)}
          </Badge>
        ),
      },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {describeTarget(row.original)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Action filter"
              data-testid="audit-action-filter"
            >
              Action
              {action ? (
                <span className="ml-1 rounded bg-muted px-1 text-xs tabular-nums">
                  {action}
                </span>
              ) : null}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Action</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setAction(null)
                setPage(0)
              }}
            >
              All actions
            </DropdownMenuItem>
            {AUDIT_ACTIONS.map((a) => (
              <DropdownMenuItem
                key={a}
                onSelect={() => {
                  setAction(a)
                  setPage(0)
                }}
              >
                {a}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Since filter">
              {SINCE_LABEL[since]}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Since</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={since}
              onValueChange={(v) => {
                setSince(v as SincePreset)
                setPage(0)
              }}
            >
              {(Object.keys(SINCE_LABEL) as SincePreset[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {SINCE_LABEL[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable<AuditLogEntry>
        columns={columns}
        data={items}
        rowCount={total}
        pagination={{ pageIndex: page, pageSize: size }}
        onPaginationChange={(updater) => {
          const next =
            typeof updater === "function"
              ? updater({ pageIndex: page, pageSize: size })
              : updater
          setPage(next.pageIndex)
        }}
        isLoading={auditQ.isLoading}
        emptyState={
          auditQ.isError ? (
            <span className="text-red-600 dark:text-red-400">
              Could not load audit log.
            </span>
          ) : (
            "No matching events."
          )
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function Team() {
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"members" | "invites" | "audit">("members")
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Members, pending invitations, and audit log for this workspace.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/t/${tenantId}/billing`}>Billing</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">
            Members
          </TabsTrigger>
          <TabsTrigger value="invites" data-testid="tab-invites">
            Invites
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            Audit log
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <MembersTab
            tenantId={tenantId}
            onInvite={() => setInviteOpen(true)}
          />
        </TabsContent>
        <TabsContent value="invites" className="mt-4">
          <InvitesTab
            tenantId={tenantId}
            onInvite={() => setInviteOpen(true)}
          />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        tenantId={tenantId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={() => {
          // After a successful create, both tabs should re-fetch so the
          // user sees the new pending row immediately, plus the audit log.
          void queryClient.invalidateQueries({
            queryKey: ["tenant-invites", tenantId],
          })
          void queryClient.invalidateQueries({
            queryKey: ["tenant-audit-log", tenantId],
          })
        }}
      />
    </div>
  )
}
