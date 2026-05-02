// Public anonymous-crawl teaser results page (plan section 2.0).
//
// Polls GET /api/anonymous-crawls/{token} every 2s while the run isn't
// terminal and we haven't waited > 10 minutes. When the run completes we
// switch into the teaser layout: HealthRing + stats strip + 3 visible
// category rows + a frosted/locked card with the upgrade CTA.

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { isApiError } from "@/api/client"
import { useApiClient } from "@/api/useApiClient"
import type { AnonymousCrawlSummary } from "@/api/types"
import { HealthRing } from "@/components/health-ring/HealthRing"
import { AnonymousCrawlProgress } from "@/components/anonymous-crawl/AnonymousCrawlProgress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { LockIcon, AlertCircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { siteDisplayName } from "@/lib/format"

const TERMINAL = new Set(["completed", "failed", "cancelled", "error"])
const POLL_TIMEOUT_MS = 10 * 60 * 1000

/** Locked categories we tease as "available with a trial". The teaser
 *  endpoint caps byCategory at 3, so this list is purely visual - the
 *  user sees what they'll unlock by claiming. */
const LOCKED_CATEGORY_LABELS = [
  "Performance",
  "Internal links",
  "Indexability",
  "Structured data",
  "Redirects",
  "Images",
  "Security",
]

function statsStrip(summary: AnonymousCrawlSummary, scanSeconds: number | null) {
  return [
    { label: "Pages crawled", value: summary.pagesCrawled.toLocaleString() },
    {
      label: "Pages discovered",
      value: summary.pagesDiscovered.toLocaleString(),
    },
    {
      label: "Total issues",
      value: summary.issuesSummary.totalIssues.toLocaleString(),
    },
    {
      label: "Scanned in",
      value: scanSeconds != null ? `${scanSeconds}s` : "-",
    },
  ]
}

function safeHostname(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return url
  }
}

function CategoryRow({
  label,
  errorCount,
  warningCount,
  noticeCount,
}: {
  label: string
  errorCount: number
  warningCount: number
  noticeCount: number
}) {
  const total = errorCount + warningCount + noticeCount
  const dot =
    errorCount > 0
      ? "bg-red-500"
      : warningCount > 0
        ? "bg-amber-500"
        : noticeCount > 0
          ? "bg-blue-500"
          : "bg-muted-foreground/40"
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={cn("inline-block size-2 rounded-full", dot)}
          aria-hidden
        />
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {errorCount > 0 ? (
            <span className="text-red-500">{errorCount} err</span>
          ) : null}
          {warningCount > 0 ? (
            <span className="ml-2 text-amber-500">{warningCount} warn</span>
          ) : null}
          {noticeCount > 0 ? (
            <span className="ml-2 text-blue-500">{noticeCount} notice</span>
          ) : null}
        </span>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {total}
      </span>
    </li>
  )
}

export function AnonymousCrawlTeaser() {
  const { token = "" } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const client = useApiClient()
  const [pollStartedAt] = useState<number>(() => Date.now())

  const q = useQuery({
    queryKey: ["anonymous-crawl", token],
    queryFn: () => client.getAnonymousCrawl(token),
    enabled: Boolean(token),
    refetchInterval: (query) => {
      const data = query.state.data
      const status = data?.status
      if (status && TERMINAL.has(status)) return false
      if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) return false
      return 2_000
    },
    retry: (failureCount, error) => {
      // Don't keep hammering on 404 / 410.
      if (isApiError(error)) {
        if (error.status === 404 || error.status === 410) return false
      }
      return failureCount < 2
    },
  })

  const data = q.data
  const isCompleted = data?.status === "completed"

  // Funnel telemetry: crawl_finished_anonymous + teaser_viewed both fire the
  // first time the polled status flips to "completed" (plan section 16).
  // The refs guard against double-fire across re-renders / route remounts.
  const completionFiredRef = useRef(false)
  useEffect(() => {
    if (completionFiredRef.current) return
    if (!data || data.status !== "completed") return
    completionFiredRef.current = true
    void client.sendTelemetry([
      {
        event: "crawl_finished_anonymous",
        properties: {
          token,
          healthScore: data.healthScore ?? 0,
          totalIssues: data.issuesSummary.totalIssues,
        },
        anonymousCrawlToken: token,
      },
    ])
  }, [data, client, token])

  const teaserViewedFiredRef = useRef(false)
  useEffect(() => {
    if (teaserViewedFiredRef.current) return
    if (!data || data.status !== "completed") return
    teaserViewedFiredRef.current = true
    void client.sendTelemetry([
      {
        event: "teaser_viewed",
        properties: {
          healthScore: data.healthScore ?? 0,
          totalIssues: data.issuesSummary.totalIssues,
        },
        anonymousCrawlToken: token,
      },
    ])
  }, [data, client, token])

  // Scan duration ("Scanned in N seconds" proof-of-work). The BE now ships
  // startedAt + finishedAt on the AnonymousCrawlSummary; we compute the
  // delta locally so a re-derivation isn't a round-trip.
  const scanSeconds: number | null =
    data?.startedAt && data?.finishedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(data.finishedAt).getTime() -
              new Date(data.startedAt).getTime()) /
              1000,
          ),
        )
      : null

  // ---------- error states ----------

  if (q.isError) {
    const err = q.error
    if (isApiError(err) && err.status === 410) {
      return (
        <ExpiredView
          onReplay={() => {
            const url = encodeURIComponent(data?.url ?? "")
            navigate(`/audit${url ? `?url=${url}` : ""}`)
          }}
        />
      )
    }
    if (isApiError(err) && err.status === 404) {
      return <NotFoundView />
    }
    return (
      <PublicShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Could not load this audit</CardTitle>
            <CardDescription>
              Something went wrong. Please try again in a moment.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicShell>
    )
  }

  // ---------- still polling ----------

  if (!data || !isCompleted) {
    return (
      <PublicShell>
        <div className="w-full max-w-2xl space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Auditing {data ? siteDisplayName(data.url) : "your site"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Hang tight - this usually finishes in a few minutes.
            </p>
          </div>
          <AnonymousCrawlProgress summary={data} />
        </div>
      </PublicShell>
    )
  }

  // ---------- completed teaser ----------

  const stats = statsStrip(data, scanSeconds)
  const visibleCats = data.issuesSummary.byCategory.slice(0, 3)
  const lockedCats = LOCKED_CATEGORY_LABELS.filter(
    (label) => !visibleCats.some((c) => c.category === label),
  )
  const score = data.healthScore ?? 0
  const sample = data.pagesCrawled

  const onStartTrial = () => {
    const tenant = encodeURIComponent(safeHostname(data.url))
    navigate(`/signup?claimToken=${encodeURIComponent(token)}&suggestedTenant=${tenant}`)
  }

  return (
    <PublicShell>
      <Toaster />
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Audit results for {siteDisplayName(data.url)}
          </h1>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground hover:underline"
          >
            {data.url}
          </a>
        </div>

        {/* Top: HealthRing */}
        <div className="rounded-md border bg-card p-6">
          <HealthRing score={score} sample={sample} delta={null} />
        </div>

        {/* Middle: stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-md border bg-card px-3 py-2 text-sm"
            >
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-lg font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Three visible category rows */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">
            Top issue categories
          </div>
          {visibleCats.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No issues found in this crawl.
            </div>
          ) : (
            <ul className="divide-y">
              {visibleCats.map((c) => (
                <CategoryRow
                  key={c.category}
                  label={c.category}
                  errorCount={c.errorCount}
                  warningCount={c.warningCount}
                  noticeCount={c.noticeCount}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Locked categories teaser + CTA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="size-4 text-muted-foreground" />
              Plus {lockedCats.length} more categories in the full report
            </CardTitle>
            <CardDescription>
              Start a 14 day trial to unlock every category, see every alert
              page-by-page, and turn on continuous monitoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul
              data-testid="locked-categories"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {lockedCats.map((label) => (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm",
                    "blur-sm select-none",
                  )}
                  aria-hidden
                >
                  <LockIcon className="size-3.5 text-muted-foreground" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onStartTrial}>
                Start 14 day trial - see the full report
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Or sign up to keep this report.{" "}
              <Link
                to={`/login?claimToken=${encodeURIComponent(token)}`}
                className="underline hover:text-foreground"
              >
                Already have an account? Sign in
              </Link>{" "}
              to claim this audit.
            </p>
          </CardContent>
        </Card>
      </div>

    </PublicShell>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-muted/40 p-4 sm:p-8">
      {children}
    </div>
  )
}

function ExpiredView({ onReplay }: { onReplay: () => void }) {
  return (
    <PublicShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircleIcon className="size-5 text-amber-500" />
            This audit has expired
          </CardTitle>
          <CardDescription>
            Free audits are kept for 7 days. Run a fresh one - it only takes a
            few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onReplay}>Run a new audit</Button>
        </CardContent>
      </Card>
    </PublicShell>
  )
}

function NotFoundView() {
  const navigate = useNavigate()
  return (
    <PublicShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>We couldn&apos;t find that audit</CardTitle>
          <CardDescription>Did the link expire?</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/audit")}>Run a new audit</Button>
        </CardContent>
      </Card>
    </PublicShell>
  )
}


