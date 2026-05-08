// Wrendex wren mark. Two-color brand image (forest silhouette + cream circuit
// detail) rendered as an <img> so the multi-color identity is preserved across
// every callsite. The previous single-color SVG version drove its color from
// currentColor; the new mark is intentionally bichrome, so callsites that
// previously dimmed it via text-color (e.g. text-muted-foreground/60) should
// use opacity utilities instead.
//
// Two variants exist:
//   - "default": forest body + cream circuit highlights, for cream/light surfaces
//   - "light":   cream body + forest highlights, for the forest-green bg-primary
//                sidebar tile and other dark backgrounds
//
// Used in:
//   - AppShell sidebar header tile (variant="light", inside a forest tile)
//   - Route empty states / 404 fallback (default)
// Restraint: do NOT scatter this across action buttons, breadcrumbs, or
// card headers. One motif, used in 1-3 spots, per the design intent.

import type { ImgHTMLAttributes } from "react"
import wrenSrc from "@/assets/wren.png"
import wrenLightSrc from "@/assets/wren-light.png"

type WrenMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  alt?: string
  variant?: "default" | "light"
}

export function WrenMark({
  className,
  alt = "",
  variant = "default",
  ...rest
}: WrenMarkProps) {
  const src = variant === "light" ? wrenLightSrc : wrenSrc
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      draggable={false}
      className={className}
      {...rest}
    />
  )
}
