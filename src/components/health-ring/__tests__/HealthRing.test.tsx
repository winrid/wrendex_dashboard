import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { HealthRing } from "../HealthRing"

// We disable the rAF easing in tests via animateOnMount=false so the rendered
// SVG ring mirrors the target score immediately. Each band's foreground ring
// gets a brand-tokenised stroke class (moss / gold / destructive), not the
// stock Tailwind palette — the assertions encode that mapping so a future
// "let's just use emerald" drift fails loudly.
function ringStrokeClasses(container: HTMLElement): string {
  const circles = container.querySelectorAll("circle")
  // The second circle is the foreground progress ring.
  const fg = circles[1]
  if (!fg) throw new Error("foreground ring not rendered")
  return fg.getAttribute("class") ?? ""
}

describe("HealthRing colour band", () => {
  it("renders the brand destructive band for a critical score", () => {
    const { container } = render(
      <HealthRing score={30} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-[var(--destructive)]")
  })

  it("renders the brand gold band for a warning score", () => {
    const { container } = render(
      <HealthRing score={70} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-[var(--brand-gold)]")
  })

  it("renders the brand moss band for a healthy score", () => {
    const { container } = render(
      <HealthRing score={95} sample={120} animateOnMount={false} />,
    )
    expect(ringStrokeClasses(container)).toContain("stroke-[var(--brand-moss)]")
  })
})

describe("HealthRing framing", () => {
  // testing-library's render doesn't auto-cleanup between tests in this
  // project's setup. Each test scopes its queries to its own container so
  // earlier renders left in the DOM don't trip "multiple elements" errors.

  it('shows the "Your Score Is" editorial caption above the ring', () => {
    const { container } = render(
      <HealthRing score={42} sample={1017} animateOnMount={false} />,
    )
    expect(container.textContent).toContain("Your Score Is")
  })

  it("includes a band-specific interpretation sentence", () => {
    const { container } = render(
      <HealthRing score={0} sample={1017} animateOnMount={false} />,
    )
    // Critical band must explain itself; the user complaint was "0 in red"
    // with no context. The interpretation line is the fix.
    expect(container.textContent ?? "").toMatch(/High issue density/i)
  })

  it("renders the sample line with comma-grouped page count", () => {
    const { container } = render(
      <HealthRing score={50} sample={1017} animateOnMount={false} />,
    )
    expect(container.textContent).toContain("1,017")
  })

  it("does not show the legacy stock Tailwind palette", () => {
    // Regression guard: if someone re-introduces stroke-emerald-500 / amber
    // / red the gauge would clash with the cream + forest dashboard chrome.
    const { container } = render(
      <HealthRing score={30} sample={1} animateOnMount={false} />,
    )
    const fg = container.querySelectorAll("circle")[1]
    const klass = fg?.getAttribute("class") ?? ""
    expect(klass).not.toContain("stroke-red-500")
    expect(klass).not.toContain("stroke-emerald-500")
    expect(klass).not.toContain("stroke-amber-500")
  })
})
