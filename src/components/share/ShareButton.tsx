// Reusable share-link button (plan section P3 iter 2 FE-B). Mounts next to
// the existing CSV export button on every report and on the SiteDetail
// header. Clicking opens a Dialog with:
//
//   - Optional label input ("Q3 audit for client X")
//   - Optional password (with show/hide toggle)
//   - Optional expiry: Never / 24h / 7d / 30d / Custom date picker
//   - Plan-aware footer: "X of Y share links used" when the BE returns plan
//     gating info on the created link.
//
// On submit we call createShareLink() with the supplied scope/target/sub-
// resource. On success the dialog flips to a "Copy this link" view with a
// copy-to-clipboard button + a "Manage all share links" link to
// /t/:tenantId/settings -> Sharing tab.
//
// Hidden when useReadOnly() is true (the public /shared/:token route mounts
// the same reports under a ReadOnlyProvider; recipients must not be able to
// re-share what they already have).

import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  Share2Icon,
} from "lucide-react"
import { useApiClient } from "@/api/useApiClient"
import { useReadOnly } from "@/components/share/ReadOnlyContext"
import type {
  CreateShareLinkInput,
  ShareLink,
  ShareScope,
  ShareSubResource,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ShareButtonProps = {
  scope: ShareScope
  targetId: string
  subResource?: ShareSubResource
  /** Optional override for the trigger button label. Defaults to "Share". */
  label?: string
}

type ExpiryPreset = "never" | "24h" | "7d" | "30d" | "custom"

const EXPIRY_OPTIONS: Array<{ value: ExpiryPreset; label: string }> = [
  { value: "never", label: "Never" },
  { value: "24h", label: "In 24 hours" },
  { value: "7d", label: "In 7 days" },
  { value: "30d", label: "In 30 days" },
  { value: "custom", label: "Custom date" },
]

function expiryToIso(
  preset: ExpiryPreset,
  customDate: string,
): string | null {
  if (preset === "never") return null
  if (preset === "custom") {
    if (!customDate) return null
    const d = new Date(customDate)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }
  const days = preset === "24h" ? 1 : preset === "7d" ? 7 : 30
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
}

export function ShareButton({
  scope,
  targetId,
  subResource,
  label = "Share",
}: ShareButtonProps) {
  const readOnly = useReadOnly()
  const { tenantId = "default" } = useParams<{ tenantId: string }>()
  const client = useApiClient()

  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<ShareLink | null>(null)
  const [labelInput, setLabelInput] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [expiry, setExpiry] = useState<ExpiryPreset>("never")
  const [customDate, setCustomDate] = useState("")
  const [copied, setCopied] = useState(false)

  // Reset every time the dialog re-opens so a previous create's "copy this
  // link" view doesn't leak across opens.
  useEffect(() => {
    if (open) {
      setCreated(null)
      setLabelInput("")
      setPassword("")
      setShowPassword(false)
      setExpiry("never")
      setCustomDate("")
      setCopied(false)
    }
  }, [open])

  const createMut = useMutation({
    mutationFn: (input: CreateShareLinkInput) =>
      client.createShareLink(tenantId, input),
    onSuccess: (link) => {
      setCreated(link)
    },
    onError: () => {
      toast.error("Could not create share link")
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const expiresAt = expiryToIso(expiry, customDate)
    createMut.mutate({
      scope,
      targetId,
      subResource: subResource ?? undefined,
      password: password.trim().length > 0 ? password : undefined,
      expiresAt,
      label: labelInput.trim().length > 0 ? labelInput.trim() : undefined,
    })
  }

  const onCopy = async () => {
    if (!created?.url) return
    try {
      await navigator.clipboard.writeText(created.url)
      setCopied(true)
      toast.success("Link copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  if (readOnly) return null

  // Under the credit-based billing model share links are unlimited (the BE
  // reports planLimit=Integer.MAX_VALUE as the sentinel). We hide the
  // "X of Y share links used" footer and just show a usage count.
  const SHARE_LINKS_UNLIMITED = 2_147_483_647
  const showPlanFooter =
    created?.planLimit != null
    && created.planUsed != null
    && created.planLimit < SHARE_LINKS_UNLIMITED

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="share-button"
      >
        <Share2Icon />
        <span>{label}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="share-dialog">
          {!created ? (
            <>
              <DialogHeader>
                <DialogTitle>Share a read-only link</DialogTitle>
                <DialogDescription>
                  Anyone with the link can view this report. Add a password
                  or expiry to keep it locked down.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onSubmit} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="share-label">Label (optional)</Label>
                  <Input
                    id="share-label"
                    type="text"
                    placeholder="Q3 audit for client X"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    data-testid="share-label-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="share-password">Password (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="share-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Leave empty for no password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      data-testid="share-password-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      data-testid="share-password-toggle"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="share-expiry">Expires</Label>
                  <Select
                    value={expiry}
                    onValueChange={(v) => setExpiry(v as ExpiryPreset)}
                  >
                    <SelectTrigger id="share-expiry" data-testid="share-expiry-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {expiry === "custom" ? (
                    <Input
                      id="share-expiry-custom"
                      type="date"
                      className="mt-2"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      data-testid="share-expiry-custom"
                    />
                  ) : null}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMut.isPending}
                    data-testid="share-submit"
                  >
                    {createMut.isPending ? "Creating..." : "Create link"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Copy this link</DialogTitle>
                <DialogDescription>
                  Share it with anyone who needs read-only access. You can
                  revoke it later from the Sharing tab in workspace settings.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="share-url">Share URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="share-url"
                      type="text"
                      readOnly
                      value={created.url}
                      onFocus={(e) => e.currentTarget.select()}
                      data-testid="share-url-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onCopy}
                      aria-label="Copy share URL"
                      data-testid="share-copy-button"
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </div>
                </div>
                {created.label ? (
                  <p className="text-xs text-muted-foreground">
                    Labelled <span className="font-medium">{created.label}</span>
                  </p>
                ) : null}
                {created.passwordProtected ? (
                  <p className="text-xs text-muted-foreground">
                    Password-protected. Share the password with the recipient
                    out-of-band.
                  </p>
                ) : null}
                {created.expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    Expires{" "}
                    <span className="font-medium">
                      {new Date(created.expiresAt).toLocaleString()}
                    </span>
                    .
                  </p>
                ) : null}
                {showPlanFooter ? (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="share-plan-footer"
                  >
                    {created.planUsed} of {created.planLimit} share links used
                    on this plan.
                  </p>
                ) : null}
                <p className="text-xs">
                  <Link
                    to={`/t/${tenantId}/settings?tab=sharing`}
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Manage all share links
                  </Link>
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-testid="share-done-button"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
