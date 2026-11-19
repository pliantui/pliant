"use client"

import * as React from "react"
import { Loader2Icon, SparklesIcon } from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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

type Op = Extract<
  ReturnType<PliantStore["lockIn"]>,
  { success: true }
>["keptInSession"][number]

/**
 * A node users can ask about: its address, a label for the picker, and the
 * context the server needs to answer (`askContextSchema` in
 * `@pliantui/server`): its manifest, the items it holds and, for data, the
 * fields it can sort and filter by. Never rows.
 */
interface PliantAskTarget {
  id: string
  label: string
  context: AskContext
}

type AskState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "clarify"; question: string }
  | { status: "failed"; message: string }
  | { status: "cancelled" }
  | { status: "discarded" }
  | { status: "locked"; keptInSession: readonly Op[] }

async function readAnswer(response: Response) {
  const body: unknown = await response.json().catch(() => undefined)
  const answer = askResponseSchema.safeParse(body)
  if (answer.success) {
    return answer.data
  }
  return {
    status: "error",
    message: `Couldn't read the answer (HTTP ${String(response.status)}).`,
  } as const
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
 */
function PliantAskPanel({
  endpoint,
  targets,
  defaultTarget,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
}: {
  /** The URL of the route that answers asks with `createPliantHandler`. */
  endpoint: string
  /** The nodes users can ask about, in picker order. */
  targets: readonly PliantAskTarget[]
  /** The id of the target picked first. Defaults to the first target. */
  defaultTarget?: string
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
  const [targetId, setTargetId] = React.useState(
    defaultTarget ?? targets[0]?.id ?? ""
  )
  const [prompt, setPrompt] = React.useState("")
  const [state, setState] = React.useState<AskState>({ status: "idle" })
  const request = React.useRef<AbortController | null>(null)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const id = React.useId()

  React.useEffect(
    () => () => {
      request.current?.abort()
    },
    []
  )

  const target = targets.find((candidate) => candidate.id === targetId)
  const asking = state.status === "asking"
  const canAsk = ready && target !== undefined && prompt.trim() !== ""

  async function ask() {
    if (request.current || !canAsk) {
      return
    }
    const controller = new AbortController()
    request.current = controller
    setState({ status: "asking" })
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          surface,
          target: target.id,
          prompt: prompt.trim(),
          context: target.context,
        }),
        signal: controller.signal,
      })
      const answer = await readAnswer(response)
      if (controller.signal.aborted) {
        return
      }
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
    } catch {
      if (!controller.signal.aborted) {
        setState({
          status: "failed",
          message: "Couldn't reach the server. Check your connection.",
        })
      }
    } finally {
      if (request.current === controller) {
        request.current = null
      }
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
    <Sheet
      modal={false}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <SparklesIcon />
            Ask
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        data-slot="pliant-ask-panel"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          promptRef.current?.focus()
        }}
        onInteractOutside={(event) => {
          event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>Ask</SheetTitle>
          <SheetDescription>
            Describe how this page should look. You see a preview, and nothing
            is saved until you lock it in.
          </SheetDescription>
        </SheetHeader>
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
              value={targetId}
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
              placeholder="Put the overdue card first"
              aria-describedby={`${id}-hint`}
              readOnly={asking}
              onChange={(event) => {
                setPrompt(event.target.value)
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
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
            <Button type="submit" disabled={asking || !canAsk}>
              {asking && <Loader2Icon className="animate-spin" />}
              Send
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-2 text-sm"
          >
            {asking && (
              <>
                <span className="sr-only">Asking…</span>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </>
            )}
            {explain.length > 0 && (
              <>
                <Badge variant="secondary">Preview</Badge>
                <ul className="flex flex-col gap-1">
                  {explain.map((sentence) => (
                    <li key={sentence}>{sentence}</li>
                  ))}
                </ul>
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
      </SheetContent>
    </Sheet>
  )
}

export { PliantAskPanel, type PliantAskTarget }
