"use client"

import * as React from "react"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"
import { replayFetch } from "@/lib/replay/replay-fetch"
import { PliantAskPanel } from "@/registry/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

const targets = askTargets.filter(({ id }) => id === "key-metrics")

export function PointModeDemo() {
  const [open, setOpen] = React.useState(false)
  const [target, setTarget] = React.useState(targets[0]?.id)

  return (
    <div className="flex items-center gap-2">
      <PliantPointMode
        targets={targets}
        onPick={(id) => {
          setTarget(id)
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/replay"
        fetch={replayFetch}
        targets={targets}
        target={target}
        onTargetChange={setTarget}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
