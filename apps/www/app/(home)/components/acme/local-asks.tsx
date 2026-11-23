"use client"

import * as React from "react"

import { usePliantSurface } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { replayAnswer } from "@/lib/replay/replay-fetch"

import { useShowcaseActivity } from "./showcase-activity"

// Scripted asks for a part of the showcase whose component isn't in Pliant
// yet, so the part draws each answer itself. They preview, lock in and
// discard like the other asks. Each answer's overlay is still the real one,
// for the Changes tab, and an ask the data can't answer changes nothing.
export function LocalAsks({
  target,
  label,
  prompts,
  more = false,
  onShow,
}: {
  target: string
  // The part's name, as the asks' group label reads it.
  label: string
  prompts: readonly string[]
  // Whether these asks sit beside the part's other asks.
  more?: boolean
  // Called with the prompt whose answer the part should draw, if any.
  onShow: (prompt: string | null) => void
}) {
  const surface = usePliantSurface()
  const activity = useShowcaseActivity()
  const [kept, setKept] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState("")

  function show(next: { kept: string | null; pending: string | null }) {
    setKept(next.kept)
    setPending(next.pending)
    onShow(next.pending ?? next.kept)
  }

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
            aria-pressed={(pending ?? kept) === prompt}
            className="h-auto min-h-7 max-w-full rounded-full px-2.5 py-1 text-left text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-accent"
            onClick={() => {
              if (pending) activity.discard()
              if (kept === prompt && !pending) {
                activity.removeLocal(target)
                show({ kept: null, pending: null })
                setMessage("")
                return
              }
              const answer = replayAnswer(
                { surface, target, prompt },
                { scripted: true }
              )
              if (answer.status !== "ok") {
                show({ kept, pending: null })
                setMessage(
                  answer.status === "clarify" ? answer.question : answer.reason
                )
                return
              }
              activity.previewLocal(target, answer.overlay)
              show({ kept, pending: prompt })
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
      {pending && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={() => {
              if (kept) activity.removeLocal(target)
              activity.keep()
              show({ kept: pending, pending: null })
            }}
          >
            Lock in
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              activity.discard()
              show({ kept, pending: null })
              setMessage("")
            }}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  )
}
