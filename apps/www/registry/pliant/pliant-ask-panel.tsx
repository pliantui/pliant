"use client"

import * as React from "react"
import { cn } from "cn"
import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react"
import { Slot } from "radix-ui"
import * as z from "zod"

import { usePreview } from "@pliantui/react"
import { useAskPanel } from "@pliantui/react/ask"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

const maxPromptLength = 500

// Only the envelope is checked here: `preview` validates the overlay against
// the layers and the mounted nodes, which is stricter than its schema.
const askResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), overlay: z.unknown() }),
  z.object({ status: z.literal("clarify"), question: z.string().min(1) }),
  z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
  z.object({ status: z.literal("error"), message: z.string().min(1) }),
])

type Answer = z.infer<typeof askResponseSchema>

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
 * server package (see https://github.com/pliantui/pliant/issues/48).
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
  endpoint: string,
  body: unknown,
  signal: AbortSignal
): Promise<Answer> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const json: unknown = await response.json().catch(() => undefined)
  const answer = askResponseSchema.safeParse(json)
  return answer.success
    ? answer.data
    : {
        status: "error",
        message: `Couldn't read the answer (HTTP ${String(response.status)}).`,
      }
}

function sessionNote(count: number) {
  return count === 1
    ? "1 change stays for this session only."
    : `${String(count)} changes stay for this session only.`
}

/**
 * A panel for asking AI to change how a node of the page looks. The answer
 * is previewed on the page, and nothing is saved until the user locks it in.
 * Use it inside a `PliantRoot`; it sends the root's surface with each ask.
 * Its behaviour comes from `useAskPanel`.
 *
 * The panel is a non-modal complementary region fixed to the right edge (to
 * the bottom on small screens), so the page and its preview stay usable
 * while it is open. It covers what is under it, so the app must make room:
 * the panel has `data-slot="pliant-ask-panel"` while it is open, so a
 * layout can add padding with, for example,
 * `sm:has-[[data-slot=pliant-ask-panel]]:pr-96` and
 * `max-sm:has-[[data-slot=pliant-ask-panel]]:pb-[60dvh]`. On small screens,
 * the suggestions hide while a preview shows. Closing the panel keeps the
 * preview, which the trigger then marks with `data-preview`.
 *
 * The target can be controlled with `target` and `onTargetChange`, so a
 * target picked elsewhere on the page, as with `PliantPointMode`, can be
 * asked about.
 */
function PliantAskPanel({
  endpoint,
  targets,
  target,
  defaultTarget,
  onTargetChange,
  placeholder = "Describe a change",
  trigger,
  open,
  defaultOpen,
  onOpenChange,
}: {
  /** The URL of the route that answers asks with `createPliantHandler`. */
  endpoint: string
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
  /** The prompt's placeholder. */
  placeholder?: string
  /** The element that opens the panel. Defaults to an "Ask" button. */
  trigger?: React.ReactElement
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const panel = useAskPanel({
    targets,
    target,
    defaultTarget,
    onTargetChange,
    open,
    defaultOpen,
    onOpenChange,
    send: (ask, signal) =>
      requestAnswer(
        endpoint,
        {
          surface: ask.surface,
          target: ask.target.id,
          prompt: ask.prompt,
          context: ask.target.context,
        },
        signal
      ),
  })
  const id = React.useId()
  const preview = usePreview()
  const { state } = panel
  const asking = state.status === "asking"
  const previewing = preview !== null
  const explain = asking ? [] : [...new Set(preview?.explain)]
  const suggestions = panel.target?.suggestions ?? []

  return (
    <>
      <Slot.Root {...panel.getTriggerProps()}>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <SparklesIcon />
            Ask
            {previewing && !panel.open && (
              <span className="size-2 rounded-full bg-primary">
                <span className="sr-only">(preview active)</span>
              </span>
            )}
          </Button>
        )}
      </Slot.Root>
      {panel.open && (
        <aside
          {...panel.getPanelProps()}
          aria-labelledby={`${id}-title`}
          className="animate-in slide-in-from-bottom sm:slide-in-from-right fixed inset-x-0 bottom-0 z-50 flex max-h-[60dvh] flex-col overflow-y-auto border-t bg-background shadow-lg sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-sm sm:border-t-0 sm:border-l"
        >
          <div className="flex items-start justify-between gap-2 p-4 pb-0">
            <div className="flex flex-col gap-1.5">
              <h2 id={`${id}-title`} className="font-semibold">
                Ask
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe how this page should look. You see a preview, and
                nothing is saved until you lock it in.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Close"
              onClick={() => {
                panel.setOpen(false)
              }}
            >
              <XIcon />
            </Button>
          </div>
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              panel.ask()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-target`}>Change</Label>
              <Select
                value={panel.target?.id ?? ""}
                onValueChange={panel.setTarget}
                disabled={asking}
              >
                <SelectTrigger
                  {...panel.getPickerProps()}
                  id={`${id}-target`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-prompt`}>Ask</Label>
              <Textarea
                {...panel.getPromptProps()}
                id={`${id}-prompt`}
                maxLength={maxPromptLength}
                placeholder={placeholder}
                aria-describedby={`${id}-hint`}
              />
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                Enter to send, Shift+Enter for a new line.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              {asking && (
                <Button type="button" variant="outline" onClick={panel.cancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={asking || panel.prompt.trim() === ""}
              >
                {asking && <Loader2Icon className="animate-spin" />}
                Send
              </Button>
            </div>
          </form>
          {/* Sticky, so an answer shows without scrolling the docked panel. */}
          <div
            className={cn(
              "sticky bottom-0 flex flex-col gap-3 bg-background px-4",
              (state.status !== "idle" || previewing) && "border-y py-4"
            )}
          >
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 text-sm break-words"
            >
              {state.status === "asking" && (
                <>
                  <span className="sr-only">Asking…</span>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              )}
              {state.status === "clarify" && <p>{state.question}</p>}
              {state.status === "unavailable" && (
                <p className="text-muted-foreground">{state.reason}</p>
              )}
              {state.status === "failed" && (
                <p className="text-destructive">{state.message}</p>
              )}
              {state.status === "cancelled" && <p>Cancelled.</p>}
              {state.status === "discarded" && <p>Discarded.</p>}
              {state.status === "locked" && (
                <>
                  <p>Locked in.</p>
                  {state.keptInSession.length > 0 && (
                    <p className="text-muted-foreground">
                      {sessionNote(state.keptInSession.length)}
                    </p>
                  )}
                </>
              )}
              {explain.length > 0 && (
                <div
                  className={cn(
                    "flex flex-col gap-2",
                    state.status !== "idle" && "border-t pt-3"
                  )}
                >
                  <Badge variant="secondary">Current preview</Badge>
                  <ul className="flex flex-col gap-1">
                    {explain.map((sentence) => (
                      <li key={sentence}>{sentence}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {previewing && !asking && (
              <div className="flex gap-2">
                <Button type="button" onClick={panel.lockIn}>
                  Lock in
                </Button>
                <Button type="button" variant="outline" onClick={panel.discard}>
                  Discard
                </Button>
              </div>
            )}
          </div>
          {suggestions.length > 0 && (
            <div
              role="group"
              aria-label="Suggestions"
              className={cn(
                "flex flex-wrap gap-2 p-4",
                previewing && "max-sm:hidden"
              )}
            >
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-auto py-1 text-left whitespace-normal"
                  disabled={asking}
                  onClick={() => {
                    panel.setPrompt(suggestion)
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </aside>
      )}
    </>
  )
}

export { PliantAskPanel, type PliantAskContext, type PliantAskTarget }
