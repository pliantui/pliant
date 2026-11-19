"use client"

import * as React from "react"

import {
  PliantAskPanel,
  type PliantAskPick,
} from "@/registry/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

import { askTargets } from "../ask-targets"

export function AskToolbar() {
  const [open, setOpen] = React.useState(false)
  const [pick, setPick] = React.useState<PliantAskPick>()

  return (
    <div className="flex items-center gap-2">
      <PliantPointMode
        targets={askTargets}
        onPick={(target) => {
          setPick({ target })
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={askTargets}
        open={open}
        onOpenChange={setOpen}
        pick={pick}
      />
    </div>
  )
}
