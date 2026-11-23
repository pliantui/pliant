"use client"

import * as React from "react"

import { usePliantSurface } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { replayAnswer } from "@/lib/replay/replay-fetch"

import { useShowcaseActivity } from "./showcase-activity"

// Scripted asks for a part of the showcase whose component isn't in Pliant
// yet, so the part draws each answer itself. Each answer's overlay is still
// the real one, for the Changes tab, and an ask the data can't answer
// changes nothing.
export function LocalAsks({
  target,
  label,
  prompts,
  more = false,
  applied,
  onApply,
}: {
  target: string
  // The part's name, as the asks' group label reads it.
  label: string
  prompts: readonly string[]
  // Whether these asks sit beside the part's other asks.
  more?: boolean
  // The prompt whose answer shows, if any.
  applied: string | null
  onApply: (prompt: string | null) => void
}) {
  const surface = usePliantSurface()
  const { record, setLocal } = useShowcaseActivity()
  const [message, setMessage] = React.useState("")

  return (
    <div
      className="flex flex-col gap-2"
      data-unfinished="scripted"
      data-asks-for={more ? undefined : target}
    >
      <div
        role="group"
        aria-label={`${more ? "More asks" : "Ask"} about ${label}`}
        className="flex flex-wrap gap-1.5"
      >
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={applied === prompt}
            className="h-auto min-h-7 max-w-full rounded-full px-2.5 py-1 text-left text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-accent"
            onClick={() => {
              if (applied === prompt) {
                onApply(null)
                setLocal(target, false)
                record(null)
                setMessage("")
                return
              }
              const answer = replayAnswer(
                { surface, target, prompt },
                { scripted: true }
              )
              if (answer.status !== "ok") {
                setMessage(
                  answer.status === "clarify" ? answer.question : answer.reason
                )
                return
              }
              onApply(prompt)
              setLocal(target, true)
              record({ overlay: answer.overlay, state: "kept" })
              setMessage(answer.explain.join(" "))
            }}
          >
            {prompt}
            <UnfinishedDot kind="scripted" />
          </Button>
        ))}
      </div>
      <p role="status" className="text-xs text-muted-foreground empty:sr-only">
        {message}
      </p>
    </div>
  )
}
