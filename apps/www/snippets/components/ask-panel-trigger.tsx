// #region trigger
"use client"

import { useRef, useState } from "react"

import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { PliantCustomizeMenu } from "@/components/pliant/pliant-customize-menu"

import { askTargets } from "../ai/ask-targets"

export function CustomizeAsk() {
  const [open, setOpen] = useState(false)
  const customize = useRef<HTMLButtonElement>(null)

  return (
    <>
      <PliantCustomizeMenu
        ref={customize}
        onAsk={() => {
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={askTargets}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) customize.current?.focus()
        }}
      />
    </>
  )
}
// #endregion trigger
