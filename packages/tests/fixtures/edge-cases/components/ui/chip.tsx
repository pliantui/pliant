import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { largeSizes, sizes } from "@/components/ui/shared/sizes"
import { cn } from "@/lib/utils"

const chipVariants = {
  tone: {
    neutral: "bg-muted text-muted-foreground",
    brand: "bg-primary text-primary-foreground",
  },
  size: {
    ...sizes,
    ...largeSizes,
  },
} satisfies Record<string, Record<string, string>>

const chip = cva("inline-flex items-center rounded-full", {
  variants: chipVariants,
  defaultVariants: {
    tone: "neutral",
    size: "md",
  },
})

function Chip({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chip>) {
  return <span className={cn(chip({ tone, size }), className)} {...props} />
}

export { Chip }
