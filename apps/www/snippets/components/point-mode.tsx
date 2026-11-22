// #region usage
"use client"

import * as React from "react"

import {
  PliantAskPanel,
  type PliantAskTarget,
} from "@/components/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/components/pliant/pliant-point-mode"

export function AskToolbar({
  targets,
}: {
  targets: readonly PliantAskTarget[]
}) {
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
        endpoint="/api/pliant"
        targets={targets}
        target={target}
        onTargetChange={setTarget}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
// #endregion usage
