// Reusable invite-member dialog (plan section 14.2 / phase 3 iter 1).
// Mounted from both the Members tab and the Invites tab on /t/:tenantId/team.
//
// React Hook Form + Zod for client-side validation. On submit we call
// createInvite(tenantId, {email, role}); the role select intentionally
// omits OWNER (transfer-ownership has its own confirmation flow).
//
// Server-error handling:
//   - 409: pending invite already exists for this email -> inline error.
//   - 403/409 with a "seat" hint: the BE returns either status when the
//     plan's seat cap is reached. We surface a "Your plan's seat limit is
//     reached. Upgrade in Billing." prompt that links to /t/{tenantId}/billing.
//   - Anything else: generic retry hint.

import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type { Role, TenantInvite } from "@/api/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** OWNER is intentionally not selectable here; promotion to OWNER is a
 *  separate transfer-ownership flow with its own confirmation. */
const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
})

type InviteValues = z.infer<typeof schema>

export type InviteMemberDialogProps = {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires after a successful create so the caller can invalidate the
   *  invites query and re-fetch. */
  onCreated?: (invite: TenantInvite) => void
}

/** Heuristic: the BE may return either 403 or 409 when the plan's seat cap
 *  is reached. We treat any of these signals as the seat-cap path:
 *  - status 403, OR
 *  - status 409 with an error body whose message hints at seat / plan / limit. */
function isSeatCap(status: number, body: unknown): boolean {
  if (status === 403) return true
  if (status !== 409) return false
  const msg =
    typeof body === "string"
      ? body
      : typeof (body as { message?: string } | null)?.message === "string"
        ? ((body as { message: string }).message)
        : ""
  return /seat|plan|limit|upgrade/i.test(msg)
}

export function InviteMemberDialog({
  tenantId,
  open,
  onOpenChange,
  onCreated,
}: InviteMemberDialogProps) {
  const client = useApiClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [seatCapHit, setSeatCapHit] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "EDITOR" },
  })

  // Reset the form + error state every time the dialog opens so a previous
  // attempt's seat-cap message doesn't leak across opens.
  useEffect(() => {
    if (open) {
      setServerError(null)
      setSeatCapHit(false)
      reset({ email: "", role: "EDITOR" })
    }
  }, [open, reset])

  const createMut = useMutation({
    mutationFn: (input: InviteValues) =>
      client.createInvite(tenantId, input),
    onSuccess: (invite) => {
      toast.success(`Invitation sent to ${invite.email}`)
      onCreated?.(invite)
      onOpenChange(false)
    },
    onError: (e) => {
      if (isApiError(e)) {
        if (e.status === 409 && !isSeatCap(e.status, e.body)) {
          setError("email", {
            type: "server",
            message:
              "There's already a pending invite for this email.",
          })
          return
        }
        if (isSeatCap(e.status, e.body)) {
          setSeatCapHit(true)
          return
        }
      }
      setServerError("Could not send invitation. Please try again.")
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    setSeatCapHit(false)
    createMut.mutate(values)
  })

  const role = watch("role")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="invite-member-dialog">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They'll receive an email with a link to accept and join this
            workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              data-testid="invite-email-input"
              {...register("email")}
            />
            {errors.email ? (
              <p
                className="text-xs text-destructive"
                data-testid="invite-email-error"
              >
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) =>
                setValue("role", v as Role as "ADMIN" | "EDITOR" | "VIEWER", {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="invite-role" data-testid="invite-role-trigger">
                <SelectValue placeholder="Select a role" />
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

          {seatCapHit ? (
            <div
              className="rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
              data-testid="invite-seat-cap"
            >
              Your plan's seat limit is reached.{" "}
              <Link
                to={`/t/${tenantId}/billing`}
                className="font-medium underline underline-offset-2"
              >
                Upgrade in Billing
              </Link>
              .
            </div>
          ) : null}

          {serverError ? (
            <p className="text-xs text-destructive">{serverError}</p>
          ) : null}

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
              disabled={isSubmitting || createMut.isPending}
              data-testid="invite-submit"
            >
              {createMut.isPending || isSubmitting
                ? "Sending..."
                : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
