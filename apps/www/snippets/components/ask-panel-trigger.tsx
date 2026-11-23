// #region trigger
"use client"

import { useState } from "react"

import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { PliantCustomizeMenu } from "@/components/pliant/pliant-customize-menu"

import { askTargets } from "../ai/ask-targets"

export function CustomizeAsk() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <PliantCustomizeMenu
        onAsk={() => {
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={askTargets}
        open={open}
        onOpenChange={setOpen}
        trigger={null}
      />
    </>
  )
}
// #endregion trigger
