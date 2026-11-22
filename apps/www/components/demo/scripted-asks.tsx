"use client"

import { ScriptedBadge } from "@/components/demo/scripted-badge"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { Button } from "@/components/ui/button"

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
