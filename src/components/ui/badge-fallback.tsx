import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline"
}

/**
 * Lightweight stand-in until shadcn `badge` is added in a follow-up
 * iteration. Keeps the API similar so consumers can swap to the official
 * component without churn.
 */
export function Badge({
  className,
  variant = "default",
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" &&
          "bg-primary text-primary-foreground",
        variant === "outline" && "border bg-background",
        className,
      )}
      {...rest}
    />
  )
}
