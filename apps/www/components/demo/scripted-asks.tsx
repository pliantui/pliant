"use client"

import { useDemoAskSuggestions } from "@/components/demo/demo-ask-panel"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"

// The scripted asks for one part of a preview, as toggles, with a status
// line that says which answer is playing. The chat around the preview
// offers them too, and plays them the same way.
export function ScriptedAsks({
  target,
  label,
  asks,
  scripted,
}: {
  // The part the chat asks about. Defaults to the part's name.
  target?: string | undefined
  // The part's name, as the asks' group label reads it.
  label: string
  asks: readonly string[]
  scripted: ScriptedAsksState
}) {
  useDemoAskSuggestions({
    target: target ?? label,
    label,
    prompts: asks,
    play: (prompt) => {
      if (!scripted.has(prompt)) scripted.ask(prompt)
      return `Playing the scripted answer to "${prompt}" on ${label}.`
    },
  })

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
            className="h-auto min-h-7 max-w-full rounded-full px-2.5 py-1 text-left text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-accent"
            onClick={() => {
              scripted.ask(prompt)
            }}
          >
            {prompt}
            <UnfinishedDot kind="scripted" />
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
