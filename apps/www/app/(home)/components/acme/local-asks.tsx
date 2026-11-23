"use client"

import * as React from "react"

import { usePliantStore, usePliantSurface, usePreview } from "@pliantui/react"

import { useDemoAskSuggestions } from "@/components/demo/demo-ask-panel"
import { ScriptedAnswerLabel } from "@/components/demo/scripted-answer-label"
import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { replayAnswer } from "@/lib/replay/replay-fetch"

import { useShowcaseActivity } from "./showcase-activity"

// Scripted asks for a part of the showcase whose component isn't in Pliant
// yet, so the part draws each answer itself. They preview, lock in and
// discard like the other asks. Each answer's overlay is still the real one,
// for the Changes tab, and an ask the data can't answer changes nothing. The
// chat offers them too: it shows the answer, and the part draws it.
export function LocalAsks({
  target,
  label,
  prompts,
  onShow,
}: {
  target: string
  // The part's name, as the asks' group label reads it.
  label: string
  prompts: readonly string[]
  // Called with the prompt whose answer the part should draw, if any.
  onShow: (prompt: string | null) => void
}) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const preview = usePreview()
  const activity = useShowcaseActivity()
  const [kept, setKept] = React.useState<string | null>(null)
  const [asked, setAsked] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState("")
  // One change previews at a time, so another ask's preview ends this one.
  const pending = activity.previewing?.local === target ? asked : null
  const shown = pending ?? kept

  React.useEffect(() => {
    onShow(shown)
  }, [onShow, shown])

  // Previews the answer to `prompt`, and returns what it says and whether
  // it changed the part.
  function ask(prompt: string) {
    const answer = replayAnswer({ surface, target, prompt })
    if (answer.status !== "ok") {
      setAsked(null)
      const reason =
        answer.status === "clarify" ? answer.question : answer.reason
      setMessage(reason)
      return { message: reason, previewed: false }
    }
    if (preview) store.discard()
    activity.previewLocal(target, answer.overlay)
    setAsked(prompt)
    const explain = answer.explain.join(" ")
    setMessage(explain)
    return { message: explain, previewed: true }
  }

  useDemoAskSuggestions({
    target,
    label,
    prompts,
    play: (prompt) => {
      if (shown === prompt) return `${label} already shows this change.`
      if (pending) activity.discard()
      const { message, previewed } = ask(prompt)
      return previewed
        ? `${message} Lock in or discard it under ${label}.`
        : message
    },
  })

  return (
    <div
      className="flex flex-col gap-2"
      data-unfinished="scripted"
      data-asks-for={target}
    >
      <div
        role="group"
        aria-label={`Ask about ${label}`}
        className="flex flex-wrap gap-1.5"
      >
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={shown === prompt}
            className="h-auto min-h-7 max-w-full rounded-full px-2.5 py-1 text-left text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-accent"
            onClick={() => {
              if (pending) activity.discard()
              if (kept === prompt && !pending) {
                activity.removeLocal(target)
                setKept(null)
                setMessage("")
                return
              }
              ask(prompt)
            }}
          >
            {prompt}
            <UnfinishedDot kind="scripted" />
          </Button>
        ))}
      </div>
      <p role="status" className="text-xs text-muted-foreground empty:sr-only">
        {(pending !== null || asked === null) && message && (
          <>
            <ScriptedAnswerLabel />
            {message}
          </>
        )}
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
              setKept(pending)
              setAsked(null)
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
              setAsked(null)
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
