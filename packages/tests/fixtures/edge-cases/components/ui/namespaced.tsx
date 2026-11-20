import * as React from "react"
import * as CVA from "class-variance-authority"

import { cva } from "@/lib/cva"
import * as Legacy from "@/lib/legacy"

const kbdVariants = CVA.cva("rounded border font-mono", {
  variants: {
    size: { sm: "text-xs", md: "text-sm" },
  },
})

const markVariants = cva("rounded px-1", {
  variants: {
    tint: { yellow: "bg-yellow-200", plain: "bg-muted" },
  },
})

const legacyVariants = Legacy.cva("uppercase")

function Kbd({ size }: { size?: "sm" | "md" }) {
  return <kbd className={kbdVariants({ size })} />
}

function Mark({ tint }: { tint?: "yellow" | "plain" }) {
  return <mark className={markVariants({ tint })} />
}

function Caption({ size }: { size?: "sm" | "md" }) {
  return <small data-size={size} className={legacyVariants()} />
}

export { Caption, Kbd, Mark }
