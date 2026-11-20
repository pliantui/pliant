import * as React from "react"

import { cva as legacyStyles } from "@/lib/legacy"
import { cva as starCva } from "@/lib/star"
import * as Star from "@/lib/star"
import { V } from "@/lib/star-namespace"

const dotVariants = starCva("rounded-full", {
  variants: { size: { sm: "size-2", lg: "size-3" } },
})

const lineVariants = Star.cva("h-px", {
  variants: { weight: { thin: "h-px", thick: "h-0.5" } },
})

const ringVariants = V.cva("rounded-full border", {
  variants: { width: { thin: "border", thick: "border-2" } },
})

const tagStyles = legacyStyles("uppercase")

function Dot({ size }: { size?: "sm" | "lg" }) {
  return <span className={dotVariants({ size })} />
}

function Line({ weight }: { weight?: "thin" | "thick" }) {
  return <hr className={lineVariants({ weight })} />
}

function Ring({ width }: { width?: "thin" | "thick" }) {
  return <span className={ringVariants({ width })} />
}

function Label({ size }: { size?: "sm" | "lg" }) {
  return <span data-size={size} className={tagStyles()} />
}

export { Dot, Label, Line, Ring }
