import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      warning: "border-amber-500/50 text-amber-900",
      destructive: "text-destructive bg-card",
    },
  },
  compoundVariants: [
    {
      variant: "critical",
      class: "font-semibold",
    },
    {
      emphasis: "strong",
      class: "border-2",
    },
  ],
  defaultVariants: {
    variant: "default",
  },
})

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Alert }
