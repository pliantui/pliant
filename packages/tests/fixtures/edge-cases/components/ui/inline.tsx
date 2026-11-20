import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Callout({
  className,
  density = "cozy",
  ...props
}: React.ComponentProps<"aside"> & { density?: "compact" | "cozy" }) {
  const calloutVariants = cva("rounded-md border", {
    variants: {
      density: {
        compact: "p-2",
        cozy: "p-4",
      },
    },
  })
  return (
    <aside className={cn(calloutVariants({ density }), className)} {...props} />
  )
}

export { Callout as Note }
