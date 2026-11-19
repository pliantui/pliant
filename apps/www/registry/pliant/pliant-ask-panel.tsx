"use client"

import * as React from "react"
import { cn } from "cn"
import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react"
import { Slot } from "radix-ui"
import * as z from "zod"

import {
  usePliantStatus,
  usePliantStore,
  usePliantSurface,
  usePreview,
  type PliantStore,
} from "@pliantui/react"

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

type Op = Extract<
  ReturnType<PliantStore["lockIn"]>,
  { success: true }
>["keptInSession"][number]

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

type AskState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "clarify"; question: string }
  | { status: "failed"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "cancelled" }
  | { status: "discarded" }
  | { status: "locked"; keptInSession: readonly Op[] }

async function requestAnswer(
  endpoint: string,
  body: unknown,
  signal: AbortSignal
): Promise<Answer> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
  } catch {
    return {
      status: "error",
      message: "Couldn't reach the server. Check your connection.",
    }
  }
  const json: unknown = await response.json().catch(() => undefined)
  const answer = askResponseSchema.safeParse(json)
  return answer.success
    ? answer.data
    : {
        status: "error",
        message: `Couldn't read the answer (HTTP ${String(response.status)}).`,
      }
}

function unique(sentences: readonly string[] | undefined) {
  return [...new Set(sentences)]
}

function sessionNote(ops: readonly Op[]) {
  return ops.length === 1
    ? "1 change stays for this session only."
    : `${String(ops.length)} changes stay for this session only.`
}

/**
 * A panel for asking AI to change how a node of the page looks. The answer
 * is previewed on the page, and nothing is saved until the user locks it in.
 * Use it inside a `PliantRoot`; it sends the root's surface with each ask.
 *
 * The panel is a non-modal complementary region fixed to the right edge (to
 * the bottom on small screens), so the page and its preview stay usable
 * while it is open. It covers what is under it, so the app must make room:
 * the panel has `data-slot="pliant-ask-panel"` while it is open, so a
 * layout can add padding with, for example,
 * `sm:has-[[data-slot=pliant-ask-panel]]:pr-96`. Escape closes it while
 * focus is inside it. Closing it cancels an ask in progress but keeps the
 * preview, which the trigger then marks with `data-preview`. The prompt is
 * kept when the target changes, so the same ask can go to another target.
 *
 * The target can be controlled with `target` and `onTargetChange`, so a
 * target picked elsewhere on the page, as with `PliantPointMode`, can be
 * asked about: focus moves to the prompt when the panel opens and when its
 * parent changes `target` while it is open. A target that isn't one of
 * `targets` falls back to the first. Changing the target, from anywhere,
 * cancels an ask in progress.
 */
function PliantAskPanel({
  endpoint,
  targets,
  target: targetProp,
  defaultTarget,
  onTargetChange,
  placeholder = "Describe a change",
  trigger,
  open,
  defaultOpen = false,
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
  const store = usePliantStore()
  const surface = usePliantSurface()
  const preview = usePreview()
  const ready = usePliantStatus().status === "ready"
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [uncontrolledTarget, setUncontrolledTarget] =
    React.useState(defaultTarget)
  const [prompt, setPrompt] = React.useState("")
  const [state, setState] = React.useState<AskState>({ status: "idle" })
  const request = React.useRef<AbortController | null>(null)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLElement>(null)
  const id = React.useId()
  const isOpen = open ?? uncontrolledOpen
  const [focusRequest, setFocusRequest] = React.useState(0)
  const targetId = targetProp ?? uncontrolledTarget
  const target =
    targets.find((candidate) => candidate.id === targetId) ?? targets[0]

  // An answer for one target must never be previewed under another, and a
  // passive effect would leave a gap for one to land in after the target
  // changed outside an event, from a timer or a transition.
  React.useLayoutEffect(
    () => () => {
      if (request.current) {
        request.current.abort()
        request.current = null
        setState({ status: "cancelled" })
      }
    },
    [target?.id]
  )

  const [wasOpen, setWasOpen] = React.useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setFocusRequest((count) => count + 1)
    } else if (state.status === "asking") {
      setState({ status: "cancelled" })
    }
  }

  const [seenTarget, setSeenTarget] = React.useState(target?.id)
  if (seenTarget !== target?.id) {
    setSeenTarget(target?.id)
    if (state.status !== "asking") {
      setState({ status: "idle" })
    }
  }

  // The target the picker last set, to tell the parent's own changes apart.
  // A parent may apply the pick later, so it is kept until `target` changes
  // or focus leaves the picker, as it does when pointing at the page; a pick
  // the parent rejected must not hide a later change of its own.
  const [pickerTarget, setPickerTarget] = React.useState<string>()
  const [seenTargetProp, setSeenTargetProp] = React.useState(targetProp)
  if (seenTargetProp !== targetProp) {
    setSeenTargetProp(targetProp)
    setPickerTarget(undefined)
    if (isOpen && targetProp !== pickerTarget) {
      setFocusRequest((count) => count + 1)
    }
  }

  React.useLayoutEffect(() => {
    if (!isOpen) {
      request.current?.abort()
      request.current = null
    }
  }, [isOpen])

  React.useEffect(() => {
    if (focusRequest > 0) {
      promptRef.current?.focus()
    }
  }, [focusRequest])

  const asking = state.status === "asking"

  function setOpen(next: boolean) {
    if (open === undefined) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }

  function close() {
    const hadFocus = panelRef.current?.contains(document.activeElement)
    setOpen(false)
    if (hadFocus) {
      triggerRef.current?.focus()
    }
  }

  async function ask() {
    const text = prompt.trim()
    if (request.current || !target || text === "") {
      return
    }
    if (!ready) {
      setState({
        status: "failed",
        message: "The page is still loading. Try again in a moment.",
      })
      return
    }
    const controller = new AbortController()
    request.current = controller
    setState({ status: "asking" })
    const answer = await requestAnswer(
      endpoint,
      { surface, target: target.id, prompt: text, context: target.context },
      controller.signal
    )
    if (controller.signal.aborted) {
      return
    }
    request.current = null
    if (answer.status === "ok") {
      const result = store.preview(answer.overlay)
      setState(
        result.success
          ? { status: "idle" }
          : {
              status: "failed",
              message: `The answer couldn't be previewed: ${result.error}`,
            }
      )
    } else if (answer.status === "clarify") {
      setState({ status: "clarify", question: answer.question })
    } else if (answer.status === "unavailable") {
      setState({ status: "unavailable", reason: answer.reason })
    } else {
      setState({ status: "failed", message: answer.message })
    }
  }

  function cancel() {
    request.current?.abort()
    request.current = null
    setState({ status: "cancelled" })
    promptRef.current?.focus()
  }

  function lockIn() {
    const result = store.lockIn()
    setState(
      result.success
        ? { status: "locked", keptInSession: result.keptInSession }
        : { status: "failed", message: result.error }
    )
    promptRef.current?.focus()
  }

  function discard() {
    store.discard()
    setState({ status: "discarded" })
    promptRef.current?.focus()
  }

  const explain = asking ? [] : unique(preview?.explain)
  const previewing = preview !== null

  return (
    <>
      <Slot.Root
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-panel` : undefined}
        data-state={isOpen ? "open" : "closed"}
        data-preview={previewing ? "" : undefined}
        onClick={() => {
          if (isOpen) {
            close()
          } else {
            setOpen(true)
          }
        }}
      >
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <SparklesIcon />
            Ask
            {previewing && !isOpen && (
              <span className="size-2 rounded-full bg-primary">
                <span className="sr-only">(preview active)</span>
              </span>
            )}
          </Button>
        )}
      </Slot.Root>
      {isOpen && (
        <aside
          ref={panelRef}
          id={`${id}-panel`}
          aria-labelledby={`${id}-title`}
          data-slot="pliant-ask-panel"
          data-state="open"
          className="animate-in slide-in-from-bottom sm:slide-in-from-right fixed inset-x-0 bottom-0 z-50 flex max-h-[60dvh] flex-col overflow-y-auto border-t bg-background shadow-lg sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-sm sm:border-t-0 sm:border-l"
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              !event.nativeEvent.isComposing &&
              event.target instanceof Node &&
              event.currentTarget.contains(event.target)
            ) {
              event.preventDefault()
              close()
            }
          }}
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
              onClick={close}
            >
              <XIcon />
            </Button>
          </div>
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void ask()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-target`}>Change</Label>
              <Select
                value={target?.id ?? ""}
                onValueChange={(next) => {
                  setPickerTarget(next)
                  if (targetProp === undefined) {
                    setUncontrolledTarget(next)
                  }
                  onTargetChange?.(next)
                  setState({ status: "idle" })
                }}
                disabled={asking}
              >
                <SelectTrigger
                  id={`${id}-target`}
                  className="w-full"
                  onBlur={() => {
                    setPickerTarget(undefined)
                  }}
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
                ref={promptRef}
                id={`${id}-prompt`}
                value={prompt}
                maxLength={maxPromptLength}
                placeholder={placeholder}
                aria-describedby={`${id}-hint`}
                readOnly={asking}
                onChange={(event) => {
                  setPrompt(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    // Safari ends a composition with an Enter whose
                    // isComposing is false; only its keyCode tells.
                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    event.keyCode !== 229
                  ) {
                    event.preventDefault()
                    void ask()
                  }
                }}
              />
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                Enter to send, Shift+Enter for a new line.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              {asking && (
                <Button type="button" variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={asking || prompt.trim() === ""}>
                {asking && <Loader2Icon className="animate-spin" />}
                Send
              </Button>
            </div>
          </form>
          {/* Sticky, so an answer shows without scrolling the docked panel. */}
          <div
            className={cn(
              "sticky bottom-0 flex flex-col gap-3 bg-background px-4",
              (asking || state.status !== "idle" || previewing) &&
                "border-y py-4"
            )}
          >
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 text-sm break-words"
            >
              {asking && (
                <>
                  <span className="sr-only">Asking…</span>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              )}
              {!asking && state.status === "clarify" && <p>{state.question}</p>}
              {!asking && state.status === "unavailable" && (
                <p className="text-muted-foreground">{state.reason}</p>
              )}
              {!asking && state.status === "failed" && (
                <p className="text-destructive">{state.message}</p>
              )}
              {state.status === "cancelled" && <p>Cancelled.</p>}
              {state.status === "discarded" && <p>Discarded.</p>}
              {state.status === "locked" && (
                <>
                  <p>Locked in.</p>
                  {state.keptInSession.length > 0 && (
                    <p className="text-muted-foreground">
                      {sessionNote(state.keptInSession)}
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
                <Button type="button" onClick={lockIn}>
                  Lock in
                </Button>
                <Button type="button" variant="outline" onClick={discard}>
                  Discard
                </Button>
              </div>
            )}
          </div>
          {target?.suggestions && target.suggestions.length > 0 && (
            <div
              role="group"
              aria-label="Suggestions"
              className="flex flex-wrap gap-2 p-4"
            >
              {target.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-auto py-1 text-left whitespace-normal"
                  disabled={asking}
                  onClick={() => {
                    setPrompt(suggestion)
                    promptRef.current?.focus()
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
