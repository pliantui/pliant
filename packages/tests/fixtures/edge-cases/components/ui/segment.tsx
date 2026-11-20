import * as React from "react"

import { tv } from "@/lib/variants"

const segment = tv({
  base: "inline-flex items-center",
  variants: {
    fill: {
      solid: "bg-primary text-primary-foreground",
      soft: "bg-primary/10 text-primary",
    },
  },
  defaultVariants: {
    fill: "soft",
  },
})

function Segment({
  className,
  fill,
  ...props
}: React.ComponentProps<"div"> & { fill?: "solid" | "soft" }) {
  return <div className={segment({ fill, className })} {...props} />
}

export { Segment }
