"use client"

import * as React from "react"

import { replayFetch } from "@/lib/replay/replay-fetch"
import {
  PliantAskPanel,
  type PliantAskTarget,
} from "@/registry/pliant/pliant-ask-panel"

// The ask panel of a demo: what it asks about, and whether it's open. Ask in
// a Customize menu opens it on that menu's part.
export function useDemoAsk(targets: readonly PliantAskTarget[]) {
  const [open, setOpen] = React.useState(false)
  const [target, setTarget] = React.useState(targets[0]?.id)
  const ask = React.useCallback((id?: string) => {
    if (id !== undefined) setTarget(id)
    setOpen(true)
  }, [])
  return { targets, open, setOpen, target, setTarget, ask }
}

export type DemoAsk = ReturnType<typeof useDemoAsk>

// The panel itself, answering from the recorded answers in the browser. The
// Customize menus open it, so it has no button of its own; when it closes
// with focus inside it, focus goes to `returnFocus`.
export function DemoAskPanel({
  ask,
  returnFocus,
}: {
  ask: DemoAsk
  returnFocus?: React.RefObject<HTMLElement | null> | undefined
}) {
  return (
    <PliantAskPanel
      // Every ask goes to `replayFetch`, so no request leaves the page.
      endpoint="/replay"
      fetch={replayFetch}
      targets={ask.targets}
      target={ask.target}
      onTargetChange={ask.setTarget}
      open={ask.open}
      onOpenChange={(open) => {
        ask.setOpen(open)
        if (open) return
        // After the panel unmounts, focus has nowhere left to be.
        requestAnimationFrame(() => {
          if (document.activeElement === document.body) {
            returnFocus?.current?.focus()
          }
        })
      }}
      trigger={null}
    />
  )
}

// The page's ask panel, for the parts of a demo that ask about themselves.
export const DemoAskContext = React.createContext<DemoAsk | null>(null)
