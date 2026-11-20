import * as React from "react"
import { cva } from "class-variance-authority"

const drawerConfig = {
  variants: {
    side: { start: "start-0", end: "end-0" },
  },
}

drawerConfig.variants.side.end = "end-0 border-s"

const drawerVariants = cva("fixed inset-y-0", drawerConfig)

function Drawer({ side }: { side?: "start" | "end" }) {
  return <aside className={drawerVariants({ side })} />
}

export { Drawer }
