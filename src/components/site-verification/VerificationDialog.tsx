// Site ownership verification dialog (plan section 1.2 step 6).
// Wraps the typed client's requestSiteVerification + confirmSiteVerification
// in a tabbed UI that lets the user pick DNS_TXT or META_TAG, generate a
// token, copy the instructions, and trigger a re-check.
//
// We keep the request state local to the dialog instead of in a parent so
// dismissing + reopening rolls back to a clean slate. The confirm-success
// flow invalidates the calling site list query via the onVerified callback.

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import type {
  SiteVerificationConfirmation,
  SiteVerificationMethod,
  SiteVerificationResponse,
} from "@/api/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CopyIcon, CheckIcon } from "lucide-react"

export type VerificationDialogProps = {
  siteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful confirm so the caller can invalidate queries
   *  (Sites list, SiteDetail header) so the verified badge updates. */
  onVerified?: () => void
}

type MethodState = {
  loading: boolean
  response: SiteVerificationResponse | null
  notFoundYet: boolean
}

const EMPTY_STATE: MethodState = {
  loading: false,
  response: null,
  notFoundYet: false,
}

function CopyableBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-10 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {text}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1.5 right-1.5"
        onClick={onCopy}
        aria-label="Copy to clipboard"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

export function VerificationDialog({
  siteId,
  open,
  onOpenChange,
  onVerified,
}: VerificationDialogProps) {
  const client = useApiClient()
  const [method, setMethod] = useState<SiteVerificationMethod>("DNS_TXT")
  const [dns, setDns] = useState<MethodState>(EMPTY_STATE)
  const [meta, setMeta] = useState<MethodState>(EMPTY_STATE)

  const requestMut = useMutation({
    mutationFn: async (m: SiteVerificationMethod) =>
      client.requestSiteVerification(siteId, { method: m }),
  })

  const confirmMut = useMutation({
    mutationFn: async () => client.confirmSiteVerification(siteId),
  })

  const stateFor = (m: SiteVerificationMethod) => (m === "DNS_TXT" ? dns : meta)
  const setStateFor = (m: SiteVerificationMethod, next: MethodState) => {
    if (m === "DNS_TXT") setDns(next)
    else setMeta(next)
  }

  const onGenerate = async (m: SiteVerificationMethod) => {
    setStateFor(m, { ...stateFor(m), loading: true, notFoundYet: false })
    try {
      const res = await requestMut.mutateAsync(m)
      setStateFor(m, { loading: false, response: res, notFoundYet: false })
    } catch {
      setStateFor(m, { ...stateFor(m), loading: false })
      toast.error("Could not generate verification token")
    }
  }

  const onCheck = async () => {
    try {
      const res: SiteVerificationConfirmation = await confirmMut.mutateAsync()
      if (res.verified) {
        toast.success("Site verified")
        onVerified?.()
        onOpenChange(false)
        // Reset on close so the next open is clean.
        setDns(EMPTY_STATE)
        setMeta(EMPTY_STATE)
      } else {
        const m = method
        setStateFor(m, { ...stateFor(m), notFoundYet: true })
      }
    } catch {
      toast.error("Could not verify ownership")
    }
  }

  const renderTab = (m: SiteVerificationMethod) => {
    const state = stateFor(m)
    return (
      <div className="space-y-3">
        {state.response ? (
          <>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Token
              </div>
              <CopyableBlock text={state.response.token} />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Instructions
              </div>
              <CopyableBlock text={state.response.instructions} />
            </div>
            {state.notFoundYet ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Not detected yet - this can take up to 5 minutes for DNS.
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Generate a token to see the verification instructions for this
            method.
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.loading}
            onClick={() => onGenerate(m)}
          >
            {state.loading ? "Generating..." : "Generate token"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!state.response || confirmMut.isPending}
            onClick={onCheck}
          >
            {confirmMut.isPending ? "Checking..." : "I've added it - check now"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify site ownership</DialogTitle>
          <DialogDescription>
            Pick a method and add the token to your site so we can confirm you
            own this domain. Verification unlocks scheduled crawls.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={method}
          onValueChange={(v) => setMethod(v as SiteVerificationMethod)}
        >
          <TabsList>
            <TabsTrigger value="DNS_TXT">DNS TXT</TabsTrigger>
            <TabsTrigger value="META_TAG">Meta tag</TabsTrigger>
          </TabsList>
          <TabsContent value="DNS_TXT">{renderTab("DNS_TXT")}</TabsContent>
          <TabsContent value="META_TAG">{renderTab("META_TAG")}</TabsContent>
        </Tabs>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
