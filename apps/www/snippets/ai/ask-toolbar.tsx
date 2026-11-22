// #region toolbar
"use client"

import { useState } from "react"

import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/components/pliant/pliant-point-mode"

import { askTargets } from "./ask-targets"

export function AskToolbar() {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState("key-metrics")

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
// #endregion toolbar
