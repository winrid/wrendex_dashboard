// Two-factor authentication setup + management. Plan section P4 iter 2.
//
// Bound to client.get2faStatus / setup2fa / verify2fa / disable2fa. Surfaces
// two top-level states:
//
//   - Disabled: a card with an "Enable" button that opens a 3-step wizard
//     (intro -> QR + secret -> verify code -> backup codes).
//   - Enabled: a card showing the enabledAt date + remaining backup-code
//     count, plus a "Disable 2FA" button that opens a confirmation dialog.
//
// QR rendering uses the `qrcode` package's toDataURL helper; we render the
// resulting PNG via an <img> so it stays scalable and survives copy/save.

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import QRCode from "qrcode"
import { toast } from "sonner"
import { isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type {
  Setup2faResponse,
  TwoFactorStatus,
  Verify2faResponse,
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

type WizardStep = "intro" | "scan" | "verify" | "backup-codes"

export function TwoFactorSection() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  const statusQ = useQuery<TwoFactorStatus>({
    queryKey: ["2fa-status"],
    queryFn: () => client.get2faStatus(),
    retry: false,
  })

  const [wizardOpen, setWizardOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  const isEnabled = statusQ.data?.enabled === true

  return (
    <>
      <Card data-testid="two-factor-card">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Add a one-time code from your authenticator app to every sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : isEnabled ? (
            <div className="space-y-2" data-testid="two-factor-on">
              <p className="text-sm">
                Two-factor authentication is{" "}
                <span className="font-medium text-foreground">ON</span>
                {statusQ.data?.enabledAt
                  ? `, enabled ${new Date(
                      statusQ.data.enabledAt,
                    ).toLocaleDateString()}`
                  : null}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                {statusQ.data?.backupCodesRemaining ?? 0} backup code
                {(statusQ.data?.backupCodesRemaining ?? 0) === 1 ? "" : "s"}{" "}
                remaining.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableOpen(true)}
                  data-testid="two-factor-disable-open"
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2" data-testid="two-factor-off">
              <p className="text-sm">
                Two-factor authentication is{" "}
                <span className="font-medium text-foreground">OFF</span>.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setWizardOpen(true)}
                data-testid="two-factor-enable"
              >
                Enable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {wizardOpen ? (
        <SetupWizard
          onClose={(verified) => {
            setWizardOpen(false)
            if (verified) {
              void queryClient.invalidateQueries({ queryKey: ["2fa-status"] })
            }
          }}
        />
      ) : null}

      {disableOpen ? (
        <DisableDialog
          onClose={(disabled) => {
            setDisableOpen(false)
            if (disabled) {
              void queryClient.invalidateQueries({ queryKey: ["2fa-status"] })
            }
          }}
        />
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Wizard: intro -> scan QR -> verify code -> backup codes
// ---------------------------------------------------------------------------

function SetupWizard({ onClose }: { onClose: (verified: boolean) => void }) {
  const client = useApiClient()
  const [step, setStep] = useState<WizardStep>("intro")
  const [setupData, setSetupData] = useState<Setup2faResponse | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [verified, setVerified] = useState(false)

  const setupMut = useMutation({
    mutationFn: () => client.setup2fa(),
    onSuccess: async (data) => {
      setSetupData(data)
      try {
        const url = await QRCode.toDataURL(data.otpauthUrl, {
          width: 220,
          margin: 1,
        })
        setQrDataUrl(url)
      } catch {
        // If QR rendering fails the user can still type the secret manually.
        setQrDataUrl(null)
      }
      setStep("scan")
    },
    onError: () => {
      toast.error("Could not start 2FA setup. Please try again.")
    },
  })

  const verifyMut = useMutation({
    mutationFn: (c: string) => client.verify2fa(c),
    onSuccess: (data: Verify2faResponse) => {
      setBackupCodes(data.backupCodes)
      setVerified(true)
      setStep("backup-codes")
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 401) {
        setVerifyError("That code is incorrect. Try again.")
      } else {
        setVerifyError("Something went wrong. Please try again.")
      }
    },
  })

  const handleContinueIntro = () => {
    setupMut.mutate()
  }

  const handleVerifySubmit = () => {
    setVerifyError(null)
    const trimmed = code.trim()
    if (trimmed.length !== 6 || !/^[0-9]{6}$/.test(trimmed)) {
      setVerifyError("Enter the 6-digit code from your authenticator.")
      return
    }
    verifyMut.mutate(trimmed)
  }

  const copyAllCodes = () => {
    if (!backupCodes) return
    void navigator.clipboard
      ?.writeText(backupCodes.join("\n"))
      .then(() => toast.success("Backup codes copied"))
      .catch(() => toast.error("Could not copy codes"))
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(verified)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="two-factor-wizard"
      >
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>
            {step === "intro"
              ? "Use an authenticator app like 1Password, Authy, or Google Authenticator to generate sign-in codes."
              : step === "scan"
                ? "Scan the QR code with your authenticator app, or paste the secret manually."
                : step === "verify"
                  ? "Enter the 6-digit code your authenticator app shows for Wrendex."
                  : "Save these backup codes somewhere safe. Each works once if you lose access to your authenticator."}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" ? (
          <div className="space-y-3 text-sm">
            <p>
              We'll show a QR code on the next screen. Scan it, then enter the
              6-digit code your app generates to finish enrolment.
            </p>
            <p className="text-muted-foreground">
              You'll also receive 10 single-use backup codes in case you lose
              access to your authenticator.
            </p>
          </div>
        ) : null}

        {step === "scan" && setupData ? (
          <div className="space-y-3 text-sm">
            {qrDataUrl ? (
              <div className="flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="Authenticator QR code"
                  className="rounded border bg-white p-2"
                  data-testid="two-factor-qr"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                Could not render the QR code. Use the secret below to add this
                account manually.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="two-factor-secret">Secret</Label>
              <Input
                id="two-factor-secret"
                readOnly
                value={setupData.secret}
                className="font-mono"
                data-testid="two-factor-secret"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          </div>
        ) : null}

        {step === "verify" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="two-factor-verify-code">6-digit code</Label>
              <Input
                id="two-factor-verify-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setVerifyError(null)
                }}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                data-testid="two-factor-verify-code"
                aria-invalid={verifyError ? true : undefined}
              />
              {verifyError ? (
                <p
                  className="text-xs text-destructive"
                  data-testid="two-factor-verify-error"
                >
                  {verifyError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "backup-codes" && backupCodes ? (
          <div className="space-y-3">
            <ul
              className="grid grid-cols-2 gap-1 rounded border bg-muted/40 p-3 font-mono text-xs"
              data-testid="two-factor-backup-codes"
            >
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyAllCodes}
              data-testid="two-factor-copy-codes"
            >
              Copy all
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {step === "intro" ? (
            <Button
              type="button"
              onClick={handleContinueIntro}
              disabled={setupMut.isPending}
              data-testid="two-factor-continue"
            >
              {setupMut.isPending ? "Loading..." : "Continue"}
            </Button>
          ) : null}
          {step === "scan" ? (
            <Button
              type="button"
              onClick={() => setStep("verify")}
              data-testid="two-factor-scanned"
            >
              Next
            </Button>
          ) : null}
          {step === "verify" ? (
            <Button
              type="button"
              onClick={handleVerifySubmit}
              disabled={verifyMut.isPending}
              data-testid="two-factor-verify-submit"
            >
              {verifyMut.isPending ? "Verifying..." : "Verify"}
            </Button>
          ) : null}
          {step === "backup-codes" ? (
            <Button
              type="button"
              onClick={() => onClose(true)}
              data-testid="two-factor-saved"
            >
              I've saved these
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Disable dialog: TOTP or backup code; on success toasts + closes.
// ---------------------------------------------------------------------------

function DisableDialog({ onClose }: { onClose: (disabled: boolean) => void }) {
  const client = useApiClient()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  useEffect(() => () => setCode(""), [])

  const disableMut = useMutation({
    mutationFn: (c: string) => client.disable2fa(c),
    onSuccess: () => {
      setDisabled(true)
      toast.success("Two-factor authentication disabled")
      onClose(true)
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 401) {
        setError("That code is incorrect.")
      } else {
        setError("Could not disable 2FA. Please try again.")
      }
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = code.trim()
    if (!trimmed) {
      setError("Enter your 6-digit code or an 8-character backup code.")
      return
    }
    disableMut.mutate(trimmed)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(disabled)
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        data-testid="two-factor-disable-dialog"
      >
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Enter a current 6-digit authenticator code or an 8-character
            backup code to confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="two-factor-disable-code">Code</Label>
            <Input
              id="two-factor-disable-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError(null)
              }}
              autoFocus
              autoComplete="one-time-code"
              data-testid="two-factor-disable-code"
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <p
                className="text-xs text-destructive"
                data-testid="two-factor-disable-error"
              >
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={disableMut.isPending}
              data-testid="two-factor-disable-submit"
            >
              {disableMut.isPending ? "Disabling..." : "Disable 2FA"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
