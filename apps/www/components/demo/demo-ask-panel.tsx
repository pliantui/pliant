"use client"

import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { ScriptedAnswerLabel } from "@/components/demo/scripted-answer-label"
import { LazyAskPanel } from "@/components/lazy-ask-panel"
import { memoryAdapter } from "@/lib/demo/memory-adapter"
import { isScriptedAsk, replayFetch } from "@/lib/replay/replay-fetch"
import type {
  PliantAskContext,
  PliantAskTarget,
} from "@/registry/pliant/pliant-ask-panel"

// A part's suggested asks, as a demo offers them under the part. The chat
// offers the same asks for the part.
export interface DemoAskSuggestions {
  target: string
  // The part's name, as the chat's picker shows it.
  label: string
  prompts: readonly string[]
  // The part's context, when it's a Pliant node with one.
  context?: PliantAskContext | undefined
  // Plays an ask the demo draws itself, rather than through the layers,
  // and returns what the chat answers.
  play?: ((prompt: string) => string) | undefined
}

// A part the chat asks about, with its context when it's a Pliant node.
type DemoAskTarget = Omit<PliantAskTarget, "context"> & {
  context?: PliantAskContext | undefined
}

interface DemoAskScope {
  // Opens the chat, on `target` when it's given.
  ask: (target?: string) => void
  open: boolean
  register: (entry: DemoAskSuggestions) => () => void
}

// The chat of the demo around a part, for the parts that ask about
// themselves.
export const DemoAskContext = React.createContext<DemoAskScope | null>(null)

export function useDemoAsk() {
  return React.use(DemoAskContext)
}

function same(a: string, b: string) {
  return a.trim() === b.trim()
}

// A target without a manifest of its own, as a part the demo draws.
function contextOf(label: string): PliantAskContext {
  return {
    manifest: {
      kind: "demo",
      version: 1,
      description: label,
      capabilities: {},
    },
  }
}

function capitalize(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function targetsOf(entries: readonly DemoAskSuggestions[]) {
  const targets = new Map<string, PliantAskTarget>()
  for (const entry of entries) {
    const known = targets.get(entry.target)
    const suggestions = [
      ...new Set([...(known?.suggestions ?? []), ...entry.prompts]),
    ]
    targets.set(entry.target, {
      id: entry.target,
      label: known?.label ?? capitalize(entry.label),
      context: known?.context ?? entry.context ?? contextOf(entry.label),
      suggestions,
    })
  }
  return [...targets.values()]
}

function isAsk(
  value: unknown
): value is { target: string; prompt: string; surface: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "target" in value &&
    typeof value.target === "string" &&
    "prompt" in value &&
    typeof value.prompt === "string"
  )
}

// Only one demo's chat is open at a time.
const openEvent = "pliant-demo-ask-open"

/**
 * The chat for a demo: the Customize menus' Ask opens it on their part, and
 * its empty state offers the part's suggested asks. Recorded asks replay,
 * scripted asks play their hand-written answers, marked as such, and any
 * other ask gets an honest reply. No model is called. Inside another
 * `DemoAsk`, it adds its parts to that one's chat instead. `surface` gives
 * it layers of its own, for a demo that isn't in a `PliantRoot`.
 */
export function DemoAsk({
  targets,
  surface,
  children,
}: {
  // Parts that are Pliant nodes, with their context and suggestions.
  targets?: readonly DemoAskTarget[] | undefined
  surface?: string | undefined
  children: React.ReactNode
}) {
  const parent = useDemoAsk()
  if (parent) {
    return (
      <ForwardedTargets scope={parent} targets={targets}>
        {children}
      </ForwardedTargets>
    )
  }
  const chat = <DemoAskChat targets={targets}>{children}</DemoAskChat>
  return surface ? (
    <PliantRoot surface={surface} storage={demoStorage}>
      {chat}
    </PliantRoot>
  ) : (
    chat
  )
}

const demoStorage = memoryAdapter()

function ForwardedTargets({
  scope,
  targets = [],
  children,
}: {
  scope: DemoAskScope
  targets?: readonly DemoAskTarget[] | undefined
  children: React.ReactNode
}) {
  const { register } = scope
  const latest = React.useRef(targets)
  React.useLayoutEffect(() => {
    latest.current = targets
  })
  // Registers again only when the targets' content changes, not each
  // render's new array.
  const key = JSON.stringify(
    targets.map((target) => [target.id, target.label, target.suggestions])
  )
  React.useLayoutEffect(() => {
    const unregister = latest.current.map((target) =>
      register({
        target: target.id,
        label: target.label,
        prompts: target.suggestions ?? [],
        context: target.context,
      })
    )
    return () => {
      for (const done of unregister) done()
    }
  }, [register, key])
  return children
}

function DemoAskChat({
  targets,
  children,
}: {
  targets?: readonly DemoAskTarget[] | undefined
  children: React.ReactNode
}) {
  const id = React.useId()
  const container = React.useRef<HTMLDivElement>(null)
  const returnTo = React.useRef<HTMLElement | null>(null)
  const [registered, setRegistered] = React.useState<
    readonly { key: number; entry: DemoAskSuggestions }[]
  >([])
  const [open, setOpen] = React.useState(false)
  const [target, setTarget] = React.useState<string>()
  const entries = React.useMemo(
    (): DemoAskSuggestions[] => [
      ...(targets ?? []).map((item) => ({
        target: item.id,
        label: item.label,
        prompts: item.suggestions ?? [],
        context: item.context,
      })),
      ...registered.map(({ entry }) => entry),
    ],
    [targets, registered]
  )
  const latest = React.useRef(entries)
  React.useLayoutEffect(() => {
    latest.current = entries
  }, [entries])
  const askTargets = React.useMemo(() => targetsOf(entries), [entries])

  const next = React.useRef(0)
  const actions = React.useMemo<Omit<DemoAskScope, "open">>(
    () => ({
      ask: (part) => {
        if (part !== undefined) setTarget(part)
        const active = document.activeElement
        returnTo.current =
          active instanceof HTMLElement && active !== document.body
            ? active
            : null
        setOpen(true)
        window.dispatchEvent(new CustomEvent(openEvent, { detail: id }))
      },
      register: (entry) => {
        const key = next.current++
        setRegistered((current) => [...current, { key, entry }])
        return () => {
          setRegistered((current) => current.filter((item) => item.key !== key))
        }
      },
    }),
    [id]
  )
  const value = React.useMemo(() => ({ ...actions, open }), [actions, open])

  React.useEffect(() => {
    function onOpen(event: Event) {
      if (event instanceof CustomEvent && event.detail !== id) setOpen(false)
    }
    window.addEventListener(openEvent, onOpen)
    return () => {
      window.removeEventListener(openEvent, onOpen)
    }
  }, [id])

  const played = React.useCallback((part: string, prompt: string) => {
    for (const entry of latest.current) {
      if (
        entry.target === part &&
        entry.play &&
        entry.prompts.some((candidate) => same(candidate, prompt))
      ) {
        return entry.play
      }
    }
    return undefined
  }, [])

  const send = React.useCallback(
    (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      let body: unknown
      try {
        body = typeof init?.body === "string" ? JSON.parse(init.body) : null
      } catch {
        body = null
      }
      const play = isAsk(body) ? played(body.target, body.prompt) : undefined
      if (isAsk(body) && play) {
        return Promise.resolve(
          Response.json({ status: "clarify", question: play(body.prompt) })
        )
      }
      return replayFetch(input, init)
    },
    [played]
  )

  return (
    <DemoAskContext value={value}>
      <div ref={container} className="contents">
        {children}
      </div>
      <LazyAskPanel
        // Every ask is answered in the browser, so no request leaves the
        // page.
        endpoint="/replay"
        fetch={send}
        targets={askTargets}
        target={target}
        onTargetChange={setTarget}
        answerLabel={(ask) =>
          isScriptedAsk(ask.target, ask.prompt) ||
          played(ask.target, ask.prompt) ? (
            <ScriptedAnswerLabel />
          ) : null
        }
        open={open && askTargets.length > 0}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) return
          // After the panel unmounts, focus has nowhere left to be.
          requestAnimationFrame(() => {
            if (document.activeElement !== document.body) return
            const back = returnTo.current
            const fallback = container.current?.querySelector<HTMLElement>(
              '[data-slot="pliant-customize-menu"] button'
            )
            ;(back?.isConnected ? back : fallback)?.focus()
          })
        }}
      />
    </DemoAskContext>
  )
}

// Offers a part's suggested asks in the chat of the demo around it.
export function useDemoAskSuggestions(entry: DemoAskSuggestions) {
  const scope = useDemoAsk()
  const register = scope?.register
  const latest = React.useRef(entry)
  React.useLayoutEffect(() => {
    latest.current = entry
  })
  const hasPlay = entry.play !== undefined
  const { target, label } = entry
  const prompts = JSON.stringify(entry.prompts)
  React.useLayoutEffect(() => {
    if (!register) return
    return register({
      target,
      label,
      context: latest.current.context,
      prompts: latest.current.prompts,
      play: hasPlay
        ? (prompt) => latest.current.play?.(prompt) ?? ""
        : undefined,
    })
  }, [register, target, label, prompts, hasPlay])
}
