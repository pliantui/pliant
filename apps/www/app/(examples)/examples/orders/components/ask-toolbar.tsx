"use client"

import * as React from "react"

import { PliantAskPanel } from "@/registry/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

import { askTargets } from "../ask-targets"

export function AskToolbar() {
  const [open, setOpen] = React.useState(false)
  const [target, setTarget] = React.useState(askTargets[0]?.id)

  return (
    <div className="flex items-center gap-2">
      <PliantPointMode
        targets={askTargets}
        onPick={(id) => {
          setTarget(id)
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={askTargets}
        target={target}
        onTargetChange={setTarget}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
