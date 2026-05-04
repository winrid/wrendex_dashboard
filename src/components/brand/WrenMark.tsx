// Wrendex wren mark, rendered inline so we can color it with currentColor and
// drive sizing through Tailwind utilities. Visually matches the marketing
// site's nav brand mark (wrendex_marketing/src/partials/navbar.ejs) so a
// customer logging into the dashboard sees the same silhouette they saw on
// the homepage. Single-color, ~24x24 viewBox, renders cleanly from 16px to
// 96px. Used in:
//   - AppShell sidebar header tile (replaces the placeholder "W" mark)
//   - DataTable empty state (when the consumer opts into the wren mascot)
//   - 404 / RouteFallback fallbacks (optional accent)
// Restraint: do NOT scatter this across action buttons, breadcrumbs, or
// card headers. One motif, used in 1-3 spots, per the design intent.

import type { SVGProps } from "react"

export function WrenMark({
  className,
  ...rest
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <ellipse cx="11.2" cy="13.6" rx="5.2" ry="4" fill="currentColor" />
      <circle cx="7" cy="10.4" r="2.8" fill="currentColor" />
      <path
        d="M15.2 12.4C16.4 10.4 18 7.6 17.4 4.8C16.6 6.4 16 8 15.2 10C14.8 11 14.8 11.8 15.2 12.4Z"
        fill="currentColor"
      />
      <path
        d="M4.2 10L2 9.4L4.2 8.8"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 19.2L8.4 21.4M11.4 19.4L11.4 21.6M13.6 19.2L14.2 21.4"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
