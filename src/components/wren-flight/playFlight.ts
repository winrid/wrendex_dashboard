/**
 * Wren fly-in / pickup / fly-out animation. Standalone DOM player driven by
 * a rig + animation JSON authored in experiments/wren-flight/{rig,anim}.html.
 *
 * Usage:
 *   const { promise, cancel } = playWrenFlight({ text: "/blog/foo" })
 *   await promise
 *
 * The player mounts a fixed-position overlay onto the container (defaults to
 * document.body), runs the animation once via requestAnimationFrame, then
 * removes its DOM. pointer-events: none on the overlay so it never blocks UI
 * underneath.
 */
import wrenHead from "../../assets/wren-head.png"
import wrenBody from "../../assets/wren-body.png"
import wrenTail from "../../assets/wren-tail.png"
import rigData from "./rig.json"
import animData from "./anim.json"

export interface WrenRig {
  parts: Record<
    "body" | "head" | "tail",
    { x: number; y: number; pivotX: number; pivotY: number; z: number; scale: number }
  >
  beakAttach: { x: number; y: number }
  stageSize: { w: number; h: number }
}
export interface WrenKeyframe {
  t: number
  x: number
  y: number
  rot: number
}
export interface WrenAnim {
  durationMs: number
  tracks: Record<"bird" | "body" | "head" | "tail" | "cargo", WrenKeyframe[]>
}

const PART_NAMES = ["body", "head", "tail"] as const
type PartName = (typeof PART_NAMES)[number]

const ASSET_URLS: Record<PartName, string> = {
  body: wrenBody,
  head: wrenHead,
  tail: wrenTail,
}

const DEFAULT_RIG = rigData as WrenRig
const DEFAULT_ANIM = animData as WrenAnim

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

// Interpolate angles along the short arc (handles wrap at ±180°).
function shortAngLerp(a: number, b: number, u: number): number {
  const d = (((b - a) % 360) + 540) % 360 - 180
  return a + d * u
}

function sample(track: WrenKeyframe[] | undefined, t: number): WrenKeyframe | null {
  if (!track || !track.length) return null
  if (t <= track[0].t) return { ...track[0] }
  if (t >= track[track.length - 1].t) return { ...track[track.length - 1] }
  let i = 0
  while (i < track.length - 1 && track[i + 1].t < t) i++
  const a = track[i]
  const b = track[i + 1]
  const u = (t - a.t) / (b.t - a.t)
  return {
    t,
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    rot: shortAngLerp(a.rot, b.rot, u),
  }
}

export interface PlayWrenFlightOptions {
  /** Text the wren picks up and carries off. */
  text: string
  /** Mount target. Defaults to document.body. */
  container?: HTMLElement
  /** Overlay z-index. Defaults to 9999. */
  zIndex?: number
  /**
   * Where the bird lands (viewport-relative pixels). Defaults to the center
   * of the container's bounding rect.
   */
  landingPositionPx?: { x: number; y: number }
  /** Override the rig (parts layout). Defaults to bundled rig.json. */
  rig?: WrenRig
  /** Override the animation. Defaults to bundled anim.json. */
  anim?: WrenAnim
  /**
   * Scales the whole scene (bird + cargo + flight trajectory) uniformly
   * around the landing point. Default 1 (no scale).
   */
  sceneScale?: number
  /** Cargo font size in px. Default 16. */
  fontSize?: number
  fontColor?: string
  /**
   * Debug: skip the post-animation DOM cleanup so the elements remain
   * inspectable in DevTools. Default false (cleanup runs as normal).
   */
  keepInDom?: boolean
}

export interface WrenFlightHandle {
  promise: Promise<void>
  cancel: () => void
}

/**
 * Play the animation once. Resolves when it finishes (or is cancelled).
 */
export function playWrenFlight(opts: PlayWrenFlightOptions): WrenFlightHandle {
  const rig = opts.rig ?? DEFAULT_RIG
  const anim = opts.anim ?? DEFAULT_ANIM
  const container = opts.container ?? document.body
  const zIndex = opts.zIndex ?? 9999
  const sceneScale = opts.sceneScale ?? 1
  const fontSize = opts.fontSize ?? 16
  const fontColor = opts.fontColor ?? "#e7ecdc"
  const keepInDom = opts.keepInDom ?? false

  // Landing point in viewport pixels.
  const containerRect = container === document.body
    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    : container.getBoundingClientRect()
  const landX = opts.landingPositionPx?.x ?? containerRect.width * 0.5
  const landY = opts.landingPositionPx?.y ?? containerRect.height * 0.55

  // === Stage overlay ===
  const stage = document.createElement("div")
  stage.dataset.wrenFlight = "1"
  Object.assign(stage.style, {
    position: container === document.body ? "fixed" : "absolute",
    left: "0",
    top: "0",
    right: "0",
    bottom: "0",
    pointerEvents: "none",
    zIndex: String(zIndex),
    overflow: "hidden",
  })

  // === Scene wrapper ===
  // Single positioned anchor at the landing point. Default sceneScale 1
  // so bird + cargo render at the geometry the rig+anim were authored at.
  const scene = document.createElement("div")
  Object.assign(scene.style, {
    position: "absolute",
    left: landX + "px",
    top: landY + "px",
    width: "0",
    height: "0",
    transform: `scale(${sceneScale})`,
    transformOrigin: "0 0",
  })
  scene.dataset.wrenScene = "1"

  // === Cargo (text) ===
  const cargo = document.createElement("div")
  Object.assign(cargo.style, {
    position: "absolute",
    left: "0",
    top: "0",
    fontSize: fontSize + "px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    color: fontColor,
    whiteSpace: "nowrap",
    willChange: "transform",
    textShadow: "0 2px 12px rgba(0,0,0,0.45)",
    transformOrigin: "0% 50%",
  })
  cargo.textContent = opts.text
  scene.appendChild(cargo)

  // === Bird wrapper + parts ===
  const bird = document.createElement("div")
  Object.assign(bird.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
    willChange: "transform",
  })
  const partsContainer = document.createElement("div")
  Object.assign(partsContainer.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
  })
  bird.appendChild(partsContainer)

  const partEls: Record<PartName, HTMLDivElement> = {} as Record<PartName, HTMLDivElement>
  const cx = rig.stageSize.w / 2
  const cy = rig.stageSize.h / 2
  for (const name of PART_NAMES) {
    const el = document.createElement("div")
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      willChange: "transform",
    })
    const img = document.createElement("img")
    img.src = ASSET_URLS[name]
    img.draggable = false
    Object.assign(img.style, { display: "block", pointerEvents: "none" })
    el.appendChild(img)
    const p = rig.parts[name]
    el.style.transformOrigin = `${p.pivotX * 100}% ${p.pivotY * 100}%`
    el.style.zIndex = String(p.z)
    el.dataset.baseX = String(p.x - cx)
    el.dataset.baseY = String(p.y - cy)
    partsContainer.appendChild(el)
    partEls[name] = el
  }
  scene.appendChild(bird)
  stage.appendChild(scene)
  container.appendChild(stage)

  // Snap to t=0 immediately so the first paint after mount already shows the
  // bird off-screen — avoids a one-frame flash at the landing position.
  renderAt(0)

  function renderAt(t: number): void {
    const birdKf = sample(anim.tracks.bird, t) ?? { t, x: 0, y: 0, rot: 0 }
    bird.style.transform = `translate(${birdKf.x}px, ${birdKf.y}px) rotate(${birdKf.rot}deg)`

    const cargoKf = sample(anim.tracks.cargo, t) ?? { t, x: 0, y: 0, rot: 0 }
    cargo.style.transform = `translate(${cargoKf.x}px, ${cargoKf.y}px) rotate(${cargoKf.rot}deg)`

    for (const name of PART_NAMES) {
      const el = partEls[name]
      const baseX = parseFloat(el.dataset.baseX!)
      const baseY = parseFloat(el.dataset.baseY!)
      const p = rig.parts[name]
      const kf = sample(anim.tracks[name], t) ?? { t, x: 0, y: 0, rot: 0 }
      el.style.transform =
        `translate(${baseX + kf.x}px, ${baseY + kf.y}px) ` +
        `scale(${p.scale}) rotate(${kf.rot}deg)`
    }
  }

  let rafId = 0
  let cancelled = false
  const started = performance.now()

  const cleanup = (): void => {
    cancelAnimationFrame(rafId)
    if (!keepInDom && stage.parentNode) stage.parentNode.removeChild(stage)
  }

  const promise = new Promise<void>((resolve) => {
    const tick = (): void => {
      if (cancelled) {
        cleanup()
        resolve()
        return
      }
      const elapsed = performance.now() - started
      if (elapsed >= anim.durationMs) {
        renderAt(anim.durationMs)
        // One more frame so the final state is painted before unmount.
        requestAnimationFrame(() => {
          cleanup()
          resolve()
        })
        return
      }
      renderAt(elapsed)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
    },
  }
}
