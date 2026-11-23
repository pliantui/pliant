"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import * as z from "zod"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"
import { useAskPanel } from "@pliantui/react/ask"

import { Skeleton } from "@/components/ui/skeleton"

import { createPliantAskChatStore } from "./pliant-ask-chats"

declare module "@pliantui/react" {
  interface PliantMessages {
    askUnreadableAnswer: (status: number) => string
  }
}

const askPanelMessages = {
  askTitle: "Ask",
  askUnreadableAnswer: (status) =>
    `Couldn't read the answer (HTTP ${String(status)}).`,
} satisfies Partial<PliantMessages>

const PliantAskChat = React.lazy(() =>
  import("./pliant-ask-chat").then((module) => ({
    default: module.PliantAskChat,
  }))
)

// Only the envelope is checked here: `preview` validates the overlay against
// the layers and the mounted nodes, which is stricter than its schema.
const askResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), overlay: z.unknown() }),
  z.object({ status: z.literal("clarify"), question: z.string().min(1) }),
  z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
  z.object({ status: z.literal("error"), message: z.string().min(1) }),
])

/** An answer to an ask, as `createPliantHandler` sends it. */
type PliantAskAnswer = z.infer<typeof askResponseSchema>

type PliantAskCapability =
  | "label"
  | "hideable"
  | "slots"
  | "layout"
  | "insertable"
  | "form"
  | "presentation"
  | "nav"
  | "actions"
  | "data"

/**
 * What the server needs to know about a node, as `askContextSchema` in
 * `@pliantui/server` checks it: its manifest, the items it holds and, for
 * data, the fields it can sort by and its current sort. Never rows. A subset
 * of the server's `AskContext`, kept here so the panel doesn't depend on the
 * server package.
 */
interface PliantAskContext {
  manifest: {
    kind: string
    version: number
    description: string
    capabilities: Partial<Record<PliantAskCapability, boolean>>
  }
  collection?: {
    name: "columns" | "slots"
    items: { id: string; label?: string; hidden?: boolean }[]
  }
  fields?: {
    id: string
    label?: string
    type: "text" | "number" | "date" | "boolean" | "enum"
    values?: string[]
  }[]
  sort?: { field: string; dir: "asc" | "desc" }[]
}

/**
 * A node users can ask about: its address, a label for the picker, its
 * context, and optional `suggestions`, asks shown as chips that fill in the
 * prompt.
 */
interface PliantAskTarget {
  id: string
  label: string
  context: PliantAskContext
  suggestions?: readonly string[]
}

async function requestAnswer(
  send: typeof fetch,
  endpoint: string,
  body: unknown,
  signal: AbortSignal,
  unreadable: (status: number) => string
): Promise<PliantAskAnswer> {
  const response = await send(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const json: unknown = await response.json().catch(() => undefined)
  const answer = askResponseSchema.safeParse(json)
  return answer.success
    ? answer.data
    : { status: "error", message: unreadable(response.status) }
}

/**
 * A chat for asking AI to change how a node of the page looks. Each answer
 * shows the steps it took and a preview, on the page and in the chat, that
 * is only saved when the user locks it in. Use it inside a `PliantRoot`; it
 * sends the root's surface with each ask. Its behaviour comes from
 * `useAskPanel`.
 *
 * The panel keeps several chats about the page, titled from their first
 * ask, and a menu switches between them. They're kept in memory only, and
 * clear when the user leaves the page.
 *
 * The chat's code loads in the browser when the panel first opens, so it
 * adds nothing to the page's first load there. A server-rendering bundler
 * still includes it in the server bundle; to keep it out, load the panel
 * itself only in the browser, as with `next/dynamic` and `ssr: false`.
 *
 * The panel is a non-modal complementary region fixed to the right edge of
 * the window (to the bottom on small screens), rendered in `document.body`,
 * so the page and its preview stay usable while it is open. It covers what
 * is under it, so the app must make room: the panel has
 * `data-slot="pliant-ask-panel"` while it is open, so a layout can add
 * padding with, for example, `group/body` on `<body>` and
 * `sm:group-has-[[data-slot=pliant-ask-panel]]/body:pr-96` and
 * `max-sm:group-has-[[data-slot=pliant-ask-panel]]/body:pb-[60dvh]`.
 *
 * The panel has no button of its own: something else opens it with `open`
 * and `onOpenChange`, such as `PliantCustomizeMenu`'s Ask item, which then
 * gets focus back when the panel closes. Closing the panel keeps the
 * preview; with `usePreview`, the app can mark what opens the panel while a
 * preview shows, as `PliantCustomizeMenu`'s `previewing` does.
 *
 * The target can be controlled with `target` and `onTargetChange`, so a
 * target picked elsewhere on the page, as with `PliantPointMode`, can be
 * asked about.
 */
function PliantAskPanel({
  endpoint,
  fetch: send = (input, init) => fetch(input, init),
  targets,
  target,
  defaultTarget,
  onTargetChange,
  placeholder,
  answerLabel,
  open,
  defaultOpen,
  onOpenChange,
}: {
  /** The URL of the route that answers asks with `createPliantHandler`. */
  endpoint: string
  /**
   * Sends each ask, in place of the global `fetch`, as for tests or to
   * answer asks from somewhere other than the network.
   */
  fetch?: typeof fetch
  /** The nodes users can ask about, in picker order. */
  targets: readonly PliantAskTarget[]
  /** The id of the picked target, when the parent controls it. */
  target?: string | undefined
  /** The id of the target picked first. Defaults to the first target. */
  defaultTarget?: string
  /**
   * Called with the id of the target the user picks in the picker. A
   * controlled parent applies it by passing it back as `target`, right away
   * or later, as after a navigation, and focus stays on the picker.
   */
  onTargetChange?: (target: string) => void
  /** The prompt's placeholder, in place of `askPromptPlaceholder`. */
  placeholder?: string
  /**
   * Heads the answer to an ask, given the ask's target id and prompt, such
   * as to mark answers that weren't written by a model.
   */
  answerLabel?:
    ((ask: { target: string; prompt: string }) => React.ReactNode) | undefined
  open?: boolean
  defaultOpen?: boolean
  /**
   * Called when the panel opens or closes. Focus goes nowhere when the
   * panel closes, so this should move it, as back to what opened the panel.
   */
  onOpenChange?: (open: boolean) => void
}) {
  const messages = usePliantMessages(askPanelMessages)
  const [answers] = React.useState(
    () => new Set<(answer: PliantAskAnswer) => void>()
  )
  const panel = useAskPanel({
    targets,
    target,
    defaultTarget,
    onTargetChange,
    open,
    defaultOpen,
    onOpenChange,
    send: async (ask, signal) => {
      const answer = await requestAnswer(
        send,
        endpoint,
        {
          surface: ask.surface,
          target: ask.target.id,
          prompt: ask.prompt,
          context: ask.target.context,
        },
        signal,
        messages.askUnreadableAnswer
      )
      for (const listener of answers) {
        listener(answer)
      }
      return answer
    },
  })
  const id = React.useId()
  // Held here, so the chats outlive the chat while the panel is closed.
  const [chats] = React.useState(createPliantAskChatStore)
  // The chat takes focus when it mounts, except on a panel that starts open
  // by `defaultOpen`. A panel loaded after the parent opened it, as with
  // `next/dynamic`, takes focus too.
  const [focusOnMount, setFocusOnMount] = React.useState(open === true)
  const [wasOpen, setWasOpen] = React.useState(panel.open)
  if (wasOpen !== panel.open) {
    setWasOpen(panel.open)
    setFocusOnMount(true)
  }

  const client = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )
  if (!panel.open || !client) return null

  // In `document.body`, so no container of the page's clips it, positions
  // it or makes room for it.
  return createPortal(
    <aside
      {...panel.getPanelProps()}
      aria-labelledby={`${id}-title`}
      className="fixed inset-x-0 bottom-0 z-50 flex h-[60dvh] flex-col border-t bg-background shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:w-full sm:max-w-sm sm:border-t-0 sm:border-l sm:motion-safe:slide-in-from-right"
    >
      <React.Suspense
        fallback={
          <div className="flex flex-col gap-3 p-4">
            <h2 id={`${id}-title`} className="font-semibold">
              {messages.askTitle}
            </h2>
            <Skeleton className="h-8 w-full" />
          </div>
        }
      >
        <PliantAskChat
          panel={panel}
          targets={targets}
          placeholder={placeholder}
          titleId={`${id}-title`}
          autoFocus={focusOnMount}
          answers={answers}
          store={chats}
          answerLabel={answerLabel}
        />
      </React.Suspense>
    </aside>,
    document.body
  )
}

function subscribeToNothing() {
  return () => undefined
}

export {
  PliantAskPanel,
  type PliantAskAnswer,
  type PliantAskContext,
  type PliantAskTarget,
}
