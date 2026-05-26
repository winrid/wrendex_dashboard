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
   * Where the bird lands (viewport-relative pixels). Defaults to: x = center
   * of the container, y = positioned so the cargo's "on-ground" rest spot
   * sits `bottomMargin` px above the container's bottom edge.
   */
  landingPositionPx?: { x: number; y: number }
  /**
   * Bottom padding (px) between the cargo's resting "ground" position and
   * the container's bottom edge. Only used when `landingPositionPx.y` is
   * not provided. Default 30.
   */
  bottomMargin?: number
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
   * The bird's X translation value that should map to "right edge of
   * viewport". Authored value: 965 (with the bird flying in from
   * off-screen-right at that translate). Default 965.
   */
  viewportReferenceX?: number
  /**
   * Debug: skip the post-animation DOM cleanup so the elements remain
   * inspectable in DevTools. Default false (cleanup runs as normal).
   */
  keepInDom?: boolean
  /**
   * Debug: halt the rAF loop at this timestamp (ms) and freeze the scene
   * there instead of running through `anim.durationMs`. Default null.
   */
  pauseAtMs?: number | null
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
  const zIndex = opts.zIndex ?? -1
  const sceneScale = opts.sceneScale ?? 0.5
  const fontSize = opts.fontSize ?? 32
  const fontColor = opts.fontColor ?? "#000"
  // The bird + cargo X translations were authored against a desktop-width
  // viewport. To make the bird actually start at the right edge of any
  // user's viewport and end past the left edge, scale every X translation
  // so that this reference value maps to half the viewport width (the
  // distance from the centered landing point to either edge).
  const referenceX = opts.viewportReferenceX ?? 965
  const keepInDom = opts.keepInDom ?? false
  const pauseAtMs = opts.pauseAtMs ?? null

  // Landing point in viewport pixels. The default Y anchors the bird so
  // the cargo's at-rest position (its first keyframe's Y in the anim track)
  // lands `bottomMargin` px above the container's bottom edge — i.e. the
  // payload sits on the "ground" and the bird descends to pick it up.
  const containerRect = container === document.body
    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    : container.getBoundingClientRect()
  const landX = opts.landingPositionPx?.x ?? containerRect.width * 0.5
  const bottomMargin = opts.bottomMargin ?? 30
  const cargoRestY = anim.tracks.cargo[0]?.y ?? 0
  const landY =
    opts.landingPositionPx?.y ??
    containerRect.height - cargoRestY * sceneScale - bottomMargin

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
    opacity: "0.2",
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
    // maxWidth: "none" overrides the dashboard's preflight `img { max-width:
    // 100%; height: auto }` reset, which would otherwise collapse the part
    // imgs to 0×0 because their wrappers are 0-width.
    Object.assign(img.style, {
      display: "block",
      pointerEvents: "none",
      maxWidth: "none",
    })
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
    // Viewport-relative X scale: anim values for bird + cargo are stretched
    // so the authored reference X (default 965) lines up with half the
    // current viewport width. Computed each frame so live resizes adapt.
    const vw =
      container === document.body ? window.innerWidth : container.clientWidth
    const xMul = vw / 2 / (referenceX * sceneScale)

    const birdKf = sample(anim.tracks.bird, t) ?? { t, x: 0, y: 0, rot: 0 }
    bird.style.transform = `translate(${birdKf.x * xMul}px, ${birdKf.y}px) rotate(${birdKf.rot}deg)`

    const cargoKf = sample(anim.tracks.cargo, t) ?? { t, x: 0, y: 0, rot: 0 }
    cargo.style.transform = `translate(${cargoKf.x * xMul}px, ${cargoKf.y}px) rotate(${cargoKf.rot}deg)`

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
      // Debug halt: freeze the scene at the requested timestamp and resolve.
      // No cleanup() so the DOM survives for inspection (paired with
      // keepInDom: true typically).
      if (pauseAtMs != null && elapsed >= pauseAtMs) {
        renderAt(pauseAtMs)
        resolve()
        return
      }
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
