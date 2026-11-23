"use client"

import * as React from "react"
import { cn } from "cn"

import {
  CustomizeControl,
  CustomizeSurface,
  focusFirstAsk,
} from "@/components/demo/customize-control"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"

// Frames a preview of a component that isn't built yet: its Customize menu
// and the scripted asks. The page's note says the component isn't
// built.
export function ScriptedFrame({
  label,
  asks,
  scripted,
  className,
  children,
}: {
  // The part's name, as the asks and Reset read it.
  label: string
  asks: readonly string[]
  scripted: ScriptedAsksState
  className?: string | undefined
  children: React.ReactNode
}) {
  const frame = React.useRef<HTMLDivElement>(null)
  const options = {
    customized: scripted.applied.length > 0,
    onAsk: () => {
      focusFirstAsk(frame.current)
    },
    onReset: scripted.reset,
  }

  return (
    <div
      ref={frame}
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        <CustomizeControl label={label} {...options} />
      </div>
      <CustomizeSurface {...options}>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </CustomizeSurface>
      <div className="flex flex-col gap-3 border-t pt-4">
        <ScriptedAsks label={label} asks={asks} scripted={scripted} />
      </div>
    </div>
  )
}
