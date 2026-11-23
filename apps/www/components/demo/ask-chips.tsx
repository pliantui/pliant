"use client"

import * as React from "react"
import { SparklesIcon } from "lucide-react"

import {
  usePliantStore,
  usePliantSurface,
  usePreview,
  type Overlay,
} from "@pliantui/react"

import { useDemoAskSuggestions } from "@/components/demo/demo-ask-panel"
import { ScriptedAnswerLabel } from "@/components/demo/scripted-answer-label"
import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { isScriptedAsk, replayAnswer } from "@/lib/replay/replay-fetch"

const unavailable = "This change can't be shown right now. Try another ask."

// Suggested asks for one part of a demo. Picking one previews its answer in
// place, to lock in or discard. The chat around the demo offers them too.
export function AskChips({
  target,
  label,
  prompts,
  more = false,
  lockInAtOnce = false,
  onLockIn,
  onDiscard,
}: {
  // The node the asks change.
  target: string
  // The node's name, as the asks' group label reads it.
  label: string
  prompts: readonly string[]
  // Whether these asks follow the part's other asks.
  more?: boolean
  // Keeps each answer at once instead of previewing it to lock in or
  // discard.
  lockInAtOnce?: boolean
  // Runs with the personal version an answer became, once it's locked in.
  onLockIn?: ((overlay: Overlay) => void) | undefined
  // Runs when the user discards a previewed answer.
  onDiscard?: (() => void) | undefined
}) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const preview = usePreview()
  useDemoAskSuggestions({ target, label, prompts })
  const groupRef = React.useRef<HTMLDivElement>(null)
  const [asked, setAsked] = React.useState<{
    id: string | null
    message: string
    scripted?: boolean
  } | null>(null)
  const previewing = asked?.id != null && preview?.id === asked.id
  const scripted = prompts.some((prompt) => isScriptedAsk(target, prompt))
  const shown = asked && (previewing || asked.id === null) ? asked : null

  // Keeps the previewed answer. Returns the message to show.
  function lockIn(explain: string) {
    const result = store.lockIn()
    if (!result.success) {
      store.discard()
      return unavailable
    }
    if (result.overlay) onLockIn?.(result.overlay)
    return result.keptInSession.length > 0
      ? "Some of this change stays for this session only."
      : explain
  }

  // The buttons that end a preview go away, so focus goes back to the asks.
  function settle(next: { id: null; message: string } | null) {
    setAsked(next)
    groupRef.current?.querySelector("button")?.focus()
  }

  return (
    <div
      className="flex flex-col gap-2"
      // Found by the unfinished work check: a scripted answer stands in for
      // a recording.
      data-unfinished={scripted ? "scripted" : undefined}
    >
      <div
        ref={groupRef}
        role="group"
        aria-label={`${more ? "More asks" : "Ask"} about ${label}`}
        className="flex flex-wrap gap-1.5"
      >
        {prompts.map((prompt) => {
          const isScripted = isScriptedAsk(target, prompt)
          return (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-7 max-w-full rounded-full px-2.5 py-1 text-left text-xs font-normal whitespace-normal"
              onClick={() => {
                const answer = replayAnswer({ surface, target, prompt })
                if (answer.status !== "ok") {
                  setAsked({
                    id: null,
                    message:
                      answer.status === "clarify"
                        ? answer.question
                        : answer.reason,
                    scripted: isScripted,
                  })
                  return
                }
                const result = store.preview(answer.overlay)
                const explain = answer.explain.join(" ")
                if (!result.success) {
                  setAsked({ id: null, message: unavailable })
                  return
                }
                setAsked(
                  lockInAtOnce
                    ? {
                        id: null,
                        message: lockIn(explain),
                        scripted: isScripted,
                      }
                    : {
                        id: answer.overlay.id,
                        message: explain,
                        scripted: isScripted,
                      }
                )
              }}
            >
              {!isScripted && <SparklesIcon className="size-3" />}
              {prompt}
              {isScripted && <UnfinishedDot kind="scripted" />}
            </Button>
          )
        })}
      </div>
      <p
        role="status"
        // Out of the layout while empty, so it adds no gap under the asks.
        className="text-xs text-muted-foreground empty:sr-only"
      >
        {shown?.message && shown.scripted && <ScriptedAnswerLabel />}
        {shown?.message}
      </p>
      {previewing && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={() => {
              const message = lockIn("")
              settle(message ? { id: null, message } : null)
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
              store.discard()
              onDiscard?.()
              settle(null)
            }}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  )
}
