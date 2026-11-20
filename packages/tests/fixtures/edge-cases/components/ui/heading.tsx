import * as React from "react"
import { cva } from "class-variance-authority"

const headingVariants = cva("font-semibold tracking-tight", {
  variants: {
    level: {
      1: "text-3xl",
      2: "text-2xl",
    },
    align: {
      start: "text-start",
      center: "text-center",
    },
  },
})

function Heading({
  className,
  level,
  align,
  ...props
}: React.ComponentProps<"h2"> & { level?: 1 | 2; align?: "start" | "center" }) {
  return (
    <h2 className={headingVariants({ level, align, className })} {...props} />
  )
}

export { Heading }
