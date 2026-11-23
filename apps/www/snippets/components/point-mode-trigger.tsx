// #region trigger
"use client"

import { useRef, type ReactNode } from "react"

import { PliantCustomizeContextMenu } from "@/components/pliant/pliant-customize-menu"
import {
  PliantPointMode,
  type PliantPointModeHandle,
} from "@/components/pliant/pliant-point-mode"

import { askTargets } from "../ai/ask-targets"

export function KeyMetricsSurface({ children }: { children: ReactNode }) {
  const pointMode = useRef<PliantPointModeHandle>(null)

  return (
    <>
      {/* Adjust by hand in the region's right-click menu selects it, so
          its cards show their handles. */}
      <PliantCustomizeContextMenu
        onAdjust={() => {
          pointMode.current?.start("key-metrics")
        }}
      >
        <div>{children}</div>
      </PliantCustomizeContextMenu>
      <PliantPointMode ref={pointMode} targets={askTargets} />
    </>
  )
}
// #endregion trigger
