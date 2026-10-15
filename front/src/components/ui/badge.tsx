import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-muted px-2.5 py-1 text-xs font-medium text-taupe",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }

