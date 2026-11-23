// #region toolbar
"use client"

import { useRef, useState } from "react"

import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { PliantCustomizeMenu } from "@/components/pliant/pliant-customize-menu"
import {
  PliantPointMode,
  type PliantPointModeHandle,
} from "@/components/pliant/pliant-point-mode"

import { askTargets } from "./ask-targets"

export function CustomizeToolbar() {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState("key-metrics")
  const customize = useRef<HTMLButtonElement>(null)
  const pointMode = useRef<PliantPointModeHandle>(null)

  function ask(id?: string) {
    if (id) setTarget(id)
    setOpen(true)
  }

  return (
    <>
      <PliantCustomizeMenu
        ref={customize}
        onAsk={() => {
          ask()
        }}
        // Adjust by hand selects a part to move, resize or hide.
        onAdjust={() => {
          pointMode.current?.start()
        }}
      />
      <PliantPointMode
        ref={pointMode}
        targets={askTargets}
        actions={(id) => ({
          onAsk: () => {
            ask(id)
          },
        })}
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
      />
    </>
  )
}
// #endregion toolbar
