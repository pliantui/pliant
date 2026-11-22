"use client"

import * as React from "react"
import { RotateCcwIcon } from "lucide-react"

import { ScriptedBadge } from "@/components/demo/scripted-badge"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// The asks a mockup preview plays, as hand-written changes to its own state.
export function useScriptedAsks() {
  const [applied, setApplied] = React.useState<readonly string[]>([])
  return {
    applied,
    has: (prompt: string) => applied.includes(prompt),
    ask: (prompt: string) => {
      setApplied((current) =>
        current.includes(prompt) ? current : [...current, prompt]
      )
    },
    reset: () => {
      setApplied([])
    },
  }
}

// Frames a preview of a component that isn't built yet: a Customized badge
// and Reset, the scripted asks, and the banner that says so.
export function ScriptedFrame({
  label,
  asks,
  scripted,
  children,
}: {
  // The part's name, as the asks and Reset read it.
  label: string
  asks: readonly string[]
  scripted: ReturnType<typeof useScriptedAsks>
  children: React.ReactNode
}) {
  const customized = scripted.applied.length > 0

  return (
    <div className="flex w-full max-w-3xl min-w-0 flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        {customized && <Badge variant="secondary">Customized</Badge>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Stays focusable after a reset, so focus doesn't fall back to the
          // page.
          aria-disabled={!customized}
          aria-label={`Reset ${label}`}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={() => {
            if (customized) scripted.reset()
          }}
        >
          <RotateCcwIcon />
          Reset
        </Button>
      </div>
      {children}
      <div className="flex flex-col gap-3 border-t pt-4">
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
              className="h-7 rounded-full px-2.5 text-xs font-normal"
              onClick={() => {
                scripted.ask(prompt)
              }}
            >
              {prompt}
              <ScriptedBadge />
            </Button>
          ))}
        </div>
        <NotImplementedBanner variant="preview">
          This component isn&apos;t in Pliant yet, so the preview plays
          hand-written answers to its asks.
        </NotImplementedBanner>
      </div>
    </div>
  )
}
