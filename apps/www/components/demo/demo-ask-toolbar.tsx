"use client"

import * as React from "react"

import { LazyAskPanel } from "@/components/lazy-ask-panel"
import { replayFetch } from "@/lib/replay/replay-fetch"
import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

// Point mode and the ask panel for a demo, answering from the recorded
// answers in the browser.
export function DemoAskToolbar({
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
      <LazyAskPanel
        // Every ask goes to `replayFetch`, so no request leaves the page.
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
