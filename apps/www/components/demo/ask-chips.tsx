"use client"

import * as React from "react"
import { SparklesIcon } from "lucide-react"

import { usePliantStore, usePliantSurface, usePreview } from "@pliantui/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isScriptedAsk, replayAnswer } from "@/lib/replay/replay-fetch"

const unavailable = "This change can't be shown right now. Try another ask."

// Suggested asks for one part of a demo. Picking one previews its answer in
// place, to lock in or discard.
export function AskChips({
  target,
  label,
  prompts,
}: {
  // The node the asks change.
  target: string
  // The node's name, as the asks' group label reads it.
  label: string
  prompts: readonly string[]
}) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const preview = usePreview()
  const groupRef = React.useRef<HTMLDivElement>(null)
  const [asked, setAsked] = React.useState<{
    id: string | null
    message: string
  } | null>(null)
  const previewing = asked?.id != null && preview?.id === asked.id
  const scripted = prompts.some((prompt) => isScriptedAsk(target, prompt))
  const message =
    asked && (previewing || asked.id === null) ? asked.message : ""

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
        aria-label={`Ask about ${label}`}
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
              className="h-7 rounded-full px-2.5 text-xs font-normal"
              onClick={() => {
                const answer = replayAnswer(
                  { surface, target, prompt },
                  { scripted: true }
                )
                if (answer.status !== "ok") {
                  setAsked({
                    id: null,
                    message:
                      answer.status === "clarify"
                        ? answer.question
                        : answer.reason,
                  })
                  return
                }
                const result = store.preview(answer.overlay)
                setAsked(
                  result.success
                    ? {
                        id: answer.overlay.id,
                        message: answer.explain.join(" "),
                      }
                    : { id: null, message: unavailable }
                )
              }}
            >
              {!isScripted && <SparklesIcon className="size-3" />}
              {prompt}
              {isScripted && (
                <Badge
                  variant="secondary"
                  className="-mr-1 h-4 rounded-full px-1.5 text-[10px]"
                >
                  Scripted
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {message}
      </p>
      {previewing && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={() => {
              const result = store.lockIn()
              if (!result.success) {
                setAsked({ id: asked.id, message: unavailable })
                return
              }
              settle(
                result.keptInSession.length > 0
                  ? {
                      id: null,
                      message:
                        "Some of this change stays for this session only.",
                    }
                  : null
              )
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
