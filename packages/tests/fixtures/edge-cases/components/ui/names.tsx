import * as React from "react"
import { cva } from "class-variance-authority"

const gridVariants = cva("grid", {
  variants: { gap: { sm: "gap-1", lg: "gap-4" } },
})

function Grid2x2({ gap }: { gap?: "sm" | "lg" }) {
  return <div className={gridVariants({ gap })} />
}

function HTML5Video({ gap }: { gap?: "sm" | "lg" }) {
  return <video className={gridVariants({ gap })} />
}

export { Grid2x2, HTML5Video }
