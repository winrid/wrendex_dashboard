// Hand-rolled SVG health-score ring (plan section 2.2). The shadcn token
// block is the only place we customise spacing / typography; this component
// is one of the four explicitly-listed exceptions in AGENTS.md hard rule #4
// where hand-rolled visuals are allowed.
//
// The ring is a 0-100 circle progress indicator coloured by score band:
// >= 85 emerald (healthy), >= 65 amber (warning), else red (critical).
// On mount, the displayed score animates from 0 up to the target via a
// requestAnimationFrame easing loop - we keep it manual to avoid pulling
// framer-motion into a tiny component that doesn't otherwise need it.

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type HealthRingProps = {
  /** 0-100. Clamped on render so a stale snapshot can't blow the geometry. */
  score: number
  /** Score change vs the previous crawl. Optional; omitted when no prior. */
  delta?: number | null
  /** Pages crawled in the run that produced this score; rendered below the
   *  number for context. */
  sample: number
  className?: string
  /** Test seam: skip the rAF easing and render the final score immediately. */
  animateOnMount?: boolean
}

const SIZE = 144
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function bandClass(score: number): { stroke: string; text: string; label: string } {
  if (score >= 85)
    return {
      stroke: "stroke-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "Healthy",
    }
  if (score >= 65)
    return {
      stroke: "stroke-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      label: "Warning",
    }
  return {
    stroke: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
    label: "Critical",
  }
}

function clamp(score: number): number {
  if (Number.isNaN(score)) return 0
  if (score < 0) return 0
  if (score > 100) return 100
  return score
}

export function HealthRing({
  score,
  delta,
  sample,
  className,
  animateOnMount = true,
}: HealthRingProps) {
  const target = clamp(score)
  const [displayed, setDisplayed] = useState<number>(animateOnMount ? 0 : target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animateOnMount) {
      setDisplayed(target)
      return
    }
    const start = performance.now()
    const from = 0
    const duration = 600
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease-out cubic; matches the shadcn motion feel without pulling FM.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (target - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, animateOnMount])

  const band = bandClass(target)
  const offset = CIRCUMFERENCE * (1 - target / 100)
  const rounded = Math.round(displayed)
  const deltaSign = delta == null ? null : delta > 0 ? "+" : delta < 0 ? "" : "="
  const deltaClass =
    delta == null
      ? ""
      : delta > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : delta < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground"

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Health score ${target} of 100`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-muted"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={cn("transition-[stroke-dashoffset] duration-700", band.stroke)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-semibold tabular-nums", band.text)}>
            {rounded}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            of 100
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("font-medium", band.text)}>{band.label}</span>
        {delta != null && deltaSign != null ? (
          <span className={cn("tabular-nums", deltaClass)}>
            {deltaSign}
            {delta}
          </span>
        ) : null}
      </div>
      <div className="text-[11px] text-muted-foreground">
        Sample: {sample.toLocaleString()} {sample === 1 ? "page" : "pages"}
      </div>
    </div>
  )
}
