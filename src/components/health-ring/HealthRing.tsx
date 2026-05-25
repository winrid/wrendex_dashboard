// Hand-rolled SVG health-score ring (plan section 2.2). The shadcn token
// block is the only place we customise spacing / typography; this component
// is one of the four explicitly-listed exceptions in AGENTS.md hard rule #4
// where hand-rolled visuals are allowed.
//
// Editorial framing: a small-caps "Your Score Is" rule, a monumental serif
// numeral, and a band-coloured label below. The ring's three bands map to
// the brand palette (moss / gold / destructive) rather than stock Tailwind
// (emerald / amber / red) so the gauge sits inside the cream + forest
// dashboard chrome rather than fighting it.
//
// On mount, the displayed score animates from 0 up to the target via a
// requestAnimationFrame easing loop - we keep it manual to avoid pulling
// framer-motion into a tiny component that doesn't otherwise need it.

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import wrenSrc from "@/assets/wren.png"
import wrenLightSrc from "@/assets/wren-light.png"

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

const SIZE = 168
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Band = {
  /** Stroke colour for the ring foreground. */
  stroke: string
  /** Text colour for the score numeral + label. */
  text: string
  /** Soft fill behind the numeral so even at score = 0 the centre reads. */
  halo: string
  label: string
  /** One-line plain-English read of what the band means. */
  meaning: string
}

function bandFor(score: number): Band {
  if (score >= 85)
    return {
      stroke: "stroke-[var(--brand-moss)]",
      text: "text-[var(--brand-forest)] dark:text-[var(--brand-leaf-bright)]",
      halo: "bg-[var(--brand-sage-whisper)] dark:bg-[var(--brand-moss)]/15",
      label: "Healthy",
      meaning: "Low issue density. Keep an eye on warnings as the site grows.",
    }
  if (score >= 65)
    return {
      stroke: "stroke-[var(--brand-gold)]",
      text: "text-[var(--brand-gold)]",
      halo: "bg-[var(--brand-gold)]/12",
      label: "Warning",
      meaning: "Noticeable issue density. Triage the top categories first.",
    }
  return {
    stroke: "stroke-[var(--destructive)]",
    text: "text-[var(--destructive)]",
    halo: "bg-[var(--destructive)]/10",
    label: "Critical",
    meaning: "High issue density. Errors and warnings need attention now.",
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
    const duration = 700
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

  const band = bandFor(target)
  const offset = CIRCUMFERENCE * (1 - target / 100)
  const rounded = Math.round(displayed)
  const deltaSign = delta == null ? null : delta > 0 ? "+" : delta < 0 ? "" : "="
  const deltaClass =
    delta == null
      ? ""
      : delta > 0
        ? "text-[var(--brand-moss)] dark:text-[var(--brand-leaf-bright)]"
        : delta < 0
          ? "text-[var(--destructive)]"
          : "text-muted-foreground"

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Editorial rule + framing label. The two hairlines pinch the
          letter-spaced caption so it reads as a section opener instead of
          a generic field label. */}
      <div className="flex w-full max-w-60 items-center gap-3">
        <span className="h-px flex-1 bg-[var(--brand-sage-rule)]/70" />
        <span className="font-serif text-base uppercase tracking-[0.28em] text-muted-foreground">
          Your Score Is
        </span>
        <span className="h-px flex-1 bg-[var(--brand-sage-rule)]/70" />
      </div>

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Soft brand-toned halo so the numeral has a base to sit on even
            when the foreground ring stroke is short (low scores). */}
        <div
          className={cn(
            "absolute inset-3 rounded-full transition-colors duration-500",
            band.halo,
          )}
          aria-hidden="true"
        />
        {/* Wren mark watermark zoomed into the head/face only. The source
            image renders at its natural size inside the ring; the
            overflow-hidden + rounded-full crop shows just the head/eye
            region. Pixel offsets are intentional here — the alignment
            is image-content-dependent and shouldn't follow the spacing
            scale. */}
        <div
          className="absolute inset-6 overflow-hidden rounded-full opacity-[0.12]"
          aria-hidden="true"
        >
          <img
            src={wrenSrc}
            alt=""
            className="absolute dark:hidden"
            style={{ left: "10px", top: "-5px" }}
          />
          <img
            src={wrenLightSrc}
            alt=""
            className="absolute hidden dark:block"
            style={{ left: "10px", top: "-5px" }}
          />
        </div>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Health score ${target} of 100, ${band.label.toLowerCase()}`}
          className="relative"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-[var(--brand-sage-rule)]/60 dark:stroke-muted"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span
            className={cn(
              "font-serif text-6xl font-medium tabular-nums tracking-tight",
              band.text,
            )}
          >
            {rounded}
          </span>
          <span className="mt-1 font-serif text-sm tracking-[0.18em]">
            / 100
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-serif text-lg italic tracking-wide",
              band.text,
            )}
          >
            {band.label}
          </span>
          {delta != null && deltaSign != null ? (
            <span className={cn("text-xs tabular-nums", deltaClass)}>
              {deltaSign}
              {delta}
            </span>
          ) : null}
        </div>
        <p className="max-w-65 text-sm leading-relaxed text-muted-foreground">
          {band.meaning}
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        Sample:{" "}
        <span className="tabular-nums">{sample.toLocaleString()}</span>{" "}
        {sample === 1 ? "page" : "pages"}
      </div>
    </div>
  )
}
