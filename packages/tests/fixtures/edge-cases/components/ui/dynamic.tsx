import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const intents = ["primary", "secondary"] as const

const panelVariants = cva("rounded-md border", {
  variants: {
    intent: Object.fromEntries(
      intents.map((intent) => [intent, `panel-${intent}`])
    ),
    padding: {
      sm: "p-2",
      lg: "p-6",
    },
  },
})

function makeConfig() {
  return { variants: { density: { compact: "gap-1", cozy: "gap-3" } } }
}

const stackVariants = cva("flex flex-col", makeConfig())

function Panel({
  className,
  intent,
  padding,
  ...props
}: React.ComponentProps<"div"> & {
  intent?: "primary" | "secondary"
  padding?: "sm" | "lg"
}) {
  return (
    <div
      className={cn(panelVariants({ intent, padding }), className)}
      {...props}
    />
  )
}

function Stack({
  className,
  density,
  ...props
}: React.ComponentProps<"div"> & { density?: "compact" | "cozy" }) {
  return (
    <div className={cn(stackVariants({ density }), className)} {...props} />
  )
}

export { Panel, Stack }
