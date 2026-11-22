"use client"

import * as React from "react"
import { cn } from "cn"

import { ResetControl } from "@/components/demo/reset-control"
import { ScriptedBadge } from "@/components/demo/scripted-badge"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { Button } from "@/components/ui/button"

// The asks a mockup preview plays, as hand-written changes to its own state.
export function useScriptedAsks() {
  const [applied, setApplied] = React.useState<readonly string[]>([])
  return {
    applied,
    has: (prompt: string) => applied.includes(prompt),
    // A second press takes the ask back.
    ask: (prompt: string) => {
      setApplied((current) =>
        current.includes(prompt)
          ? current.filter((entry) => entry !== prompt)
          : [...current, prompt]
      )
    },
    reset: () => {
      setApplied([])
    },
  }
}

export type ScriptedAsksState = ReturnType<typeof useScriptedAsks>

// The scripted asks for one part of a preview, as toggles, with a status
// line that says which answer is playing.
export function ScriptedAsks({
  label,
  asks,
  scripted,
}: {
  // The part's name, as the asks' group label reads it.
  label: string
  asks: readonly string[]
  scripted: ScriptedAsksState
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Ask about ${label}`}
        className="flex flex-wrap gap-1.5"
        // Found by the unfinished work check: these answers are scripted.
        data-unfinished="scripted"
      >
        {asks.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={scripted.has(prompt)}
            className="h-7 rounded-full px-2.5 text-xs font-normal aria-pressed:border-primary aria-pressed:bg-accent"
            onClick={() => {
              scripted.ask(prompt)
            }}
          >
            {prompt}
            <ScriptedBadge />
          </Button>
        ))}
      </div>
      <p role="status" className="text-xs text-muted-foreground empty:sr-only">
        {scripted.applied.some((prompt) => asks.includes(prompt)) &&
          `Playing a scripted answer to "${scripted.applied.findLast((prompt) => asks.includes(prompt)) ?? ""}".`}
      </p>
    </div>
  )
}

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
