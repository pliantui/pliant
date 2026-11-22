"use client"

import { cn } from "cn"

import { ResetControl } from "@/components/demo/reset-control"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { NotImplementedBanner } from "@/components/not-implemented-banner"

// Frames a preview of a component that isn't built yet: a Customized badge
// and Reset, the scripted asks, and the banner that says so.
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
  return (
    <div
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        <ResetControl
          customized={scripted.applied.length > 0}
          label={label}
          onReset={scripted.reset}
        />
      </div>
      {children}
      <div className="flex flex-col gap-3 border-t pt-4">
        <ScriptedAsks label={label} asks={asks} scripted={scripted} />
        <NotImplementedBanner variant="preview">
          This component isn&apos;t in Pliant yet, so the preview plays
          hand-written answers to its asks.
        </NotImplementedBanner>
      </div>
    </div>
  )
}
