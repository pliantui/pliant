"use client"

import * as React from "react"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"
import { replayFetch } from "@/lib/replay/replay-fetch"
import { PliantAskPanel } from "@/registry/pliant/pliant-ask-panel"

const targets = askTargets.filter(({ id }) => id === "key-metrics")

export function AskPanelDemo() {
  const [open, setOpen] = React.useState(false)

  return (
    <PliantAskPanel
      // In your app, point `endpoint` at your ask route and leave out
      // `fetch`. This page answers from recorded answers instead.
      endpoint="/replay"
      fetch={replayFetch}
      targets={targets}
      open={open}
      onOpenChange={setOpen}
    />
  )
}
