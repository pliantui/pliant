// #region toolbar
"use client"

import { useRef, useState } from "react"

import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { PliantCustomizeMenu } from "@/components/pliant/pliant-customize-menu"
import { PliantPointMode } from "@/components/pliant/pliant-point-mode"

import { askTargets } from "./ask-targets"

export function CustomizeToolbar() {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState("key-metrics")
  const customize = useRef<HTMLButtonElement>(null)

  return (
    <>
      <PliantCustomizeMenu
        ref={customize}
        onAsk={() => {
          setOpen(true)
        }}
      />
      {/* Hold Alt to point at a part and ask about it. */}
      <PliantPointMode
        targets={askTargets}
        onPick={(id) => {
          setTarget(id)
          setOpen(true)
        }}
        trigger={null}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={askTargets}
        target={target}
        onTargetChange={setTarget}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) customize.current?.focus()
        }}
        trigger={null}
      />
    </>
  )
}
// #endregion toolbar
