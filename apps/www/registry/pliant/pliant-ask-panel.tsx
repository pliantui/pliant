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
import type { AskContext } from "@pliantui/server"

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

/**
 * A node users can ask about: its address, a label for the picker, and the
 * context the server needs to answer (`askContextSchema` in
 * `@pliantui/server`): its manifest, the items it holds and, for data, the
 * fields it can sort and filter by. Never rows. `suggestions` are asks shown
 * as chips that fill in the prompt.
 */
interface PliantAskTarget {
  id: string
  label: string
  context: AskContext
  suggestions?: readonly string[]
}

type AskState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "clarify"; question: string }
  | { status: "failed"; message: string }
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
 * The panel is a non-modal complementary region docked to the side (to the
 * bottom on small screens), so the page and its preview stay usable while it
 * is open. Escape closes it while focus is inside it.
 */
function PliantAskPanel({
  endpoint,
  targets,
  defaultTarget,
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
  /** The id of the target picked first. Defaults to the first target. */
  defaultTarget?: string
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
  const [targetId, setTargetId] = React.useState(defaultTarget)
  const [prompt, setPrompt] = React.useState("")
  const [state, setState] = React.useState<AskState>({ status: "idle" })
  const request = React.useRef<AbortController | null>(null)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLElement>(null)
  const id = React.useId()
  const isOpen = open ?? uncontrolledOpen

  React.useEffect(
    () => () => {
      request.current?.abort()
    },
    []
  )

  React.useEffect(() => {
    if (isOpen) {
      promptRef.current?.focus()
    }
  }, [isOpen])

  const target =
    targets.find((candidate) => candidate.id === targetId) ?? targets[0]
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
      setState({ status: "failed", message: answer.reason })
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

  return (
    <>
      <Slot.Root
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-panel` : undefined}
        onClick={() => {
          if (isOpen) {
            close()
          } else {
            setOpen(true)
          }
        }}
      >
        {trigger ?? (
          <Button variant="outline" size="sm">
            <SparklesIcon />
            Ask
          </Button>
        )}
      </Slot.Root>
      {isOpen && (
        <aside
          ref={panelRef}
          id={`${id}-panel`}
          aria-labelledby={`${id}-title`}
          data-slot="pliant-ask-panel"
          className="animate-in slide-in-from-bottom sm:slide-in-from-right fixed inset-x-0 bottom-0 z-50 flex max-h-[60dvh] flex-col gap-4 overflow-y-auto border-t bg-background shadow-lg sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-sm sm:border-t-0 sm:border-l"
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
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
            className="flex flex-col gap-4 px-4"
            onSubmit={(event) => {
              event.preventDefault()
              void ask()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-target`}>Change</Label>
              <Select
                value={target?.id ?? ""}
                onValueChange={setTargetId}
                disabled={asking}
              >
                <SelectTrigger id={`${id}-target`} className="w-full">
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
            {target?.suggestions && target.suggestions.length > 0 && (
              <div
                role="group"
                aria-label="Suggestions"
                className="flex flex-wrap gap-2"
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
          <div className="flex flex-col gap-3 px-4 pb-4">
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
            {preview && !asking && (
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
        </aside>
      )}
    </>
  )
}

export { PliantAskPanel, type PliantAskTarget }
