import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"

import type { LockInResult } from "./layer-store"
import { revealTarget } from "./reveal-target"
import { usePliantStatus } from "./use-pliant-status"
import { usePliantStore } from "./use-pliant-store"
import { usePliantSurface } from "./use-pliant-surface"
import { usePreview } from "./use-preview"

/**
 * An answer to an ask, as `createPliantHandler` in `@pliantui/server` sends
 * it: an overlay to preview, a clarifying question, a reason it can't be
 * done, or an error.
 *
 * @experimental
 */
export type AskAnswer =
  | { status: "ok"; overlay: unknown }
  | { status: "clarify"; question: string }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string }

type AskState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "clarify"; question: string }
  | { status: "failed"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "cancelled" }
  | { status: "discarded" }
  | {
      status: "locked"
      keptInSession: Extract<LockInResult, { success: true }>["keptInSession"]
    }

interface UseAskPanelOptions<TTarget extends { id: string }> {
  /** The nodes users can ask about. */
  targets: readonly TTarget[]
  /** The id of the picked target, when the parent controls it. */
  target?: string | undefined
  /** The id of the target picked first. Defaults to the first target. */
  defaultTarget?: string | undefined
  /**
   * Called with the id of the target the user picks in the picker. A
   * controlled parent applies it by passing it back as `target`, right away
   * or later, as after a navigation, and focus stays on the picker.
   */
  onTargetChange?: ((target: string) => void) | undefined
  /** Whether the panel is open, when the parent controls it. */
  open?: boolean | undefined
  /** Whether the panel starts open. It doesn't take focus then. */
  defaultOpen?: boolean | undefined
  /** Called when the trigger, Escape or `close` opens or closes the panel. */
  onOpenChange?: ((open: boolean) => void) | undefined
  /**
   * Sends an ask to the server and resolves with its answer. It is aborted
   * through `signal` when the ask is cancelled. Throwing counts as not
   * reaching the server.
   */
  send: (
    ask: { surface: string; target: TTarget; prompt: string },
    signal: AbortSignal
  ) => Promise<AskAnswer>
}

/**
 * The state and behaviour of a panel for asking AI to change a node of the
 * page: which target and prompt are picked, the ask in progress and its
 * answer, and the preview it shows, which is only saved by `lockIn`. Use it
 * inside a `PliantRoot`; `send` gets the root's surface with each ask. How
 * the ask reaches the server is up to `send`.
 *
 * Spread `triggerProps` on the element that opens the panel, `panelProps` on
 * the panel, `promptProps` on its textarea, and `pickerProps` and
 * `pickerTriggerProps` on a Radix Select of the targets and its trigger.
 * Enter in the prompt sends and Shift+Enter adds a new line; Escape closes
 * the panel while focus is inside it, and focus then goes back to the
 * trigger. Focus moves to the prompt when the panel opens and when the
 * parent changes `target` while it is open. Changing the target, from
 * anywhere, and closing the panel cancel an ask in progress; closing keeps
 * the preview. A target that isn't one of `targets` falls back to the first.
 * The prompt is kept when the target changes, so the same ask can go to
 * another target.
 *
 * When the panel is docked below the page, a preview scrolls its target,
 * found by its `data-pliant-id`, to the top unless it already shows above
 * the panel.
 *
 * @experimental
 */
export function useAskPanel<TTarget extends { id: string }>({
  targets,
  target: targetProp,
  defaultTarget,
  onTargetChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  send,
}: UseAskPanelOptions<TTarget>) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const preview = usePreview()
  const ready = usePliantStatus().status === "ready"
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [uncontrolledTarget, setUncontrolledTarget] = useState(defaultTarget)
  const [prompt, setPrompt] = useState("")
  const [state, setState] = useState<AskState>({ status: "idle" })
  const request = useRef<AbortController | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const panelId = useId()
  const open = openProp ?? uncontrolledOpen
  const [focusRequest, setFocusRequest] = useState(0)
  const targetId = targetProp ?? uncontrolledTarget
  const target =
    targets.find((candidate) => candidate.id === targetId) ?? targets[0]

  // An answer for one target must never be previewed under another, and a
  // passive effect would leave a gap for one to land in after the target
  // changed outside an event, from a timer or a transition.
  useLayoutEffect(
    () => () => {
      if (request.current) {
        request.current.abort()
        request.current = null
        setState({ status: "cancelled" })
      }
    },
    [target?.id]
  )

  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setFocusRequest((count) => count + 1)
    } else if (state.status === "asking") {
      setState({ status: "cancelled" })
    }
  }

  const [seenTarget, setSeenTarget] = useState(target?.id)
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
  const [pickerTarget, setPickerTarget] = useState<string>()
  const [seenTargetProp, setSeenTargetProp] = useState(targetProp)
  if (seenTargetProp !== targetProp) {
    setSeenTargetProp(targetProp)
    setPickerTarget(undefined)
    if (open && targetProp !== pickerTarget) {
      setFocusRequest((count) => count + 1)
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      request.current?.abort()
      request.current = null
    }
  }, [open])

  useEffect(() => {
    if (focusRequest > 0) {
      promptRef.current?.focus()
    }
  }, [focusRequest])

  const asking = state.status === "asking"

  function setOpen(next: boolean) {
    if (openProp === undefined) {
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
    let answer: AskAnswer
    try {
      answer = await send({ surface, target, prompt: text }, controller.signal)
    } catch {
      answer = {
        status: "error",
        message: "Couldn't reach the server. Check your connection.",
      }
    }
    if (controller.signal.aborted) {
      return
    }
    request.current = null
    if (answer.status === "ok") {
      const result = store.preview(answer.overlay)
      if (result.success) {
        revealTarget(target.id, panelRef.current)
      }
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

  function suggest(text: string) {
    setPrompt(text)
    promptRef.current?.focus()
  }

  const triggerProps = {
    ref: triggerRef,
    "aria-expanded": open,
    "aria-controls": open ? panelId : undefined,
    "data-state": open ? "open" : "closed",
    "data-preview": preview !== null ? "" : undefined,
    onClick: () => {
      if (open) {
        close()
      } else {
        setOpen(true)
      }
    },
  } as const

  const panelProps = {
    ref: panelRef,
    id: panelId,
    "data-slot": "pliant-ask-panel",
    "data-state": "open",
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (
        event.key === "Escape" &&
        !event.nativeEvent.isComposing &&
        event.target instanceof Node &&
        event.currentTarget.contains(event.target)
      ) {
        event.preventDefault()
        close()
      }
    },
  } as const

  const pickerProps = {
    value: target?.id ?? "",
    disabled: asking,
    onValueChange: (next: string) => {
      setPickerTarget(next)
      if (targetProp === undefined) {
        setUncontrolledTarget(next)
      }
      onTargetChange?.(next)
      setState({ status: "idle" })
    },
  }

  const pickerTriggerProps = {
    onBlur: () => {
      setPickerTarget(undefined)
    },
  }

  const promptProps = {
    ref: promptRef,
    value: prompt,
    readOnly: asking,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(event.target.value)
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing &&
        // Safari ends a composition with an Enter whose isComposing is
        // false; only its keyCode tells.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        event.keyCode !== 229
      ) {
        event.preventDefault()
        void ask()
      }
    },
  }

  return {
    open,
    target,
    state,
    asking,
    prompt,
    explain: asking ? [] : [...new Set(preview?.explain)],
    previewing: preview !== null,
    ask: () => {
      void ask()
    },
    cancel,
    lockIn,
    discard,
    suggest,
    close,
    triggerProps,
    panelProps,
    pickerProps,
    pickerTriggerProps,
    promptProps,
  }
}
