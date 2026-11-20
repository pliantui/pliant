import { writeFileSync } from "node:fs"
import * as React from "react"
import { cva } from "class-variance-authority"

// The CLI reads this file without running it, so this never writes anything.
writeFileSync(new URL("./side-effect-ran.txt", import.meta.url), "ran")

const ribbonVariants = cva("absolute", {
  variants: {
    corner: { top: "top-0", bottom: "bottom-0" },
  },
})

function Ribbon({ corner }: { corner?: "top" | "bottom" }) {
  return <div className={ribbonVariants({ corner })} />
}

export { Ribbon }
