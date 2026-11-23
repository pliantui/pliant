"use client"

import * as React from "react"
import { SparklesIcon } from "lucide-react"
import { Slot } from "radix-ui"
import * as z from "zod"

import {
  usePliantMessages,
  usePreview,
  type PliantMessages,
} from "@pliantui/react"
import { useAskPanel } from "@pliantui/react/ask"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

declare module "@pliantui/react" {
  interface PliantMessages {
    askOpen: string
    /**
     * Appended to `askOpen` to form the trigger's accessible name while a
     * preview shows and the panel is closed. Defaults to "(preview active)".
     */
    askPreviewActive: string
    askUnreadableAnswer: (status: number) => string
  }
}

const askPanelMessages = {
  askOpen: "Ask",
  askTitle: "Ask",
  askPreviewActive: "(preview active)",
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
 * Each surface keeps its chats in the browser's `localStorage`, under keys
 * that start with `pliant:ask-chats:`, titled from their first ask, and a
 * menu switches between them. By default every user of the browser shares
 * them; pass `chatScope`, such as the signed-in user's id, to keep each
 * user's chats apart.
 *
 * The chat's code loads in the browser when the panel first opens, so it
 * adds nothing to the page's first load there. A server-rendering bundler
 * still includes it in the server bundle; to keep it out, load the panel
 * itself only in the browser, as with `next/dynamic` and `ssr: false`.
 *
 * The panel is a non-modal complementary region fixed to the right edge (to
 * the bottom on small screens), so the page and its preview stay usable
 * while it is open. It covers what is under it, so the app must make room:
 * the panel has `data-slot="pliant-ask-panel"` while it is open, so a
 * layout can add padding with, for example,
 * `sm:has-[[data-slot=pliant-ask-panel]]:pr-96` and
 * `max-sm:has-[[data-slot=pliant-ask-panel]]:pb-[60dvh]`. Closing the panel
 * keeps the preview, which the trigger then marks with `data-preview`.
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
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  chatScope,
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
  /** The element that opens the panel. Defaults to an `askOpen` button. */
  trigger?: React.ReactElement
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Keeps chats apart by scope, such as the signed-in user's id, on a
   * browser several users share. By default the chats are per surface only.
   */
  chatScope?: string | undefined
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
  const preview = usePreview()
  const previewing = preview !== null
  // The chat takes focus when it mounts, except on a panel that starts open.
  const [focusOnMount, setFocusOnMount] = React.useState(false)
  const [wasOpen, setWasOpen] = React.useState(panel.open)
  if (wasOpen !== panel.open) {
    setWasOpen(panel.open)
    setFocusOnMount(true)
  }

  return (
    <>
      <Slot.Root {...panel.getTriggerProps()}>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <SparklesIcon />
            {messages.askOpen}
            {previewing && !panel.open && (
              <span className="size-2 rounded-full bg-primary">
                <span className="sr-only">{messages.askPreviewActive}</span>
              </span>
            )}
          </Button>
        )}
      </Slot.Root>
      {panel.open && (
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
              chatScope={chatScope}
            />
          </React.Suspense>
        </aside>
      )}
    </>
  )
}

export {
  PliantAskPanel,
  type PliantAskAnswer,
  type PliantAskContext,
  type PliantAskTarget,
}
