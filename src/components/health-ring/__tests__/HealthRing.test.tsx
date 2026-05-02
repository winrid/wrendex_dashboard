import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { HealthRing } from "../HealthRing"

// We disable the rAF easing in tests via animateOnMount=false so the rendered
// SVG ring mirrors the target score immediately. The colour band assertion is
// against the Tailwind utility class on the foreground stroke.
function ringStrokeClasses(container: HTMLElement): string {
  const circles = container.querySelectorAll("circle")
  // The second circle is the foreground progress ring.
  const fg = circles[1]
  if (!fg) throw new Error("foreground ring not rendered")
  return fg.getAttribute("class") ?? ""
}

describe("HealthRing colour band", () => {
  it("renders the red band for a critical score", () => {
    const { container } = render(
      <HealthRing score={30} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-red-500")
  })

  it("renders the amber band for a warning score", () => {
    const { container } = render(
      <HealthRing score={70} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-amber-500")
  })

  it("renders the emerald band for a healthy score", () => {
    const { container } = render(
      <HealthRing score={95} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-emerald-500")
  })
})
