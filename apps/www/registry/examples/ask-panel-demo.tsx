"use client"

import * as React from "react"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"
import { LazyAskPanel } from "@/components/lazy-ask-panel"
import { replayFetch } from "@/lib/replay/replay-fetch"

const targets = askTargets.filter(({ id }) => id === "key-metrics")

export function AskPanelDemo() {
  const [open, setOpen] = React.useState(false)

  return (
    <LazyAskPanel
      // Answers from recorded answers, so no request leaves the page.
      endpoint="/replay"
      fetch={replayFetch}
      targets={targets}
      open={open}
      onOpenChange={setOpen}
    />
  )
}
