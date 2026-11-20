import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const accent = "accent"

const tagVariants = cva("inline-flex rounded px-1.5 text-xs", {
  variants: {
    look: {
      plain: "bg-muted",
      [accent]: "bg-accent",
    },
    shape: {
      square: "rounded-none",
      pill: "rounded-full",
    },
    defaultVariants: {
      shape: "pill",
    },
  },
})

function Tag({
  className,
  look,
  shape,
  ...props
}: React.ComponentProps<"span"> & {
  look?: "plain" | "accent"
  shape?: "square" | "pill"
}) {
  return (
    <span className={cn(tagVariants({ look, shape }), className)} {...props} />
  )
}

export { Tag }
