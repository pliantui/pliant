import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const pillVariants = cva("inline-flex rounded-full px-2 text-xs", {
  variants: {
    status: {
      OPEN: "bg-green-100",
      CLOSED: "bg-muted",
    },
    severity: {
      low: "text-muted-foreground",
      high: "text-destructive",
    },
    tone: {
      calm: "bg-sky-50",
      success: "bg-emerald-50",
      red: "bg-red-50",
    },
    emphasis: {
      normal: "font-normal",
      strong: "font-semibold",
    },
  },
})

interface StatusPillProps extends React.ComponentProps<"span"> {
  status: "OPEN" | "CLOSED"
  severity?: "low" | "high"
  tone?: "calm" | "success" | "red"
  isActive?: boolean
}

function StatusPill({
  className,
  status,
  severity,
  tone,
  isActive,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        pillVariants({
          status,
          severity,
          tone,
          emphasis: isActive ? "strong" : "normal",
        }),
        className
      )}
      {...props}
    />
  )
}

export { StatusPill }
